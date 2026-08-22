import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHousehold } from "@/lib/session";

export async function GET() {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };

  const contacts = await prisma.contact.findMany({
    where: { householdId },
    include: {
      tickets: {
        where: { status: { not: "Done" } },
        select: { id: true, title: true, status: true, priority: true },
      },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(contacts);
}

const schema = z.object({
  name: z.string().min(1),
  email: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const data = schema.parse(await req.json());
  const contact = await prisma.contact.create({
    data: { ...data, householdId },
  });
  return NextResponse.json(contact);
}

export async function PATCH(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const body = schema.extend({ id: z.string() }).parse(await req.json());
  const existing = await prisma.contact.findFirst({
    where: { id: body.id, householdId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { id, ...data } = body;
  const contact = await prisma.contact.update({ where: { id }, data });
  return NextResponse.json(contact);
}

export async function DELETE(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const { id } = z.object({ id: z.string() }).parse(await req.json());
  const existing = await prisma.contact.findFirst({ where: { id, householdId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.contact.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
