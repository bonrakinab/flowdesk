/** Twilio SMS helper for reminder alerts. */

export function isSmsConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_FROM?.trim()
  );
}

/** Normalize to E.164-ish: keep leading +, digits only otherwise. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return hasPlus ? `+${digits}` : `+${digits}`;
}

export async function sendSms(opts: {
  to: string;
  body: string;
}): Promise<{ ok: boolean; error?: string; sid?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_FROM?.trim();
  if (!sid || !token || !from) {
    return { ok: false, error: "Twilio not configured" };
  }

  const to = normalizePhone(opts.to);
  if (!to) {
    return { ok: false, error: "Invalid phone number" };
  }

  try {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const params = new URLSearchParams({
      To: to,
      From: from,
      Body: opts.body.slice(0, 1500),
    });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );
    const data = (await res.json().catch(() => ({}))) as {
      sid?: string;
      message?: string;
      error_message?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        error: data.message || data.error_message || `Twilio ${res.status}`,
      };
    }
    return { ok: true, sid: data.sid };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "SMS failed",
    };
  }
}
