import { NextResponse } from "next/server";
import { collectDueAlerts } from "@/lib/alerts";
import { requireHousehold } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId, user } = result as {
    householdId: string;
    user: { id: string };
  };

  const url = new URL(req.url);
  // Wide enough that a 20s poll (and opening the app late) still surfaces dues.
  const pastMs = Number(url.searchParams.get("pastMs") || 2 * 60 * 60_000);
  const futureMs = Number(url.searchParams.get("futureMs") || 15 * 60_000);
  const tzRaw = url.searchParams.get("tzOffset");
  const tzOffsetMinutes =
    tzRaw != null && tzRaw !== "" ? Number(tzRaw) : undefined;

  if (tzOffsetMinutes != null && Number.isFinite(tzOffsetMinutes)) {
    void prisma.user
      .update({
        where: { id: user.id },
        data: { tzOffsetMinutes: Math.round(tzOffsetMinutes) },
      })
      .catch(() => null);
  }

  const alerts = await collectDueAlerts({
    householdId,
    userId: user.id,
    pastMs,
    futureMs,
    tzOffsetMinutes,
  });

  return NextResponse.json({ alerts, serverTime: new Date().toISOString() });
}
