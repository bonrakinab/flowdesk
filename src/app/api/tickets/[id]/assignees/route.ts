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
  const { userId } = z.object({ userId: z.string() }).parse(await req.json());

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, householdId },
  });
  if (!ticket)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await prisma.user.findFirst({
    where: { id: userId, householdId },
  });
  if (!member)
    return NextResponse.json({ error: "User not in household" }, { status: 400 });

  await prisma.ticketAssignee.upsert({
    where: { ticketId_userId: { ticketId, userId } },
    create: { ticketId, userId },
    update: {},
  });

  if (!ticket.assigneeId) {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { assigneeId: userId },
    });
  }

  const assignees = await prisma.ticketAssignee.findMany({
    where: { ticketId },
    include: { user: { select: { id: true, name: true, color: true } } },
  });
  return NextResponse.json(assignees);
}

export async function DELETE(req: Request, { params }: Params) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const { id: ticketId } = await params;
  const { userId } = z.object({ userId: z.string() }).parse(await req.json());

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, householdId },
  });
  if (!ticket)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.ticketAssignee.deleteMany({ where: { ticketId, userId } });

  if (ticket.assigneeId === userId) {
    const next = await prisma.ticketAssignee.findFirst({ where: { ticketId } });
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { assigneeId: next?.userId ?? null },
    });
  }

  return NextResponse.json({ ok: true });
}
