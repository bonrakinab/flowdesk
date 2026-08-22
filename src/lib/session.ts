import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user, session };
}

export async function requireHousehold() {
  const result = await requireUser();
  if ("error" in result && result.error) return result;
  const { user, session } = result as {
    user: NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>;
    session: Session;
  };
  if (!user.householdId) {
    return {
      error: NextResponse.json({ error: "No household" }, { status: 400 }),
    };
  }
  return { user, session, householdId: user.householdId };
}
