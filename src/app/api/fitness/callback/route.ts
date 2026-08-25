import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const STATE_COOKIE = "flowdesk_google_health_oauth_state";

function getGoogleOAuthCredentials() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID,
    clientSecret:
      process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET,
  };
}

function getAppUrl(req: NextRequest) {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.AUTH_URL ||
    req.nextUrl.origin
  ).replace(/\/$/, "");
}

function redirectWithClearedState(req: NextRequest, suffix: string) {
  const response = NextResponse.redirect(`${getAppUrl(req)}/health${suffix}`);
  response.cookies.set(STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}

/** Google Health API v4 OAuth callback. */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return redirectWithClearedState(req, "?error=unauthorized");
    }

    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");
    const oauthError = req.nextUrl.searchParams.get("error");
    const expectedState = req.cookies.get(STATE_COOKIE)?.value;

    if (oauthError) {
      console.error("Google Health OAuth error:", oauthError);
      return redirectWithClearedState(req, "?error=access_denied");
    }

    if (!code || !state || !expectedState || state !== expectedState) {
      return redirectWithClearedState(req, "?error=invalid_state");
    }

    const { clientId, clientSecret } = getGoogleOAuthCredentials();
    if (!clientId || !clientSecret) {
      return redirectWithClearedState(req, "?error=config_missing");
    }

    const redirectUri = `${getAppUrl(req)}/api/fitness/callback`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    });

    if (!tokenResponse.ok) {
      console.error(
        "Google Health token exchange failed:",
        tokenResponse.status,
        await tokenResponse.text()
      );
      return redirectWithClearedState(req, "?error=token_exchange_failed");
    }

    const tokens = await tokenResponse.json();
    const user = await prisma.user.findUnique({
      where: { email: session.user.email.toLowerCase() },
    });

    if (!user) {
      return redirectWithClearedState(req, "?error=user_not_found");
    }

    const existing = await prisma.fitnessConnection.findUnique({
      where: {
        userId_provider: { userId: user.id, provider: "google_health" },
      },
    });

    const accessToken = tokens.access_token as string | undefined;
    const refreshToken =
      (tokens.refresh_token as string | undefined) || existing?.refreshToken;
    const expiresIn = Number(tokens.expires_in || 3600);

    if (!accessToken || !refreshToken) {
      return redirectWithClearedState(req, "?error=incomplete_tokens");
    }

    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    await prisma.fitnessConnection.upsert({
      where: {
        userId_provider: { userId: user.id, provider: "google_health" },
      },
      create: {
        userId: user.id,
        provider: "google_health",
        accessToken,
        refreshToken,
        expiresAt,
        scope: typeof tokens.scope === "string" ? tokens.scope : null,
        syncEnabled: true,
      },
      update: {
        accessToken,
        refreshToken,
        expiresAt,
        scope: typeof tokens.scope === "string" ? tokens.scope : null,
        syncEnabled: true,
      },
    });

    return redirectWithClearedState(req, "?connected=true");
  } catch (error) {
    console.error("Error in Google Health OAuth callback:", error);
    return redirectWithClearedState(req, "?error=server_error");
  }
}
