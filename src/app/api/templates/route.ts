import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHousehold } from "@/lib/session";

function serialize(t: { itemsJson: string }) {
  let items: string[] = [];
  try {
    items = JSON.parse(t.itemsJson);
  } catch {
    items = [];
  }
  return { ...t, items };
}

export async function GET() {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };

  const templates = await prisma.template.findMany({
    where: { householdId },
    include: { user: { select: { id: true, name: true, color: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(templates.map(serialize));
}

const createSchema = z.object({
  kind: z.enum(["shopping", "meal", "chore"]),
  title: z.string().min(1),
  items: z.array(z.string()).optional(),
  note: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId, user } = result as {
    householdId: string;
    user: { id: string };
  };

  const body = await req.json();

  if (body?.apply && body?.id) {
    const template = await prisma.template.findFirst({
      where: { id: body.id, householdId },
    });
    if (!template)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    let items: string[] = [];
    try {
      items = JSON.parse(template.itemsJson);
    } catch {
      items = [];
    }

    const ticket = await prisma.ticket.create({
      data: {
        title: template.title,
        description: template.note,
        type: template.kind === "chore" ? "chore" : "task",
        status: "Ready",
        priority: "P2",
        householdId,
        assigneeId: user.id,
        createdById: user.id,
        checklist: items.length
          ? {
              create: items.map((title, i) => ({ title, sortOrder: i })),
            }
          : undefined,
        activities: {
          create: {
            message: `created from template "${template.title}"`,
            userId: user.id,
          },
        },
      },
      include: { checklist: true },
    });
    return NextResponse.json(ticket);
  }

  try {
    const data = createSchema.parse(body);
    const template = await prisma.template.create({
      data: {
        kind: data.kind,
        title: data.title,
        note: data.note,
        itemsJson: JSON.stringify(data.items || []),
        householdId,
        userId: user.id,
      },
    });
    return NextResponse.json(serialize(template));
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const body = createSchema
    .partial()
    .extend({ id: z.string() })
    .parse(await req.json());

  const existing = await prisma.template.findFirst({
    where: { id: body.id, householdId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { id, items, ...rest } = body;
  const template = await prisma.template.update({
    where: { id },
    data: {
      ...rest,
      itemsJson: items !== undefined ? JSON.stringify(items) : undefined,
    },
  });
  return NextResponse.json(serialize(template));
}

export async function DELETE(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const { id } = z.object({ id: z.string() }).parse(await req.json());
  const existing = await prisma.template.findFirst({ where: { id, householdId } });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.template.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
