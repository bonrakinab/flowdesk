import { NextResponse } from "next/server";
import { dispatchAlertsForAllUsers } from "@/lib/alert-dispatch";
import { dispatchDailyDigestsForAllUsers } from "@/lib/daily-digest";

/**
 * Background tick for push/email/SMS when the browser may be closed.
 * Vercel Cron sends x-vercel-cron: 1. External schedulers use Authorization: Bearer $CRON_SECRET.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const auth = req.headers.get("authorization") || "";
  const bearerOk = Boolean(secret && auth === `Bearer ${secret}`);

  if (!isVercelCron && !bearerOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [alerts, digest] = await Promise.all([
    dispatchAlertsForAllUsers({ email: false }),
    dispatchDailyDigestsForAllUsers(),
  ]);
  return NextResponse.json({ ok: true, alerts, digest });
}
