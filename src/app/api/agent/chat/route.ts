import { NextResponse } from "next/server";
import { z } from "zod";
import {
  formatGeminiError,
  geminiConfigured,
  runGeminiAgentChat,
} from "@/lib/agent/gemini";
import { checkAgentRateLimit } from "@/lib/agent/rate-limit";
import type { AgentChatMessage } from "@/lib/agent/types";
import { requireHousehold } from "@/lib/session";

const bodySchema = z.object({
  message: z.string().min(1).max(8000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .max(32)
    .optional(),
  timezone: z.string().optional(),
});

export async function POST(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId, user } = result as {
    householdId: string;
    user: { id: string; name?: string | null };
  };

  if (!geminiConfigured()) {
    return NextResponse.json(
      {
        error:
          "Agent is not configured. Set GEMINI_API_KEY on the server (Google AI Studio).",
        code: "NO_GEMINI_KEY",
      },
      { status: 503 }
    );
  }

  const limited = checkAgentRateLimit(user.id);
  if (!limited.ok) {
    return NextResponse.json(
      {
        error: `Too many agent requests. Try again in ${limited.retryAfterSec}s.`,
      },
      { status: 429 }
    );
  }

  try {
    const body = bodySchema.parse(await req.json());
    const history = (body.history || []) as AgentChatMessage[];
    const { reply, proposals, toolNames } = await runGeminiAgentChat({
      ctx: {
        householdId,
        userId: user.id,
        userName: user.name || "You",
        nowIso: new Date().toISOString(),
        timezoneHint: body.timezone || "UTC",
      },
      messages: history,
      userMessage: body.message,
    });

    console.info("[agent/chat]", {
      userId: user.id,
      tools: toolNames,
      proposals: proposals.length,
    });

    return NextResponse.json({
      reply,
      proposals,
      configured: true,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.issues[0]?.message || "Invalid request" },
        { status: 400 }
      );
    }
    console.error("[agent/chat]", e);
    const formatted = formatGeminiError(e);
    return NextResponse.json(
      { error: formatted.message, code: formatted.code },
      { status: formatted.status }
    );
  }
}

export async function GET() {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  return NextResponse.json({ configured: geminiConfigured() });
}
