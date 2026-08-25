import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const PROVIDER = "google_health";

/** Disconnect Google Health while keeping previously synced data. */
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email.toLowerCase() },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await prisma.fitnessConnection.deleteMany({
      where: { userId: user.id, provider: PROVIDER },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disconnecting Google Health:", error);
    return NextResponse.json(
      { error: "Failed to disconnect Google Health" },
      { status: 500 }
    );
  }
}
