import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHousehold } from "@/lib/session";

const patchSchema = z.object({
  title: z.string().max(300).optional(),
  body: z.string().max(200_000).optional(),
  notes: z.string().max(50_000).optional().nullable(),
  mood: z.string().max(40).optional().nullable(),
  source: z.string().max(80).optional().nullable(),
  doodleData: z.string().max(6_000_000).optional().nullable(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { user } = result as { user: { id: string } };
  const { id } = await ctx.params;

  const poem = await prisma.poem.findFirst({
    where: { id, userId: user.id },
  });
  if (!poem) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(poem);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { user } = result as { user: { id: string } };
  const { id } = await ctx.params;
  const data = patchSchema.parse(await req.json());

  const existing = await prisma.poem.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const poem = await prisma.poem.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title.trim() || "Untitled" } : {}),
      ...(data.body !== undefined ? { body: data.body } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.mood !== undefined ? { mood: data.mood } : {}),
      ...(data.source !== undefined ? { source: data.source } : {}),
      ...(data.doodleData !== undefined ? { doodleData: data.doodleData } : {}),
    },
  });
  return NextResponse.json(poem);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { user } = result as { user: { id: string } };
  const { id } = await ctx.params;

  const deleted = await prisma.poem.deleteMany({
    where: { id, userId: user.id },
  });
  if (deleted.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
