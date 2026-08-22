import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHousehold } from "@/lib/session";
import {
  calculateBdTax,
  type TaxpayerCategory,
} from "@/lib/bd-tax";

const yearMonthRe = /^\d{4}-\d{2}$/;

const schema = z.object({
  yearMonth: z.string().regex(yearMonthRe),
  scope: z.enum(["personal", "family"]).optional(),
  grossPay: z.number().min(0).optional(),
  tax: z.number().min(0).optional(),
  netPay: z.number().min(0).optional(),
  income: z.number().min(0).optional(),
  expense: z.number().min(0).optional(),
  saved: z.number().min(0).optional(),
  taxCategory: z
    .enum([
      "general",
      "woman_or_senior",
      "third_gender_or_disabled",
      "freedom_fighter",
    ])
    .optional(),
  note: z.string().optional().nullable(),
  /** When true, fill income/expense from FinanceEntry for that month */
  fromEntries: z.boolean().optional(),
});

function monthBounds(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  return { start, end };
}

export async function GET(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId, user } = result as {
    householdId: string;
    user: { id: string };
  };

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") || "all";
  const yearMonth = url.searchParams.get("yearMonth");

  const where: {
    householdId: string;
    userId?: string;
    scope?: string;
    yearMonth?: string;
  } = { householdId };

  if (scope === "personal") {
    where.userId = user.id;
    where.scope = "personal";
  } else if (scope === "family") {
    where.scope = "family";
  }

  if (yearMonth && yearMonthRe.test(yearMonth)) {
    where.yearMonth = yearMonth;
  }

  const months = await prisma.financeMonth.findMany({
    where,
    include: { user: { select: { id: true, name: true, color: true } } },
    orderBy: { yearMonth: "desc" },
  });

  return NextResponse.json({ months });
}

export async function POST(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId, user } = result as {
    householdId: string;
    user: { id: string };
  };
  const data = schema.parse(await req.json());
  const scope = data.scope ?? "personal";
  const taxCategory = (data.taxCategory ?? "general") as TaxpayerCategory;

  let income = data.income ?? 0;
  let expense = data.expense ?? 0;

  if (data.fromEntries !== false) {
    const { start, end } = monthBounds(data.yearMonth);
    const entryWhere: {
      householdId: string;
      occurredAt: { gte: Date; lt: Date };
      userId?: string;
      scope?: string;
    } = {
      householdId,
      occurredAt: { gte: start, lt: end },
    };
    if (scope === "personal") {
      entryWhere.userId = user.id;
      entryWhere.scope = "personal";
    } else {
      entryWhere.scope = "family";
    }

    const entries = await prisma.financeEntry.findMany({ where: entryWhere });
    income = entries
      .filter((e) => e.kind === "income")
      .reduce((s, e) => s + e.amount, 0);
    expense = entries
      .filter((e) => e.kind === "expense")
      .reduce((s, e) => s + e.amount, 0);
  }

  const grossPay = data.grossPay ?? income;
  // Annualize monthly gross for slab tax, then take 1/12
  const annual = calculateBdTax({
    annualIncome: grossPay * 12,
    category: taxCategory,
  });
  const tax = data.tax ?? annual.monthlyTax;
  const netPay = data.netPay ?? Math.max(0, Math.round(grossPay - tax));
  const saved = data.saved ?? Math.max(0, netPay - expense);

  const month = await prisma.financeMonth.upsert({
    where: {
      householdId_userId_yearMonth_scope: {
        householdId,
        userId: user.id,
        yearMonth: data.yearMonth,
        scope,
      },
    },
    create: {
      yearMonth: data.yearMonth,
      scope,
      grossPay,
      tax,
      netPay,
      income,
      expense,
      saved,
      taxCategory,
      note: data.note ?? null,
      householdId,
      userId: user.id,
    },
    update: {
      grossPay,
      tax,
      netPay,
      income,
      expense,
      saved,
      taxCategory,
      note: data.note ?? null,
    },
    include: { user: { select: { id: true, name: true, color: true } } },
  });

  return NextResponse.json(month);
}

export async function PATCH(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const body = schema
    .partial()
    .extend({ id: z.string() })
    .parse(await req.json());

  const existing = await prisma.financeMonth.findFirst({
    where: { id: body.id, householdId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { id, ...rest } = body;
  const update: Record<string, unknown> = { ...rest };
  delete update.fromEntries;

  // Keep net consistent if gross/tax change without explicit net
  if (
    (rest.grossPay !== undefined || rest.tax !== undefined) &&
    rest.netPay === undefined
  ) {
    const g = rest.grossPay ?? existing.grossPay;
    const t = rest.tax ?? existing.tax;
    update.netPay = Math.max(0, Math.round(g - t));
  }

  const month = await prisma.financeMonth.update({
    where: { id },
    data: update,
    include: { user: { select: { id: true, name: true, color: true } } },
  });
  return NextResponse.json(month);
}

export async function DELETE(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const { id } = z.object({ id: z.string() }).parse(await req.json());
  const existing = await prisma.financeMonth.findFirst({
    where: { id, householdId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.financeMonth.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
