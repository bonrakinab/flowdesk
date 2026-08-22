import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHousehold } from "@/lib/session";
import { generateInviteCode } from "@/lib/utils";

export async function GET() {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };

  const household = await prisma.household.findUnique({
    where: { id: householdId },
    include: {
      users: {
        select: { id: true, name: true, email: true, color: true, image: true },
      },
    },
  });
  return NextResponse.json(household);
}

export async function POST() {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };

  const household = await prisma.household.update({
    where: { id: householdId },
    data: { inviteCode: generateInviteCode() },
  });
  return NextResponse.json({ inviteCode: household.inviteCode });
}
