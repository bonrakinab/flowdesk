import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHousehold } from "@/lib/session";

export async function GET() {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };

  const household = await prisma.household.findUnique({
    where: { id: householdId },
    include: {
      users: {
        select: { id: true, name: true, email: true, color: true },
      },
      projects: true,
      contacts: true,
      tags: true,
      tickets: {
        include: {
          checklist: true,
          tags: { include: { tag: true } },
          assignees: true,
        },
      },
      calendars: {
        include: { events: true },
      },
      events: true,
      notes: true,
      folders: true,
      financeEntries: true,
      savingsGoals: true,
      financeMonths: true,
      financeBudgets: true,
      templates: true,
    },
  });

  if (!household) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    version: 1,
    household,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="flowdesk-backup-${household.inviteCode}-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
