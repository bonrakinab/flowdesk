import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHousehold } from "@/lib/session";

export async function GET(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId, user } = result as {
    householdId: string;
    user: { id: string };
  };

  const all = new URL(req.url).searchParams.get("all") === "1";

  const reminders = await prisma.reminder.findMany({
    where: {
      ...(all ? {} : { done: false }),
      OR: [
        { ticket: { householdId } },
        { event: { householdId } },
        {
          ticketId: null,
          eventId: null,
          OR: [{ householdId }, { userId: user.id }],
        },
      ],
    },
    include: {
      ticket: { select: { id: true, title: true } },
      event: { select: { id: true, title: true } },
    },
    orderBy: { remindAt: "asc" },
  });
  return NextResponse.json(reminders);
}

const schema = z.object({
  title: z.string().optional(),
  remindAt: z.string(),
  ticketId: z.string().optional().nullable(),
  eventId: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId, user } = result as {
    householdId: string;
    user: { id: string };
  };

  const data = schema.parse(await req.json());
  const reminder = await prisma.reminder.create({
    data: {
      title: data.title,
      remindAt: new Date(data.remindAt),
      ticketId: data.ticketId,
      eventId: data.eventId,
      userId: user.id,
      householdId,
    },
  });
  return NextResponse.json(reminder);
}

export async function PATCH(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;

  const body = z
    .object({
      id: z.string(),
      done: z.boolean().optional(),
      remindAt: z.string().optional(),
      title: z.string().optional(),
    })
    .parse(await req.json());

  const reminder = await prisma.reminder.update({
    where: { id: body.id },
    data: {
      done: body.done,
      title: body.title,
      remindAt: body.remindAt ? new Date(body.remindAt) : undefined,
    },
  });
  return NextResponse.json(reminder);
}
