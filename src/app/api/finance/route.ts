import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHousehold } from "@/lib/session";

const schema = z.object({
  kind: z.enum(["income", "expense"]),
  title: z.string().min(1),
  amount: z.number().positive(),
  category: z.string().optional(),
  scope: z.enum(["personal", "family"]).optional(),
  occurredAt: z.string().optional(),
  note: z.string().optional().nullable(),
  recurring: z.boolean().optional(),
});

export async function GET(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId, user } = result as {
    householdId: string;
    user: { id: string };
  };

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") || "all";
  const kind = url.searchParams.get("kind");

  const where: {
    householdId: string;
    userId?: string;
    kind?: string;
    scope?: string;
  } = { householdId };

  if (scope === "personal") {
    where.userId = user.id;
    where.scope = "personal";
  } else if (scope === "family") {
    where.scope = "family";
  }

  if (kind === "income" || kind === "expense") {
    where.kind = kind;
  }

  const entries = await prisma.financeEntry.findMany({
    where,
    include: { user: { select: { id: true, name: true, color: true } } },
    orderBy: { occurredAt: "desc" },
  });

  const income = entries
    .filter((e) => e.kind === "income")
    .reduce((s, e) => s + e.amount, 0);
  const expense = entries
    .filter((e) => e.kind === "expense")
    .reduce((s, e) => s + e.amount, 0);

  return NextResponse.json({
    entries,
    summary: {
      income,
      expense,
      net: income - expense,
      savingsRate: income > 0 ? (income - expense) / income : 0,
    },
  });
}

export async function POST(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId, user } = result as {
    householdId: string;
    user: { id: string };
  };
  const data = schema.parse(await req.json());

  const entry = await prisma.financeEntry.create({
    data: {
      kind: data.kind,
      title: data.title,
      amount: data.amount,
      category: data.category ?? "general",
      scope: data.scope ?? "personal",
      occurredAt: data.occurredAt ? new Date(data.occurredAt) : new Date(),
      note: data.note ?? null,
      recurring: data.recurring ?? false,
      householdId,
      userId: user.id,
    },
    include: { user: { select: { id: true, name: true, color: true } } },
  });
  return NextResponse.json(entry);
}

export async function PATCH(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const body = schema
    .partial()
    .extend({ id: z.string() })
    .parse(await req.json());

  const existing = await prisma.financeEntry.findFirst({
    where: { id: body.id, householdId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { id, occurredAt, ...rest } = body;
  const entry = await prisma.financeEntry.update({
    where: { id },
    data: {
      ...rest,
      ...(occurredAt ? { occurredAt: new Date(occurredAt) } : {}),
    },
    include: { user: { select: { id: true, name: true, color: true } } },
  });
  return NextResponse.json(entry);
}

export async function DELETE(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const { id } = z.object({ id: z.string() }).parse(await req.json());
  const existing = await prisma.financeEntry.findFirst({
    where: { id, householdId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.financeEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
