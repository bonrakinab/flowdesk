import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Disconnect Google Health API
 * DELETE /api/fitness/disconnect
 */
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Delete fitness connection
    await prisma.fitnessConnection.delete({
      where: {
        userId_provider: {
          userId: user.id,
          provider: 'google_health',
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting fitness:', error);
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 500 }
    );
  }
}
