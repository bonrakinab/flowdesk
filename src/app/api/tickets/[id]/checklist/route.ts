import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHousehold } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const { id } = await params;

  const ticket = await prisma.ticket.findFirst({ where: { id, householdId } });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = z.object({ title: z.string().min(1) }).parse(await req.json());
  const count = await prisma.checklistItem.count({ where: { ticketId: id } });
  const item = await prisma.checklistItem.create({
    data: { title: body.title, ticketId: id, sortOrder: count },
  });
  return NextResponse.json(item);
}

export async function PATCH(req: Request, { params }: Params) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const { id } = await params;

  const ticket = await prisma.ticket.findFirst({ where: { id, householdId } });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = z
    .object({
      itemId: z.string(),
      title: z.string().optional(),
      done: z.boolean().optional(),
    })
    .parse(await req.json());

  const item = await prisma.checklistItem.update({
    where: { id: body.itemId },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.done !== undefined ? { done: body.done } : {}),
    },
  });
  return NextResponse.json(item);
}
