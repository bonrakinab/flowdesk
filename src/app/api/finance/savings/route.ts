import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHousehold } from "@/lib/session";

const schema = z.object({
  title: z.string().min(1),
  targetAmount: z.number().positive(),
  currentAmount: z.number().min(0).optional(),
  scope: z.enum(["personal", "family"]).optional(),
  deadline: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
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

  const goals = await prisma.savingsGoal.findMany({
    where,
    include: { user: { select: { id: true, name: true, color: true } } },
    orderBy: { updatedAt: "desc" },
  });

  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
  const totalCurrent = goals.reduce((s, g) => s + g.currentAmount, 0);

  return NextResponse.json({
    goals,
    summary: {
      totalTarget,
      totalCurrent,
      remaining: Math.max(0, totalTarget - totalCurrent),
      progress: totalTarget > 0 ? totalCurrent / totalTarget : 0,
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

  const goal = await prisma.savingsGoal.create({
    data: {
      title: data.title,
      targetAmount: data.targetAmount,
      currentAmount: data.currentAmount ?? 0,
      scope: data.scope ?? "personal",
      deadline: data.deadline ? new Date(data.deadline) : null,
      note: data.note ?? null,
      householdId,
      userId: user.id,
    },
    include: { user: { select: { id: true, name: true, color: true } } },
  });
  return NextResponse.json(goal);
}

export async function PATCH(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const body = schema
    .partial()
    .extend({
      id: z.string(),
      addAmount: z.number().optional(),
    })
    .parse(await req.json());

  const existing = await prisma.savingsGoal.findFirst({
    where: { id: body.id, householdId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { id, deadline, addAmount, ...rest } = body;
  const goal = await prisma.savingsGoal.update({
    where: { id },
    data: {
      ...rest,
      ...(deadline !== undefined
        ? { deadline: deadline ? new Date(deadline) : null }
        : {}),
      ...(addAmount !== undefined
        ? { currentAmount: existing.currentAmount + addAmount }
        : {}),
    },
    include: { user: { select: { id: true, name: true, color: true } } },
  });
  return NextResponse.json(goal);
}

export async function DELETE(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const { id } = z.object({ id: z.string() }).parse(await req.json());
  const existing = await prisma.savingsGoal.findFirst({
    where: { id, householdId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.savingsGoal.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
