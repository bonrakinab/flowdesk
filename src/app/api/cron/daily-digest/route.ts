import { NextResponse } from "next/server";
import { dispatchDailyDigestsForAllUsers } from "@/lib/daily-digest";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const auth = req.headers.get("authorization") || "";
  const bearerOk = Boolean(secret && auth === `Bearer ${secret}`);

  if (!isVercelCron && !bearerOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await dispatchDailyDigestsForAllUsers();
  return NextResponse.json({ ok: true, ...summary });
}
