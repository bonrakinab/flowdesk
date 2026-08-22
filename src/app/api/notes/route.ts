import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHousehold } from "@/lib/session";

export async function GET() {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId } = result as { householdId: string };

  const [notes, folders] = await Promise.all([
    prisma.note.findMany({
      where: { householdId },
      include: {
        folder: true,
        lastEditedBy: { select: { id: true, name: true, color: true } },
      },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.noteFolder.findMany({
      where: { householdId },
      orderBy: { name: "asc" },
    }),
  ]);
  return NextResponse.json({ notes, folders });
}

const schema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  mood: z.string().optional().nullable(),
  pinned: z.boolean().optional(),
  folderId: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId, user } = result as {
    householdId: string;
    user: { id: string };
  };

  const data = schema.parse(await req.json());
  const note = await prisma.note.create({
    data: {
      title: data.title || "Untitled",
      content: data.content,
      mood: data.mood,
      pinned: data.pinned ?? false,
      folderId: data.folderId,
      householdId,
      lastEditedById: user.id,
    },
    include: { folder: true },
  });
  return NextResponse.json(note);
}
