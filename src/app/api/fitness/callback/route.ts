import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Google Health API OAuth callback handler
 * GET /api/fitness/callback?code=...&state=...
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // user email
    const error = searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(
        `${req.nextUrl.origin}/health?error=access_denied`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${req.nextUrl.origin}/health?error=invalid_callback`
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.NEXTAUTH_URL 
      ? `${process.env.NEXTAUTH_URL}/api/fitness/callback`
      : `${req.nextUrl.origin}/api/fitness/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${req.nextUrl.origin}/health?error=config_missing`
      );
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      return NextResponse.redirect(
        `${req.nextUrl.origin}/health?error=token_exchange_failed`
      );
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in, scope } = tokens;

    if (!access_token || !refresh_token) {
      return NextResponse.redirect(
        `${req.nextUrl.origin}/health?error=incomplete_tokens`
      );
    }

    // Find user by email (from state)
    const user = await prisma.user.findUnique({
      where: { email: state },
    });

    if (!user) {
      return NextResponse.redirect(
        `${req.nextUrl.origin}/health?error=user_not_found`
      );
    }

    // Store or update fitness connection
    const expiresAt = new Date(Date.now() + expires_in * 1000);
    
    await prisma.fitnessConnection.upsert({
      where: {
        userId_provider: {
          userId: user.id,
          provider: 'google_health',
        },
      },
      create: {
        userId: user.id,
        provider: 'google_health',
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt,
        scope: scope || null,
        syncEnabled: true,
      },
      update: {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt,
        scope: scope || null,
        syncEnabled: true,
        updatedAt: new Date(),
      },
    });

    // Redirect back to health page with success
    return NextResponse.redirect(
      `${req.nextUrl.origin}/health?connected=true`
    );
  } catch (error) {
    console.error('Error in fitness OAuth callback:', error);
    return NextResponse.redirect(
      `${req.nextUrl.origin}/health?error=server_error`
    );
  }
}
