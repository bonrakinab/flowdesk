import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHousehold } from "@/lib/session";

const poemInput = z.object({
  title: z.string().max(300).optional(),
  body: z.string().max(200_000).optional(),
  notes: z.string().max(50_000).optional().nullable(),
  mood: z.string().max(40).optional().nullable(),
  source: z.string().max(80).optional().nullable(),
  doodleData: z.string().max(6_000_000).optional().nullable(),
});

const createSchema = z.union([
  poemInput,
  z.object({
    poems: z.array(poemInput).min(1).max(50),
  }),
]);

export async function GET() {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { user } = result as { user: { id: string } };

  const poems = await prisma.poem.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      mood: true,
      source: true,
      createdAt: true,
      updatedAt: true,
      body: true,
      doodleData: true,
    },
  });

  return NextResponse.json(
    poems.map((p) => ({
      id: p.id,
      title: p.title,
      mood: p.mood,
      source: p.source,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      hasDoodle: Boolean(p.doodleData),
      preview: p.body.slice(0, 120),
    }))
  );
}

export async function POST(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { user } = result as { user: { id: string } };
  const raw = createSchema.parse(await req.json());

  if ("poems" in raw) {
    const created = await prisma.$transaction(
      raw.poems.map((p) =>
        prisma.poem.create({
          data: {
            userId: user.id,
            title: (p.title?.trim() || "Untitled").slice(0, 300),
            body: p.body ?? "",
            notes: p.notes ?? null,
            mood: p.mood ?? null,
            source: p.source ?? "Import",
            doodleData: p.doodleData ?? null,
          },
        })
      )
    );
    return NextResponse.json(created, { status: 201 });
  }

  const poem = await prisma.poem.create({
    data: {
      userId: user.id,
      title: (raw.title?.trim() || "Untitled").slice(0, 300),
      body: raw.body ?? "",
      notes: raw.notes ?? null,
      mood: raw.mood ?? null,
      source: raw.source ?? null,
      doodleData: raw.doodleData ?? null,
    },
  });
  return NextResponse.json(poem, { status: 201 });
}
