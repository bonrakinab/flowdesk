import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHousehold } from "@/lib/session";

const schema = z.object({
  category: z.string().min(1),
  limitAmount: z.number().positive(),
  scope: z.enum(["personal", "family"]).optional(),
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
  const yearMonth = url.searchParams.get("yearMonth"); // YYYY-MM for spend calc

  const where: {
    householdId: string;
    userId?: string;
    scope?: string;
  } = { householdId };

  if (scope === "personal") {
    where.userId = user.id;
    where.scope = "personal";
  } else if (scope === "family") {
    where.scope = "family";
  }

  const budgets = await prisma.financeBudget.findMany({
    where,
    orderBy: { category: "asc" },
  });

  let start: Date;
  let end: Date;
  if (yearMonth && /^\d{4}-\d{2}$/.test(yearMonth)) {
    const [y, m] = yearMonth.split("-").map(Number);
    start = new Date(y, m - 1, 1);
    end = new Date(y, m, 1);
  } else {
    const now = new Date();
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  const expenses = await prisma.financeEntry.findMany({
    where: {
      householdId,
      kind: "expense",
      occurredAt: { gte: start, lt: end },
      ...(scope === "personal"
        ? { userId: user.id, scope: "personal" }
        : scope === "family"
          ? { scope: "family" }
          : {}),
    },
  });

  const spentByCategory: Record<string, number> = {};
  for (const e of expenses) {
    spentByCategory[e.category] =
      (spentByCategory[e.category] || 0) + e.amount;
  }

  const withSpend = budgets.map((b) => {
    const spent = spentByCategory[b.category] || 0;
    return {
      ...b,
      spent,
      remaining: b.limitAmount - spent,
      over: spent > b.limitAmount,
      progress: b.limitAmount > 0 ? spent / b.limitAmount : 0,
    };
  });

  return NextResponse.json({
    budgets: withSpend,
    spentByCategory,
    period: { start: start.toISOString(), end: end.toISOString() },
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
  const scope = data.scope ?? "personal";

  const budget = await prisma.financeBudget.upsert({
    where: {
      householdId_userId_category_scope: {
        householdId,
        userId: user.id,
        category: data.category,
        scope,
      },
    },
    create: {
      category: data.category,
      limitAmount: data.limitAmount,
      scope,
      householdId,
      userId: user.id,
    },
    update: { limitAmount: data.limitAmount },
  });
  return NextResponse.json(budget);
}

export async function DELETE(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const { id } = z.object({ id: z.string() }).parse(await req.json());
  const existing = await prisma.financeBudget.findFirst({
    where: { id, householdId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.financeBudget.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
