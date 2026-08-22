export type ProposalKind =
  | "create_ticket"
  | "create_event"
  | "create_reminder"
  | "create_med"
  | "create_note"
  | "create_poem"
  | "update_ticket";

export type AgentProposal = {
  id: string;
  kind: ProposalKind;
  summary: string;
  payload: Record<string, unknown>;
};

export type AgentChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AgentContext = {
  householdId: string;
  userId: string;
  userName: string;
  nowIso: string;
  timezoneHint: string;
};
