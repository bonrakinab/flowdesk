import { prisma } from "@/lib/db";

type GoogleAccount = {
  id: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null;
  scope: string | null;
};

export async function getFreshGoogleAccessToken(
  account: GoogleAccount
): Promise<
  | { ok: true; accessToken: string; scope: string | null }
  | { ok: false; error: string; hint?: string }
> {
  const stillValid =
    account.access_token &&
    account.expires_at &&
    account.expires_at * 1000 > Date.now() + 60_000;

  if (stillValid) {
    return {
      ok: true,
      accessToken: account.access_token!,
      scope: account.scope,
    };
  }

  if (!account.refresh_token) {
    return {
      ok: false,
      error: "Google session expired and no refresh token is stored.",
      hint: "Unlink Google on Account, then Link Google again and approve calendar access.",
    };
  }

  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) {
    return {
      ok: false,
      error: "Google OAuth is not configured on the server.",
    };
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
    }),
  });

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    return {
      ok: false,
      error: data.error_description || data.error || "Failed to refresh Google token",
      hint: "Unlink Google on Account, then Link Google again.",
    };
  }

  const expiresAt = Math.floor(Date.now() / 1000) + (data.expires_in || 3600);
  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: data.access_token,
      expires_at: expiresAt,
      ...(data.scope ? { scope: data.scope } : {}),
    },
  });

  return {
    ok: true,
    accessToken: data.access_token,
    scope: data.scope || account.scope,
  };
}

export function hasCalendarScope(scope: string | null | undefined) {
  if (!scope) return false;
  return (
    scope.includes("https://www.googleapis.com/auth/calendar.readonly") ||
    scope.includes("https://www.googleapis.com/auth/calendar")
  );
}

export function hasTasksScope(scope: string | null | undefined) {
  if (!scope) return false;
  return (
    scope.includes("https://www.googleapis.com/auth/tasks.readonly") ||
    scope.includes("https://www.googleapis.com/auth/tasks")
  );
}
