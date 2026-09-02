import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { dispatchDailyDigestForUser } from "@/lib/daily-digest";

export async function POST() {
  const result = await requireUser();
  if ("error" in result && result.error) return result.error;
  const { user } = result as { user: { id: string } };

  const full = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      name: true,
      householdId: true,
      alertEmail: true,
      tzOffsetMinutes: true,
    },
  });

  if (!full) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const digest = await dispatchDailyDigestForUser(full, { force: true });
  if (!digest.sent) {
    return NextResponse.json(
      { ok: false, ...digest },
      { status: digest.error ? 502 : 400 }
    );
  }

  return NextResponse.json({ ok: true, ...digest });
}
