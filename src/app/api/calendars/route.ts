import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHousehold } from "@/lib/session";

export async function GET() {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };

  const calendars = await prisma.calendar.findMany({
    where: { householdId },
    orderBy: [{ externalSource: "asc" }, { name: "asc" }],
    include: { _count: { select: { events: true } } },
  });
  return NextResponse.json({ calendars });
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  color: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };

  try {
    const data = createSchema.parse(await req.json());
    const calendar = await prisma.calendar.create({
      data: {
        name: data.name,
        color: data.color,
        description: data.description,
        externalSource: "local",
        syncEnabled: false,
        householdId,
      },
    });
    return NextResponse.json(calendar);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}
