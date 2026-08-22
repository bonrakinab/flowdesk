import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function GET() {
  const result = await requireUser();
  if ("error" in result && result.error) return result.error;

  const { user } = result as { user: { id: string } };
  const full = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      household: { include: { users: { select: { id: true, name: true, email: true, color: true, image: true } } } },
      accounts: {
        select: {
          provider: true,
          id: true,
          scope: true,
          providerAccountId: true,
        },
      },
    },
  });
  return NextResponse.json(full);
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  color: z.string().optional(),
  alertEmail: z.boolean().optional(),
  alertSms: z.boolean().optional(),
  phone: z.string().max(32).optional().nullable(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).optional(),
});

export async function PATCH(req: Request) {
  const result = await requireUser();
  if ("error" in result && result.error) return result.error;
  const { user } = result as {
    user: { id: string; passwordHash: string | null; email: string };
  };

  try {
    const data = updateSchema.parse(await req.json());
    const update: {
      name?: string;
      email?: string;
      color?: string;
      alertEmail?: boolean;
      alertSms?: boolean;
      phone?: string | null;
      passwordHash?: string;
    } = {};

    if (data.name) update.name = data.name;
    if (data.color) {
      update.color = data.color;
    }
    if (typeof data.alertEmail === "boolean") {
      update.alertEmail = data.alertEmail;
    }
    if (typeof data.alertSms === "boolean") {
      update.alertSms = data.alertSms;
    }
    if (data.phone !== undefined) {
      const raw = data.phone?.trim() || null;
      update.phone = raw;
    }
    if (data.email && data.email.toLowerCase() !== user.email) {
      const taken = await prisma.user.findUnique({
        where: { email: data.email.toLowerCase() },
      });
      if (taken) {
        return NextResponse.json({ error: "Email taken" }, { status: 400 });
      }
      update.email = data.email.toLowerCase();
    }
    if (data.newPassword) {
      if (!user.passwordHash) {
        update.passwordHash = await bcrypt.hash(data.newPassword, 10);
      } else {
        if (!data.currentPassword) {
          return NextResponse.json(
            { error: "Current password required" },
            { status: 400 }
          );
        }
        const ok = await bcrypt.compare(data.currentPassword, user.passwordHash);
        if (!ok) {
          return NextResponse.json(
            { error: "Current password incorrect" },
            { status: 400 }
          );
        }
        update.passwordHash = await bcrypt.hash(data.newPassword, 10);
      }
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: update,
    });
    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      color: updated.color,
      alertEmail: updated.alertEmail,
      alertSms: updated.alertSms,
      phone: updated.phone,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE() {
  const result = await requireUser();
  if ("error" in result && result.error) return result.error;
  const { user } = result as { user: { id: string; householdId: string | null } };

  const householdId = user.householdId;
  await prisma.user.delete({ where: { id: user.id } });

  if (householdId) {
    const remaining = await prisma.user.count({ where: { householdId } });
    if (remaining === 0) {
      await prisma.household.delete({ where: { id: householdId } });
    }
  }

  return NextResponse.json({ ok: true });
}
