import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHousehold } from "@/lib/session";

export async function GET() {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };

  const projects = await prisma.project.findMany({
    where: { householdId },
    include: {
      _count: { select: { tickets: true } },
      tickets: {
        where: { status: { not: "Done" } },
        select: { id: true, title: true, status: true, priority: true },
        take: 8,
      },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(projects);
}

const schema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
  status: z.string().optional(),
  description: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const data = schema.parse(await req.json());
  const project = await prisma.project.create({
    data: { ...data, householdId },
  });
  return NextResponse.json(project);
}

export async function PATCH(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const body = schema.extend({ id: z.string() }).parse(await req.json());
  const existing = await prisma.project.findFirst({
    where: { id: body.id, householdId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { id, ...data } = body;
  const project = await prisma.project.update({ where: { id }, data });
  return NextResponse.json(project);
}

export async function DELETE(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const { id } = z.object({ id: z.string() }).parse(await req.json());
  const existing = await prisma.project.findFirst({ where: { id, householdId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
