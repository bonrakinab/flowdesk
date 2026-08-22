import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function POST(req: Request) {
  const result = await requireUser();
  if ("error" in result && result.error) return result.error;
  const { user } = result as { user: { id: string } };

  const body = z
    .object({
      endpoint: z.string().url(),
      keys: z.object({
        p256dh: z.string().min(1),
        auth: z.string().min(1),
      }),
    })
    .parse(await req.json());

  const sub = await prisma.pushSubscription.upsert({
    where: { endpoint: body.endpoint },
    create: {
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userId: user.id,
    },
    update: {
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userId: user.id,
    },
  });
  return NextResponse.json({ ok: true, id: sub.id });
}

export async function DELETE(req: Request) {
  const result = await requireUser();
  if ("error" in result && result.error) return result.error;
  const { endpoint } = z.object({ endpoint: z.string() }).parse(await req.json());
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  return NextResponse.json({ ok: true });
}
