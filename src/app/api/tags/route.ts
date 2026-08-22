import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHousehold } from "@/lib/session";

const schema = z.object({
  name: z.string().min(1).max(40),
  color: z.string().optional(),
});

export async function GET() {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };

  const tags = await prisma.tag.findMany({
    where: { householdId },
    include: { _count: { select: { tickets: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(tags);
}

export async function POST(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const data = schema.parse(await req.json());

  const tag = await prisma.tag.upsert({
    where: {
      householdId_name: { householdId, name: data.name.trim() },
    },
    create: {
      name: data.name.trim(),
      color: data.color || "#64748b",
      householdId,
    },
    update: { color: data.color },
  });
  return NextResponse.json(tag);
}

export async function PATCH(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const body = schema
    .partial()
    .extend({ id: z.string() })
    .parse(await req.json());

  const existing = await prisma.tag.findFirst({
    where: { id: body.id, householdId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { id, ...rest } = body;
  const tag = await prisma.tag.update({ where: { id }, data: rest });
  return NextResponse.json(tag);
}

export async function DELETE(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const { id } = z.object({ id: z.string() }).parse(await req.json());
  const existing = await prisma.tag.findFirst({ where: { id, householdId } });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.tag.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
