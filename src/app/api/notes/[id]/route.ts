import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHousehold } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const { id } = await params;

  const note = await prisma.note.findFirst({
    where: { id, householdId },
    include: {
      folder: true,
      lastEditedBy: { select: { id: true, name: true, color: true } },
    },
  });
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(note);
}

export async function PATCH(req: Request, { params }: Params) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId, user } = result as {
    householdId: string;
    user: { id: string };
  };
  const { id } = await params;

  const existing = await prisma.note.findFirst({ where: { id, householdId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const schema = z.object({
    title: z.string().optional(),
    content: z.string().optional(),
    mood: z.string().optional().nullable(),
    pinned: z.boolean().optional(),
    folderId: z.string().optional().nullable(),
  });
  const data = schema.parse(await req.json());

  const note = await prisma.note.update({
    where: { id },
    data: { ...data, lastEditedById: user.id },
    include: {
      folder: true,
      lastEditedBy: { select: { id: true, name: true, color: true } },
    },
  });
  return NextResponse.json(note);
}

export async function DELETE(_req: Request, { params }: Params) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const { id } = await params;

  const existing = await prisma.note.findFirst({ where: { id, householdId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.note.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
