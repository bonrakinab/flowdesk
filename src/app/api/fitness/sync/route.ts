import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const GOOGLE_HEALTH_BASE = "https://health.googleapis.com/v4/users/me/dataTypes";
const PROVIDER = "google_health";

type Connection = {
  id: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
};

type CivilDate = { year: number; month: number; day: number };

type DailyMetric = {
  date: Date;
  steps: number | null;
  distance: number | null;
  calories: number | null;
  activeMinutes: number | null;
  heartRateAvg: number | null;
  heartRateMin: number | null;
  heartRateMax: number | null;
  sleepMinutes: number | null;
  raw: Record<string, unknown>;
};

function getGoogleOAuthCredentials() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID,
    clientSecret:
      process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET,
  };
}

async function refreshAccessToken(connection: Connection) {
  const { clientId, clientSecret } = getGoogleOAuthCredentials();
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth is not configured");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: connection.refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("Google token refresh failed:", response.status, await response.text());
    throw new Error("Google Health authorization expired. Reconnect Google Health.");
  }

  const tokens = await response.json();
  const accessToken = tokens.access_token as string | undefined;
  if (!accessToken) {
    throw new Error("Google Health did not return an access token");
  }

  const expiresAt = new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000);
  await prisma.fitnessConnection.update({
    where: { id: connection.id },
    data: { accessToken, expiresAt },
  });
  return accessToken;
}

async function getValidAccessToken(connection: Connection) {
  if (connection.expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    return refreshAccessToken(connection);
  }
  return connection.accessToken;
}

function toCivilDate(date: Date): CivilDate {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function civilKey(date?: CivilDate) {
  if (!date?.year || !date?.month || !date?.day) return null;
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function dateFromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function ensureDay(days: Map<string, DailyMetric>, key: string) {
  let value = days.get(key);
  if (!value) {
    value = {
      date: dateFromKey(key),
      steps: null,
      distance: null,
      calories: null,
      activeMinutes: null,
      heartRateAvg: null,
      heartRateMin: null,
      heartRateMax: null,
      sleepMinutes: null,
      raw: {},
    };
    days.set(key, value);
  }
  return value;
}

async function fetchDailyRollup(
  accessToken: string,
  dataType: string,
  start: CivilDate,
  end: CivilDate
) {
  const response = await fetch(
    `${GOOGLE_HEALTH_BASE}/${dataType}/dataPoints:dailyRollUp`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        range: {
          start: { date: start },
          end: { date: end },
        },
        windowSizeDays: 1,
      }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const body = await response.text();
    console.error(`Google Health ${dataType} rollup failed:`, response.status, body);
    throw new Error(`${dataType}:${response.status}`);
  }

  return response.json();
}

async function fetchSleep(
  accessToken: string,
  startKey: string,
  endKey: string
) {
  const all: unknown[] = [];
  let pageToken: string | undefined;
  let pages = 0;

  do {
    const url = new URL(`${GOOGLE_HEALTH_BASE}/sleep/dataPoints:reconcile`);
    url.searchParams.set(
      "filter",
      `sleep.interval.civil_end_time >= "${startKey}" AND sleep.interval.civil_end_time < "${endKey}"`
    );
    url.searchParams.set("pageSize", "25");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("Google Health sleep reconcile failed:", response.status, body);
      throw new Error(`sleep:${response.status}`);
    }

    const json = await response.json();
    all.push(...(json.dataPoints || []));
    pageToken = json.nextPageToken || undefined;
    pages += 1;
  } while (pageToken && pages < 10);

  return all as Array<Record<string, any>>;
}

function applyRollups(
  days: Map<string, DailyMetric>,
  dataType: string,
  payload: any
) {
  for (const point of payload?.rollupDataPoints || []) {
    const key = civilKey(point.civilStartTime?.date);
    if (!key) continue;
    const day = ensureDay(days, key);
    day.raw[dataType] = point;

    if (dataType === "steps" && point.steps) {
      day.steps = Number(point.steps.countSum || 0);
    } else if (dataType === "distance" && point.distance) {
      day.distance = Number(point.distance.millimetersSum || 0) / 1000;
    } else if (dataType === "total-calories" && point.totalCalories) {
      day.calories = Number(point.totalCalories.kcalSum || 0);
    } else if (dataType === "active-minutes" && point.activeMinutes) {
      day.activeMinutes = (point.activeMinutes.activeMinutesRollupByActivityLevel || []).reduce(
        (sum: number, item: any) => sum + Number(item.activeMinutesSum || 0),
        0
      );
    } else if (dataType === "heart-rate" && point.heartRate) {
      day.heartRateAvg = Number(point.heartRate.beatsPerMinuteAvg);
      day.heartRateMin = Number(point.heartRate.beatsPerMinuteMin);
      day.heartRateMax = Number(point.heartRate.beatsPerMinuteMax);
    }
  }
}

