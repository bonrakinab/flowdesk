import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function DELETE(req: Request) {
  const result = await requireUser();
  if ("error" in result && result.error) return result.error;
  const { user } = result as { user: { id: string } };

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider") || "google";

  const account = await prisma.account.findFirst({
    where: { userId: user.id, provider },
  });
  if (!account) {
    return NextResponse.json({ error: "Not linked" }, { status: 404 });
  }

  const userFull = await prisma.user.findUnique({ where: { id: user.id } });
  if (!userFull?.passwordHash) {
    const count = await prisma.account.count({ where: { userId: user.id } });
    if (count <= 1) {
      return NextResponse.json(
        { error: "Set a password before unlinking your only sign-in method" },
        { status: 400 }
      );
    }
  }

  await prisma.account.delete({ where: { id: account.id } });
  return NextResponse.json({ ok: true });
}
