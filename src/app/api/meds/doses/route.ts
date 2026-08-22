import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHousehold } from "@/lib/session";

const schema = z.object({
  medicationId: z.string(),
  scheduledFor: z.string(),
  action: z.enum(["taken", "skipped", "clear"]),
});

export async function POST(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId, user } = result as {
    householdId: string;
    user: { id: string };
  };
  const data = schema.parse(await req.json());

  const med = await prisma.medication.findFirst({
    where: { id: data.medicationId, householdId },
  });
  if (!med) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const scheduledFor = new Date(data.scheduledFor);

  if (data.action === "clear") {
    await prisma.medDoseLog.deleteMany({
      where: { medicationId: med.id, scheduledFor },
    });
    return NextResponse.json({ ok: true });
  }

  const log = await prisma.medDoseLog.upsert({
    where: {
      medicationId_scheduledFor: {
        medicationId: med.id,
        scheduledFor,
      },
    },
    create: {
      medicationId: med.id,
      scheduledFor,
      userId: user.id,
      takenAt: data.action === "taken" ? new Date() : null,
      skipped: data.action === "skipped",
    },
    update: {
      takenAt: data.action === "taken" ? new Date() : null,
      skipped: data.action === "skipped",
      userId: user.id,
    },
  });

  return NextResponse.json(log);
}
