import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHousehold } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const { id } = await ctx.params;

  const schema = z.object({
    name: z.string().min(1).max(120).optional(),
    color: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    syncEnabled: z.boolean().optional(),
  });

  try {
    const data = schema.parse(await req.json());
    const existing = await prisma.calendar.findFirst({
      where: { id, householdId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const calendar = await prisma.calendar.update({
      where: { id },
      data,
      include: { _count: { select: { events: true } } },
    });
    return NextResponse.json(calendar);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const { id } = await ctx.params;

  const existing = await prisma.calendar.findFirst({
    where: { id, householdId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Detach events, then delete calendar (imported/local clean-up).
  await prisma.calendarEvent.updateMany({
    where: { calendarId: id },
    data: { calendarId: null },
  });
  await prisma.calendar.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
