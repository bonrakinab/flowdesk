import { z } from "zod";
import { prisma } from "@/lib/db";
import { normalizePriority } from "@/lib/priority";
import type { AgentContext, AgentProposal, ProposalKind } from "./types";

function proposalId() {
  return `prop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeProposal(
  kind: ProposalKind,
  summary: string,
  payload: Record<string, unknown>
): AgentProposal {
  return { id: proposalId(), kind, summary, payload };
}

/** Tool declarations for Gemini Interactions API (`@google/genai`). */
export const geminiInteractionTools = [
  {
    type: "function" as const,
    name: "get_today_summary",
    description:
      "Get tickets, events, meds, and reminders due or scheduled for today.",
    parameters: { type: "object", properties: {} },
  },
  {
    type: "function" as const,
    name: "search_items",
    description: "Search tickets, notes, contacts, and events by text.",
    parameters: {
      type: "object",
      properties: {
        q: { type: "string", description: "Search query" },
      },
      required: ["q"],
    },
  },
  {
    type: "function" as const,
    name: "list_projects_members",
    description: "List household projects and members for assignment.",
    parameters: { type: "object", properties: {} },
  },
  {
    type: "function" as const,
    name: "propose_create_ticket",
    description:
      "Propose creating a ticket/task. Requires user Confirm before save.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        priority: { type: "string", description: "P0, P1, P2, or P3" },
        dueAt: { type: "string", description: "ISO datetime" },
        projectId: { type: "string" },
        assigneeId: { type: "string" },
        isInbox: { type: "boolean" },
        isFocus: { type: "boolean" },
      },
      required: ["title"],
    },
  },
  {
    type: "function" as const,
    name: "propose_create_event",
    description: "Propose creating a calendar event. Requires Confirm.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        startAt: { type: "string", description: "ISO datetime" },
        endAt: { type: "string", description: "ISO datetime" },
        allDay: { type: "boolean" },
        assigneeId: { type: "string" },
        remindMinutesBefore: { type: "number" },
        priority: {
          type: "string",
          description: "P0 urgent, P1 high, P2 normal, P3 low",
        },
      },
      required: ["title", "startAt", "endAt"],
    },
  },
  {
    type: "function" as const,
    name: "propose_create_reminder",
    description: "Propose a standalone reminder. Requires Confirm.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        remindAt: { type: "string", description: "ISO datetime" },
        ticketId: { type: "string" },
        eventId: { type: "string" },
      },
      required: ["remindAt"],
    },
  },
  {
    type: "function" as const,
    name: "propose_create_med",
    description: "Propose adding a medication schedule. Requires Confirm.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        dosage: { type: "string" },
        note: { type: "string" },
        times: {
          type: "array",
          items: { type: "string" },
          description: "Dose times as HH:mm",
        },
        remindMinutesBefore: { type: "number" },
      },
      required: ["name", "times"],
    },
  },
  {
    type: "function" as const,
    name: "propose_create_note",
    description: "Propose creating a note. Requires Confirm.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        content: { type: "string" },
        mood: { type: "string" },
        pinned: { type: "boolean" },
      },
    },
  },
  {
    type: "function" as const,
    name: "propose_create_poem",
    description:
      "Propose creating a private poem for the current user. Requires Confirm.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        body: { type: "string" },
        notes: { type: "string" },
        mood: { type: "string" },
      },
    },
  },
  {
    type: "function" as const,
    name: "propose_update_ticket",
    description:
      "Propose updating an existing ticket. Requires Confirm. No deletes.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        status: { type: "string" },
        priority: { type: "string" },
        dueAt: { type: "string" },
        isFocus: { type: "boolean" },
        isInbox: { type: "boolean" },
      },
      required: ["id"],
    },
  },
];

const ticketProposalSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.string().optional(),
  dueAt: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  isInbox: z.boolean().optional(),
  isFocus: z.boolean().optional(),
});

const eventProposalSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  allDay: z.boolean().optional(),
  assigneeId: z.string().optional().nullable(),
  remindMinutesBefore: z.number().optional().nullable(),
  priority: z.string().optional(),
});

const reminderProposalSchema = z.object({
  title: z.string().optional(),
  remindAt: z.string().min(1),
  ticketId: z.string().optional().nullable(),
  eventId: z.string().optional().nullable(),
});

const medProposalSchema = z.object({
  name: z.string().min(1),
  dosage: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  times: z.array(z.string().regex(/^\d{1,2}:\d{2}$/)).min(1),
  remindMinutesBefore: z.number().int().min(0).max(24 * 60).optional(),
});

const noteProposalSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  mood: z.string().optional().nullable(),
  pinned: z.boolean().optional(),
});

const poemProposalSchema = z.object({
  title: z.string().optional(),
  body: z.string().optional(),
  notes: z.string().optional().nullable(),
  mood: z.string().optional().nullable(),
});

const updateTicketProposalSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  dueAt: z.string().optional().nullable(),
  isFocus: z.boolean().optional(),
  isInbox: z.boolean().optional(),
});

export const executeProposalSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string(),
    kind: z.literal("create_ticket"),
    summary: z.string(),
    payload: ticketProposalSchema,
  }),
  z.object({
    id: z.string(),
    kind: z.literal("create_event"),
    summary: z.string(),
    payload: eventProposalSchema,
  }),
  z.object({
    id: z.string(),
    kind: z.literal("create_reminder"),
    summary: z.string(),
    payload: reminderProposalSchema,
  }),
  z.object({
    id: z.string(),
    kind: z.literal("create_med"),
    summary: z.string(),
    payload: medProposalSchema,
  }),
  z.object({
    id: z.string(),
    kind: z.literal("create_note"),
    summary: z.string(),
    payload: noteProposalSchema,
  }),
  z.object({
    id: z.string(),
    kind: z.literal("create_poem"),
    summary: z.string(),
    payload: poemProposalSchema,
  }),
  z.object({
    id: z.string(),
    kind: z.literal("update_ticket"),
    summary: z.string(),
    payload: updateTicketProposalSchema,
  }),
]);

function startOfLocalDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfLocalDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export async function loadAgentBootstrap(householdId: string) {
  const start = startOfLocalDay();
  const end = endOfLocalDay();

  const [projects, members, dueTickets, events, meds, reminders] =
    await Promise.all([
      prisma.project.findMany({
        where: { householdId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: { householdId },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
      prisma.ticket.findMany({
        where: {
          householdId,
          status: { not: "Done" },
          dueAt: { gte: start, lte: end },
        },
        select: { id: true, title: true, status: true, priority: true, dueAt: true },
        take: 20,
        orderBy: { dueAt: "asc" },
      }),
      prisma.calendarEvent.findMany({
        where: {
          householdId,
          startAt: { lte: end },
          endAt: { gte: start },
        },
        select: { id: true, title: true, startAt: true, endAt: true },
        take: 20,
        orderBy: { startAt: "asc" },
      }),
      prisma.medication.findMany({
        where: { householdId, active: true },
        select: { id: true, name: true, timesJson: true },
        take: 20,
      }),
      prisma.reminder.findMany({
        where: {
          done: false,
          remindAt: { gte: start, lte: end },
          OR: [
            { ticket: { householdId } },
            { event: { householdId } },
          ],
        },
        select: { id: true, title: true, remindAt: true },
        take: 20,
        orderBy: { remindAt: "asc" },
      }),
    ]);

  return { projects, members, dueTickets, events, meds, reminders };
}

export async function runAgentTool(
  name: string,
  args: Record<string, unknown>,
  ctx: AgentContext,
  proposals: AgentProposal[]
): Promise<unknown> {
  switch (name) {
    case "get_today_summary": {
      const boot = await loadAgentBootstrap(ctx.householdId);
      return {
        dueTickets: boot.dueTickets,
        events: boot.events,
        meds: boot.meds.map((m) => ({
          id: m.id,
          name: m.name,
          times: safeTimes(m.timesJson),
        })),
        reminders: boot.reminders,
      };
    }
    case "search_items": {
      const q = String(args.q || "").trim();
      if (!q) return { tickets: [], notes: [], contacts: [], events: [] };
      const [tickets, notes, contacts, events] = await Promise.all([
        prisma.ticket.findMany({
          where: {
            householdId: ctx.householdId,
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          },
          select: { id: true, title: true, status: true },
          take: 8,
        }),
        prisma.note.findMany({
          where: {
            householdId: ctx.householdId,
            title: { contains: q, mode: "insensitive" },
          },
          select: { id: true, title: true },
          take: 6,
        }),
        prisma.contact.findMany({
          where: {
            householdId: ctx.householdId,
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { company: { contains: q, mode: "insensitive" } },
            ],
          },
          select: { id: true, name: true },
          take: 6,
        }),
        prisma.calendarEvent.findMany({
          where: {
            householdId: ctx.householdId,
            title: { contains: q, mode: "insensitive" },
          },
          select: { id: true, title: true, startAt: true },
          take: 6,
        }),
      ]);
      return { tickets, notes, contacts, events };
    }
    case "list_projects_members": {
      const boot = await loadAgentBootstrap(ctx.householdId);
      return { projects: boot.projects, members: boot.members };
    }
    case "propose_create_ticket": {
      const data = ticketProposalSchema.parse(args);
      const p = makeProposal("create_ticket", `Ticket: ${data.title}`, data);
      proposals.push(p);
      return { proposed: true, proposalId: p.id, summary: p.summary };
    }
    case "propose_create_event": {
      const data = eventProposalSchema.parse(args);
      const p = makeProposal(
        "create_event",
        `Event: ${data.title} @ ${data.startAt}`,
        data
      );
      proposals.push(p);
      return { proposed: true, proposalId: p.id, summary: p.summary };
    }
    case "propose_create_reminder": {
      const data = reminderProposalSchema.parse(args);
      const p = makeProposal(
        "create_reminder",
        `Reminder: ${data.title || "Untitled"} @ ${data.remindAt}`,
        data
      );
      proposals.push(p);
      return { proposed: true, proposalId: p.id, summary: p.summary };
    }
    case "propose_create_med": {
      const data = medProposalSchema.parse(args);
      const p = makeProposal(
        "create_med",
        `Med: ${data.name} (${data.times.join(", ")})`,
        data
      );
      proposals.push(p);
      return { proposed: true, proposalId: p.id, summary: p.summary };
    }
    case "propose_create_note": {
      const data = noteProposalSchema.parse(args);
      const p = makeProposal(
        "create_note",
        `Note: ${data.title || "Untitled"}`,
        data
      );
      proposals.push(p);
      return { proposed: true, proposalId: p.id, summary: p.summary };
    }
    case "propose_create_poem": {
      const data = poemProposalSchema.parse(args);
      const p = makeProposal(
        "create_poem",
        `Poem: ${data.title || "Untitled"}`,
        data
      );
      proposals.push(p);
      return { proposed: true, proposalId: p.id, summary: p.summary };
    }
    case "propose_update_ticket": {
      const data = updateTicketProposalSchema.parse(args);
      const existing = await prisma.ticket.findFirst({
        where: { id: data.id, householdId: ctx.householdId },
        select: { id: true, title: true },
      });
      if (!existing) {
        return { error: "Ticket not found in this household" };
      }
      const p = makeProposal(
        "update_ticket",
        `Update ticket: ${existing.title}`,
        data
      );
      proposals.push(p);
      return { proposed: true, proposalId: p.id, summary: p.summary };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

function safeTimes(timesJson: string) {
  try {
    const parsed = JSON.parse(timesJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toTipTapDoc(content?: string) {
  const text = (content || "").trim();
  if (!text) {
    return JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
  }
  if (text.startsWith("{") && text.includes('"type"')) {
    try {
      JSON.parse(text);
      return text;
    } catch {
      /* fall through */
    }
  }
  return JSON.stringify({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  });
}

export type ExecuteResult = {
  proposalId: string;
  kind: ProposalKind;
  ok: boolean;
  id?: string;
  href?: string;
  error?: string;
};

export async function executeConfirmedProposals(
  proposals: z.infer<typeof executeProposalSchema>[],
  ctx: AgentContext
): Promise<ExecuteResult[]> {
  const out: ExecuteResult[] = [];

  for (const prop of proposals) {
    try {
      switch (prop.kind) {
        case "create_ticket": {
          const data = prop.payload;
          const ticket = await prisma.ticket.create({
            data: {
              title: data.title,
              description: data.description,
              type: "task",
              status: data.isInbox ? "Backlog" : "Ready",
              priority: normalizePriority(data.priority),
              dueAt: data.dueAt ? new Date(data.dueAt) : null,
              isInbox: data.isInbox ?? false,
              isFocus: data.isFocus ?? false,
              projectId: data.projectId ?? null,
              assigneeId: data.assigneeId ?? ctx.userId,
              householdId: ctx.householdId,
              createdById: ctx.userId,
              activities: {
                create: {
                  message: "created via Agent",
                  userId: ctx.userId,
                },
              },
            },
          });
          out.push({
            proposalId: prop.id,
            kind: prop.kind,
            ok: true,
            id: ticket.id,
            href: `/tickets/${ticket.id}`,
          });
          break;
        }
        case "create_event": {
          const data = prop.payload;
          const startAt = new Date(data.startAt);
          const event = await prisma.calendarEvent.create({
            data: {
              title: data.title,
              description: data.description,
              startAt,
              endAt: new Date(data.endAt),
              allDay: data.allDay ?? false,
              type: "meeting",
              priority: normalizePriority(data.priority),
              assigneeId: data.assigneeId ?? null,
              householdId: ctx.householdId,
              reminders:
                data.remindMinutesBefore != null
                  ? {
                      create: {
                        title: data.title,
                        remindAt: new Date(
                          startAt.getTime() -
                            data.remindMinutesBefore * 60_000
                        ),
                      },
                    }
                  : undefined,
            },
          });
          out.push({
            proposalId: prop.id,
            kind: prop.kind,
            ok: true,
            id: event.id,
            href: "/calendar",
          });
          break;
        }
        case "create_reminder": {
          const data = prop.payload;
          const reminder = await prisma.reminder.create({
            data: {
              title: data.title,
              remindAt: new Date(data.remindAt),
              ticketId: data.ticketId ?? null,
              eventId: data.eventId ?? null,
              userId: ctx.userId,
              householdId: ctx.householdId,
            },
          });
          out.push({
            proposalId: prop.id,
            kind: prop.kind,
            ok: true,
            id: reminder.id,
            href: "/today",
          });
          break;
        }
        case "create_med": {
          const data = prop.payload;
          const times = data.times.map((t) => {
            const [h, m] = t.split(":");
            return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
          });
          const med = await prisma.medication.create({
            data: {
              name: data.name,
              dosage: data.dosage ?? null,
              note: data.note ?? null,
              color: "#0d9488",
              timesJson: JSON.stringify(times),
              remindMinutesBefore: data.remindMinutesBefore ?? 15,
              householdId: ctx.householdId,
              userId: ctx.userId,
            },
          });
          out.push({
            proposalId: prop.id,
            kind: prop.kind,
            ok: true,
            id: med.id,
            href: "/meds",
          });
          break;
        }
        case "create_note": {
          const data = prop.payload;
          const note = await prisma.note.create({
            data: {
              title: data.title || "Untitled",
              content: toTipTapDoc(data.content),
              mood: data.mood,
              pinned: data.pinned ?? false,
              householdId: ctx.householdId,
              lastEditedById: ctx.userId,
            },
          });
          out.push({
            proposalId: prop.id,
            kind: prop.kind,
            ok: true,
            id: note.id,
            href: "/notes",
          });
          break;
        }
        case "create_poem": {
          const data = prop.payload;
          const poem = await prisma.poem.create({
            data: {
              userId: ctx.userId,
              title: (data.title?.trim() || "Untitled").slice(0, 300),
              body: data.body ?? "",
              notes: data.notes ?? null,
              mood: data.mood ?? null,
              source: "Agent",
            },
          });
          out.push({
            proposalId: prop.id,
            kind: prop.kind,
            ok: true,
            id: poem.id,
            href: "/poems",
          });
          break;
        }
        case "update_ticket": {
          const data = prop.payload;
          const existing = await prisma.ticket.findFirst({
            where: { id: data.id, householdId: ctx.householdId },
          });
          if (!existing) {
            out.push({
              proposalId: prop.id,
              kind: prop.kind,
              ok: false,
              error: "Ticket not found",
            });
            break;
          }
          const ticket = await prisma.ticket.update({
            where: { id: existing.id },
            data: {
              title: data.title,
              status: data.status,
              priority:
                data.priority === undefined
                  ? undefined
                  : normalizePriority(data.priority),
              dueAt:
                data.dueAt === undefined
                  ? undefined
                  : data.dueAt
                    ? new Date(data.dueAt)
                    : null,
              isFocus: data.isFocus,
              isInbox: data.isInbox,
              activities: {
                create: {
                  message: "updated via Agent",
                  userId: ctx.userId,
                },
              },
            },
          });
          out.push({
            proposalId: prop.id,
            kind: prop.kind,
            ok: true,
            id: ticket.id,
            href: `/tickets/${ticket.id}`,
          });
          break;
        }
      }
    } catch (e) {
      out.push({
        proposalId: prop.id,
        kind: prop.kind,
        ok: false,
        error: e instanceof Error ? e.message : "Failed",
      });
    }
  }

  return out;
}
