import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHousehold } from "@/lib/session";

export async function GET(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const q = new URL(req.url).searchParams.get("q")?.trim() || "";
  if (!q) return NextResponse.json({ tickets: [], notes: [], contacts: [], events: [] });

  const [tickets, notes, contacts, events] = await Promise.all([
    prisma.ticket.findMany({
      where: {
        householdId,
        OR: [
          { title: { contains: q } },
          { description: { contains: q } },
        ],
      },
      take: 8,
    }),
    prisma.note.findMany({
      where: { householdId, title: { contains: q } },
      take: 6,
    }),
    prisma.contact.findMany({
      where: {
        householdId,
        OR: [{ name: { contains: q } }, { company: { contains: q } }],
      },
      take: 6,
    }),
    prisma.calendarEvent.findMany({
      where: { householdId, title: { contains: q } },
      take: 6,
    }),
  ]);

  return NextResponse.json({ tickets, notes, contacts, events });
}
