import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { appBaseUrl } from "@/lib/app-url";

export async function POST(req: Request) {
  const { email } = z
    .object({ email: z.string().email() })
    .parse(await req.json());
  const normalized = email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });

  // Always return ok to avoid email enumeration
  if (!user?.passwordHash) {
    return NextResponse.json({ ok: true });
  }

  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.verificationToken.deleteMany({
    where: { identifier: normalized },
  });
  await prisma.verificationToken.create({
    data: { identifier: normalized, token, expires },
  });

  const link = `${appBaseUrl()}/reset-password?token=${token}`;

  const mail = await sendMail({
    to: normalized,
    subject: "Reset your Flowdesk password",
    html: `<p>Reset your password:</p><p><a href="${link}">${link}</a></p><p>Expires in 1 hour.</p>`,
    text: `Reset your password: ${link}\nExpires in 1 hour.`,
  });

  return NextResponse.json({
    ok: true,
    ...(process.env.NODE_ENV === "development" && mail.devLink
      ? { devLink: mail.devLink }
      : {}),
  });
}
