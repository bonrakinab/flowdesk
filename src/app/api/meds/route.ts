import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHousehold } from "@/lib/session";
import {
  buildTodayDoses,
  parseTimesJson,
  wallDayFor,
} from "@/lib/meds";

export async function GET(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId, user } = result as {
    householdId: string;
    user: { id: string };
  };

  const url = new URL(req.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const tzRaw = url.searchParams.get("tzOffset");
  const tzOffsetMinutes =
    tzRaw != null && tzRaw !== ""
      ? Number(tzRaw)
      : undefined;

  if (tzOffsetMinutes != null && Number.isFinite(tzOffsetMinutes)) {
    void prisma.user
      .update({
        where: { id: user.id },
        data: { tzOffsetMinutes: Math.round(tzOffsetMinutes) },
      })
      .catch(() => null);
  }

  const now = new Date();
  const logFrom = fromParam
    ? new Date(fromParam)
    : new Date(wallDayFor(now, tzOffsetMinutes).getTime() - 12 * 60 * 60_000);
  const logTo = toParam
    ? new Date(toParam)
    : new Date(wallDayFor(now, tzOffsetMinutes).getTime() + 36 * 60 * 60_000);

  const meds = await prisma.medication.findMany({
    where: { householdId, active: true },
    include: {
      doseLogs: {
        where: {
          scheduledFor: { gte: logFrom, lte: logTo },
        },
      },
      user: { select: { id: true, name: true, color: true } },
    },
    orderBy: { name: "asc" },
  });

  const today = wallDayFor(now, tzOffsetMinutes);
  const todayDoses = buildTodayDoses(meds, today, tzOffsetMinutes).map((d) => ({
    ...d,
    scheduledFor: d.scheduledFor.toISOString(),
    takenAt: d.takenAt?.toISOString() ?? null,
  }));

  return NextResponse.json({
    medications: meds.map((m) => ({
      ...m,
      times: parseTimesJson(m.timesJson),
    })),
    todayDoses,
  });
}

const createSchema = z.object({
  name: z.string().min(1),
  dosage: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  color: z.string().optional(),
  times: z.array(z.string().regex(/^\d{1,2}:\d{2}$/)).min(1),
  remindMinutesBefore: z.number().int().min(0).max(24 * 60).optional(),
});

export async function POST(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId, user } = result as {
    householdId: string;
    user: { id: string };
  };
  const data = createSchema.parse(await req.json());
  const times = data.times.map((t) => {
    const [h, m] = t.split(":");
    return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
  });

  const med = await prisma.medication.create({
    data: {
      name: data.name,
      dosage: data.dosage ?? null,
      note: data.note ?? null,
      color: data.color || "#0d9488",
      timesJson: JSON.stringify(times),
      remindMinutesBefore: data.remindMinutesBefore ?? 15,
      householdId,
      userId: user.id,
    },
  });
  return NextResponse.json({
    ...med,
    times,
  });
}

export async function PATCH(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const body = createSchema
    .partial()
    .extend({
      id: z.string(),
      active: z.boolean().optional(),
      times: z.array(z.string().regex(/^\d{1,2}:\d{2}$/)).optional(),
      remindMinutesBefore: z.number().int().min(0).max(24 * 60).optional(),
    })
    .parse(await req.json());

  const existing = await prisma.medication.findFirst({
    where: { id: body.id, householdId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { id, times, ...rest } = body;
  const med = await prisma.medication.update({
    where: { id },
    data: {
      ...rest,
      ...(times
        ? {
            timesJson: JSON.stringify(
              times.map((t) => {
                const [h, m] = t.split(":");
                return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
              })
            ),
          }
        : {}),
    },
  });
  return NextResponse.json({
    ...med,
    times: parseTimesJson(med.timesJson),
  });
}

export async function DELETE(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };
  const { id } = z.object({ id: z.string() }).parse(await req.json());
  const existing = await prisma.medication.findFirst({
    where: { id, householdId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.medication.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
