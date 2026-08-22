import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateInviteCode, MEMBER_COLORS } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  inviteCode: z.string().optional(),
  householdName: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    const email = data.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    let householdId: string;
    const color =
      MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)];

    if (data.inviteCode) {
      const household = await prisma.household.findUnique({
        where: { inviteCode: data.inviteCode.toUpperCase() },
      });
      if (!household) {
        return NextResponse.json(
          { error: "Invalid invite code" },
          { status: 400 }
        );
      }
      householdId = household.id;
    } else {
      const household = await prisma.household.create({
        data: {
          name: data.householdName || `${data.name}'s Household`,
          inviteCode: generateInviteCode(),
          folders: {
            create: [
              { name: "Personal" },
              { name: "Family" },
              { name: "Ideas" },
              { name: "Meeting notes" },
            ],
          },
          projects: {
            create: [
              { name: "Work", color: "#0284c7" },
              { name: "Home", color: "#d97706" },
              { name: "Family", color: "#e11d48" },
              { name: "Side", color: "#7c3aed" },
            ],
          },
        },
      });
      householdId = household.id;
    }

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email,
        passwordHash,
        color,
        householdId,
      },
    });

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Signup failed" }, { status: 500 });
  }
}
