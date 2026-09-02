import { NextResponse } from "next/server";
import { requireHousehold } from "@/lib/session";
import { dispatchAlertsForUser } from "@/lib/alert-dispatch";
import { prisma } from "@/lib/db";

export async function POST() {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { user } = result as { user: { id: string } };

  const full = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      householdId: true,
      alertEmail: true,
      alertSms: true,
      phone: true,
      tzOffsetMinutes: true,
    },
  });
  if (!full) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await dispatchAlertsForUser(full);
  return NextResponse.json(summary);
}
