import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const GOOGLE_HEALTH_SCOPES = [
  "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
  "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
  "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
];

const STATE_COOKIE = "flowdesk_google_health_oauth_state";

function getGoogleClientId() {
  return process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID;
}

function getAppUrl(req: NextRequest) {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.AUTH_URL ||
    req.nextUrl.origin
  ).replace(/\/$/, "");
}

/** Initiates Google Health API v4 OAuth. */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientId = getGoogleClientId();
    if (!clientId) {
      return NextResponse.json(
        { error: "Google OAuth is not configured" },
        { status: 500 }
      );
    }

    const redirectUri = `${getAppUrl(req)}/api/fitness/callback`;
    const state = randomUUID();
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", GOOGLE_HEALTH_SCOPES.join(" "));
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("include_granted_scopes", "true");
    authUrl.searchParams.set("state", state);

    const response = NextResponse.redirect(authUrl);
    response.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });
    return response;
  } catch (error) {
    console.error("Error initiating Google Health OAuth:", error);
    return NextResponse.json(
      { error: "Failed to initiate Google Health connection" },
      { status: 500 }
    );
  }
}