function applySleep(days: Map<string, DailyMetric>, points: Array<Record<string, any>>) {
  for (const point of points) {
    const sleep = point.sleep;
    if (!sleep || sleep.metadata?.nap) continue;

    const key =
      civilKey(sleep.interval?.civilEndTime?.date) ||
      (sleep.interval?.endTime
        ? new Date(sleep.interval.endTime).toISOString().slice(0, 10)
        : null);
    if (!key) continue;

    const minutes = Number(sleep.summary?.minutesAsleep || 0);
    const day = ensureDay(days, key);
    day.sleepMinutes = (day.sleepMinutes || 0) + minutes;
    day.raw.sleep = [...((day.raw.sleep as unknown[]) || []), point];
  }
}

async function saveDays(userId: string, days: Map<string, DailyMetric>) {
  let count = 0;
  for (const day of days.values()) {
    const update: Record<string, unknown> = {
      rawData: JSON.stringify(day.raw),
    };

    for (const field of [
      "steps",
      "distance",
      "calories",
      "activeMinutes",
      "heartRateAvg",
      "heartRateMin",
      "heartRateMax",
      "sleepMinutes",
    ] as const) {
      if (day[field] !== null && Number.isFinite(day[field])) {
        update[field] = day[field];
      }
    }

    await prisma.fitnessData.upsert({
      where: {
        userId_date_provider: { userId, date: day.date, provider: PROVIDER },
      },
      create: {
        userId,
        date: day.date,
        provider: PROVIDER,
        steps: day.steps,
        distance: day.distance,
        calories: day.calories,
        activeMinutes: day.activeMinutes,
        heartRateAvg: day.heartRateAvg,
        heartRateMin: day.heartRateMin,
        heartRateMax: day.heartRateMax,
        sleepMinutes: day.sleepMinutes,
        rawData: JSON.stringify(day.raw),
      },
      update,
    });
    count += 1;
  }
  return count;
}

/** Sync the latest 14 days from Google Health API v4. */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email.toLowerCase() },
      include: {
        fitnessConnections: { where: { provider: PROVIDER }, take: 1 },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const connection = user.fitnessConnections[0] as Connection | undefined;
    if (!connection) {
      return NextResponse.json(
        { error: "Not connected to Google Health" },
        { status: 400 }
      );
    }

    const accessToken = await getValidAccessToken(connection);
    const today = new Date();
    const endDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1));
    const startDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 13));
    const start = toCivilDate(startDate);
    const end = toCivilDate(endDate);
    const startKey = civilKey(start)!;
    const endKey = civilKey(end)!;

    const rollupTypes = [
      "steps",
      "distance",
      "total-calories",
      "active-minutes",
      "heart-rate",
    ] as const;

    const results = await Promise.allSettled([
      ...rollupTypes.map((type) => fetchDailyRollup(accessToken, type, start, end)),
      fetchSleep(accessToken, startKey, endKey),
    ]);

    const days = new Map<string, DailyMetric>();
    let accessibleSources = 0;

    for (let i = 0; i < rollupTypes.length; i += 1) {
      const result = results[i];
      if (result.status === "fulfilled") {
        accessibleSources += 1;
        applyRollups(days, rollupTypes[i], result.value);
      }
    }

    const sleepResult = results[rollupTypes.length];
    if (sleepResult.status === "fulfilled") {
      accessibleSources += 1;
      applySleep(days, sleepResult.value as Array<Record<string, any>>);
    }

    if (accessibleSources === 0) {
      return NextResponse.json(
        {
          error:
            "Google Health did not grant access to any requested metrics. Reconnect and allow the Health permissions.",
        },
        { status: 502 }
      );
    }

    const saved = await saveDays(user.id, days);
    await prisma.fitnessConnection.update({
      where: { id: connection.id },
      data: { lastSyncAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: saved ? `Synced ${saved} days of health data` : "No new health data available",
      dataPoints: saved,
      partial: accessibleSources < results.length,
    });
  } catch (error) {
    console.error("Error syncing Google Health data:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync Google Health" },
      { status: 500 }
    );
  }
}

/** Return stored health data and connection status. */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email.toLowerCase() },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const requestedDays = Number.parseInt(searchParams.get("days") || "30", 10);
    const days = Number.isFinite(requestedDays)
      ? Math.min(Math.max(requestedDays, 1), 365)
      : 30;

    const startDate = new Date();
    startDate.setUTCDate(startDate.getUTCDate() - days);
    startDate.setUTCHours(0, 0, 0, 0);

    const [data, connection] = await Promise.all([
      prisma.fitnessData.findMany({
        where: { userId: user.id, provider: PROVIDER, date: { gte: startDate } },
        orderBy: { date: "asc" },
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
      }),
      prisma.fitnessConnection.findUnique({
        where: { userId_provider: { userId: user.id, provider: PROVIDER } },
        select: { lastSyncAt: true, syncEnabled: true },
      }),
    ]);

    return NextResponse.json({ data, connection });
  } catch (error) {
    console.error("Error fetching health data:", error);
    return NextResponse.json({ error: "Failed to fetch health data" }, { status: 500 });
  }
}
