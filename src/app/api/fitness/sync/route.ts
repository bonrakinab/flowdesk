import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(connection: any) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth not configured');
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: connection.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to refresh access token');
  }

  const tokens = await tokenResponse.json();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  // Update connection with new access token
  await prisma.fitnessConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: tokens.access_token,
      expiresAt,
      updatedAt: new Date(),
    },
  });

  return tokens.access_token;
}

/**
 * Get valid access token, refreshing if needed
 */
async function getValidAccessToken(connection: any) {
  // If token expires in less than 5 minutes, refresh it
  const expiresIn = connection.expiresAt.getTime() - Date.now();
  if (expiresIn < 5 * 60 * 1000) {
    return await refreshAccessToken(connection);
  }
  return connection.accessToken;
}

/**
 * Fetch data from Google Fit REST API
 */
async function fetchGoogleFitData(accessToken: string, startTimeMillis: number, endTimeMillis: number) {
  const dataSourceId = 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps';
  
  const response = await fetch(
    `https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        aggregateBy: [
          {
            dataTypeName: 'com.google.step_count.delta',
            dataSourceId: dataSourceId,
          },
          {
            dataTypeName: 'com.google.distance.delta',
          },
          {
            dataTypeName: 'com.google.calories.expended',
          },
          {
            dataTypeName: 'com.google.active_minutes',
          },
          {
            dataTypeName: 'com.google.heart_rate.bpm',
          },
          {
            dataTypeName: 'com.google.sleep.segment',
          },
        ],
        bucketByTime: { durationMillis: 86400000 }, // 1 day buckets
        startTimeMillis,
        endTimeMillis,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Google Fit API error:', errorText);
    throw new Error(`Google Fit API error: ${response.status}`);
  }

  return await response.json();
}

/**
 * Process and store fitness data
 */
async function processFitnessData(userId: string, buckets: any[]) {
  const processedData = [];

  for (const bucket of buckets) {
    const date = new Date(parseInt(bucket.startTimeMillis));
    date.setHours(0, 0, 0, 0); // Normalize to start of day

    let steps = null;
    let distance = null;
    let calories = null;
    let activeMinutes = null;
    let heartRateAvg = null;
    let heartRateMin = null;
    let heartRateMax = null;
    let sleepMinutes = null;

    // Extract data from each dataset
    for (const dataset of bucket.dataset || []) {
      const dataType = dataset.dataSourceId?.split(':')[0]?.replace('derived:', '');
      
      for (const point of dataset.point || []) {
        if (!point.value?.[0]) continue;

        if (dataType?.includes('step_count')) {
          steps = (steps || 0) + (point.value[0].intVal || 0);
        } else if (dataType?.includes('distance')) {
          distance = (distance || 0) + (point.value[0].fpVal || 0);
        } else if (dataType?.includes('calories')) {
          calories = (calories || 0) + (point.value[0].fpVal || 0);
        } else if (dataType?.includes('active_minutes')) {
          activeMinutes = (activeMinutes || 0) + (point.value[0].intVal || 0);
        } else if (dataType?.includes('heart_rate')) {
          const hr = point.value[0].fpVal;
          if (hr) {
            heartRateMin = heartRateMin ? Math.min(heartRateMin, hr) : hr;
            heartRateMax = heartRateMax ? Math.max(heartRateMax, hr) : hr;
            heartRateAvg = heartRateAvg ? (heartRateAvg + hr) / 2 : hr;
          }
        } else if (dataType?.includes('sleep')) {
          const sleepValue = point.value[0].intVal; // Sleep segment type
          if (sleepValue) {
            const duration = (parseInt(point.endTimeNanos || '0') - parseInt(point.startTimeNanos || '0')) / 1e9 / 60;
            sleepMinutes = (sleepMinutes || 0) + duration;
          }
        }
      }
    }

    // Store daily data
    if (steps || distance || calories || activeMinutes || heartRateAvg || sleepMinutes) {
      await prisma.fitnessData.upsert({
        where: {
          userId_date_provider: {
            userId,
            date,
            provider: 'google_health',
          },
        },
        create: {
          userId,
          date,
          provider: 'google_health',
          steps,
          distance,
          calories,
          activeMinutes,
          heartRateAvg,
          heartRateMin,
          heartRateMax,
          sleepMinutes: sleepMinutes ? Math.round(sleepMinutes) : null,
          rawData: JSON.stringify(bucket),
        },
        update: {
          steps,
          distance,
          calories,
          activeMinutes,
          heartRateAvg,
          heartRateMin,
          heartRateMax,
          sleepMinutes: sleepMinutes ? Math.round(sleepMinutes) : null,
          rawData: JSON.stringify(bucket),
          updatedAt: new Date(),
        },
      });

      processedData.push({ date, steps, distance, calories, activeMinutes });
    }
  }

  return processedData;
}

/**
 * Sync fitness data from Google Health API
 * POST /api/fitness/sync
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        fitnessConnections: {
          where: { provider: 'google_health' },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const connection = user.fitnessConnections[0];
    if (!connection) {
      return NextResponse.json(
        { error: "Not connected to Google Health" },
        { status: 400 }
      );
    }

    // Get valid access token
    const accessToken = await getValidAccessToken(connection);

    // Fetch last 30 days of data
    const endTime = Date.now();
    const startTime = endTime - (30 * 24 * 60 * 60 * 1000);

    const fitData = await fetchGoogleFitData(accessToken, startTime, endTime);
    
    if (!fitData.bucket || fitData.bucket.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No data available',
        dataPoints: 0,
      });
    }

    // Process and store the data
    const processedData = await processFitnessData(user.id, fitData.bucket);

    // Update last sync time
    await prisma.fitnessConnection.update({
      where: { id: connection.id },
      data: { lastSyncAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: `Synced ${processedData.length} days of fitness data`,
      dataPoints: processedData.length,
      data: processedData,
    });
  } catch (error) {
    console.error('Error syncing fitness data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync data" },
      { status: 500 }
    );
  }
}

/**
 * Get fitness data
 * GET /api/fitness/sync?days=30
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '30');

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Get fitness data for the last N days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const data = await prisma.fitnessData.findMany({
      where: {
        userId: user.id,
        date: {
          gte: startDate,
        },
      },
      orderBy: {
        date: 'asc',
      },
      select: {
        date: true,
        steps: true,
        distance: true,
        calories: true,
        activeMinutes: true,
        heartRateAvg: true,
        heartRateMin: true,
        heartRateMax: true,
        sleepMinutes: true,
      },
    });

    // Get connection status
    const connection = await prisma.fitnessConnection.findUnique({
      where: {
        userId_provider: {
          userId: user.id,
          provider: 'google_health',
        },
      },
      select: {
        lastSyncAt: true,
        syncEnabled: true,
      },
    });

    return NextResponse.json({
      data,
      connection: connection || null,
    });
  } catch (error) {
    console.error('Error fetching fitness data:', error);
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}
