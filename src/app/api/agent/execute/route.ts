import { NextResponse } from "next/server";
import { z } from "zod";
import { checkAgentRateLimit } from "@/lib/agent/rate-limit";
import {
  executeConfirmedProposals,
  executeProposalSchema,
} from "@/lib/agent/tools";
import { requireHousehold } from "@/lib/session";

const bodySchema = z.object({
  proposals: z.array(executeProposalSchema).min(1).max(12),
});

export async function POST(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId, user } = result as {
    householdId: string;
    user: { id: string; name?: string | null };
  };

  const limited = checkAgentRateLimit(`exec:${user.id}`, 30, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      {
        error: `Too many confirmations. Try again in ${limited.retryAfterSec}s.`,
      },
      { status: 429 }
    );
  }

  try {
    const body = bodySchema.parse(await req.json());
    const results = await executeConfirmedProposals(body.proposals, {
      householdId,
      userId: user.id,
      userName: user.name || "You",
      nowIso: new Date().toISOString(),
      timezoneHint: "server",
    });

    console.info("[agent/execute]", {
      userId: user.id,
      count: results.length,
      ok: results.filter((r) => r.ok).length,
    });

    return NextResponse.json({ results });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.issues[0]?.message || "Invalid proposals" },
        { status: 400 }
      );
    }
    console.error("[agent/execute]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Execute failed" },
      { status: 500 }
    );
  }
}
