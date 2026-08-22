import { GoogleGenAI } from "@google/genai";
import { buildClockContext, extractDateHints } from "./date-context";
import { buildSystemPrompt } from "./system-prompt";
import {
  geminiInteractionTools,
  loadAgentBootstrap,
  runAgentTool,
} from "./tools";
import type { AgentChatMessage, AgentContext, AgentProposal } from "./types";

const MAX_ROUNDS = 8;

export function geminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function geminiModelName() {
  return process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
}

/** Turn Gemini SDK / HTTP errors into short UI-friendly messages. */
export function formatGeminiError(err: unknown): {
  message: string;
  status: number;
  code?: string;
} {
  const raw = err instanceof Error ? err.message : String(err);
  const is429 =
    /\b429\b/.test(raw) ||
    /Too Many Requests/i.test(raw) ||
    /exceeded your current quota/i.test(raw);
  if (is429) {
    const retry = raw.match(/retry in ([\d.]+)s/i)?.[1];
    const wait = retry ? Math.ceil(Number(retry)) : 40;
    return {
      status: 429,
      code: "GEMINI_QUOTA",
      message: `Gemini free-tier quota is exhausted for this model. Wait ~${wait}s and try again, or enable billing in Google AI Studio.`,
    };
  }
  if (/Role 'function' is not supported/i.test(raw)) {
    return {
      status: 502,
      code: "GEMINI_SDK",
      message:
        "Gemini rejected the old tool-call format. Redeploy should fix this — refresh and try again.",
    };
  }
  if (/no longer available|404 Not Found|is not found/i.test(raw)) {
    return {
      status: 502,
      code: "GEMINI_MODEL",
      message:
        "That Gemini model is unavailable for this API key. Update GEMINI_MODEL (try gemini-3.6-flash).",
    };
  }
  if (/API key|PERMISSION_DENIED|401|403/i.test(raw)) {
    return {
      status: 401,
      code: "GEMINI_AUTH",
      message:
        "Gemini rejected the API key. Check GEMINI_API_KEY in Vercel (Google AI Studio).",
    };
  }
  const short = raw.replace(/\[\{[\s\S]*$/m, "").trim();
  return {
    status: 500,
    message: short.slice(0, 280) || "Agent request failed",
  };
}

type FunctionCallStep = {
  type: "function_call";
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

function isFunctionCallStep(step: unknown): step is FunctionCallStep {
  return (
    !!step &&
    typeof step === "object" &&
    (step as { type?: string }).type === "function_call" &&
    typeof (step as { name?: string }).name === "string" &&
    typeof (step as { id?: string }).id === "string"
  );
}

function extractModelText(steps: unknown[]): string {
  const parts: string[] = [];
  for (const step of steps) {
    if (!step || typeof step !== "object") continue;
    if ((step as { type?: string }).type !== "model_output") continue;
    const content = (step as { content?: unknown }).content;
    if (typeof content === "string") {
      parts.push(content);
      continue;
    }
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      if (c && typeof c === "object" && "text" in c) {
        parts.push(String((c as { text?: string }).text || ""));
      }
    }
  }
  return parts.join("").trim();
}

export async function runGeminiAgentChat(opts: {
  ctx: AgentContext;
  messages: AgentChatMessage[];
  userMessage: string;
}): Promise<{ reply: string; proposals: AgentProposal[]; toolNames: string[] }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const now = new Date(opts.ctx.nowIso);
  const clock = buildClockContext(now, opts.ctx.timezoneHint);
  const dateHints = extractDateHints(
    opts.userMessage,
    now,
    opts.ctx.timezoneHint
  );

  const boot = await loadAgentBootstrap(opts.ctx.householdId);
  const systemInstruction = buildSystemPrompt(opts.ctx, {
    projects: boot.projects
      .map((p) => `- ${p.name} (${p.id})`)
      .join("\n"),
    members: boot.members
      .map((m) => `- ${m.name || m.email} (${m.id})`)
      .join("\n"),
    todayHint: [
      `Due tickets: ${boot.dueTickets.length}`,
      `Events today: ${boot.events.length}`,
      `Active meds: ${boot.meds.length}`,
      `Reminders today: ${boot.reminders.length}`,
    ].join(" · "),
    clock,
    dateHints,
  });

  const prior = opts.messages
    .filter((m) => m.content.trim())
    .slice(-10)
    .map((m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content}`)
    .join("\n");

  const enrichedUserMessage = [
    prior ? `Prior conversation:\n${prior}\n\nCurrent request:` : "",
    opts.userMessage.trim(),
    dateHints.length
      ? `\n\n[Resolved date hints — use these ISO values in tools]\n${dateHints
          .map(
            (h) =>
              `- "${h.phrase}" → ${h.startIso}${
                h.endIso ? ` … ${h.endIso}` : ""
              }`
          )
          .join("\n")}`
      : "",
    `\n[Clock: ${clock.localNowDisplay} · ${clock.timeZone}]`,
  ]
    .filter(Boolean)
    .join("\n");

  const ai = new GoogleGenAI({ apiKey });
  const proposals: AgentProposal[] = [];
  const toolNames: string[] = [];

  let interaction = await ai.interactions.create({
    model: geminiModelName(),
    system_instruction: systemInstruction,
    input: enrichedUserMessage,
    tools: geminiInteractionTools,
    generation_config: {
      thinking_level: "low",
      max_output_tokens: 4096,
    },
  });

  let reply = "";

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const steps = interaction.steps ?? [];
    const calls = steps.filter(isFunctionCallStep);

    if (!calls.length) {
      reply = interaction.output_text?.trim() || extractModelText(steps);
      break;
    }

    const functionResults = [];
    for (const call of calls) {
      toolNames.push(call.name);
      const args = (call.arguments || {}) as Record<string, unknown>;
      let toolResult: unknown;
      try {
        toolResult = await runAgentTool(call.name, args, opts.ctx, proposals);
      } catch (e) {
        toolResult = {
          error: e instanceof Error ? e.message : "Tool failed",
        };
      }
      functionResults.push({
        type: "function_result" as const,
        name: call.name,
        call_id: call.id,
        result: [{ type: "text" as const, text: JSON.stringify(toolResult) }],
      });
    }

    interaction = await ai.interactions.create({
      model: geminiModelName(),
      system_instruction: systemInstruction,
      input: functionResults,
      tools: geminiInteractionTools,
      previous_interaction_id: interaction.id,
      generation_config: {
        thinking_level: "low",
        max_output_tokens: 4096,
      },
    });
  }

  if (!reply && proposals.length) {
    reply = "I prepared the actions below — confirm to save them.";
  }

  return { reply: reply.trim() || "…", proposals, toolNames };
}
