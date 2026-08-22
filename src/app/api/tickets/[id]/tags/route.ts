import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHousehold } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const { id: ticketId } = await params;
  const { tagId, tagName } = z
    .object({
      tagId: z.string().optional(),
      tagName: z.string().optional(),
    })
    .parse(await req.json());

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, householdId },
  });
  if (!ticket)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  let resolvedTagId = tagId;
  if (!resolvedTagId && tagName) {
    const tag = await prisma.tag.upsert({
      where: {
        householdId_name: { householdId, name: tagName.trim() },
      },
      create: { name: tagName.trim(), householdId },
      update: {},
    });
    resolvedTagId = tag.id;
  }
  if (!resolvedTagId) {
    return NextResponse.json({ error: "tagId or tagName required" }, { status: 400 });
  }

  const tag = await prisma.tag.findFirst({
    where: { id: resolvedTagId, householdId },
  });
  if (!tag) return NextResponse.json({ error: "Tag not found" }, { status: 404 });

  await prisma.ticketTag.upsert({
    where: {
      ticketId_tagId: { ticketId, tagId: tag.id },
    },
    create: { ticketId, tagId: tag.id },
    update: {},
  });

  const tags = await prisma.ticketTag.findMany({
    where: { ticketId },
    include: { tag: true },
  });
  return NextResponse.json(tags);
}

export async function DELETE(req: Request, { params }: Params) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const { id: ticketId } = await params;
  const { tagId } = z.object({ tagId: z.string() }).parse(await req.json());

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, householdId },
  });
  if (!ticket)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.ticketTag.deleteMany({ where: { ticketId, tagId } });
  return NextResponse.json({ ok: true });
}
