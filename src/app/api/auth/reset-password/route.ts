import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const { token, password } = z
    .object({
      token: z.string().min(10),
      password: z.string().min(6),
    })
    .parse(await req.json());

  const record = await prisma.verificationToken.findUnique({
    where: { token },
  });
  if (!record || record.expires < new Date()) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 400 }
    );
  }

  const hash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { email: record.identifier },
    data: { passwordHash: hash },
  });
  await prisma.verificationToken.deleteMany({
    where: { identifier: record.identifier },
  });

  return NextResponse.json({ ok: true });
}
