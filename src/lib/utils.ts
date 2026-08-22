import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const TICKET_STATUSES = [
  "Backlog",
  "Ready",
  "Doing",
  "Waiting",
  "Done",
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_TYPES = ["issue", "task", "follow_up", "idea"] as const;
export const PRIORITIES = ["P0", "P1", "P2", "P3"] as const;
export const EVENT_TYPES = [
  "meeting",
  "reminder",
  "deadline",
  "family",
  "personal",
] as const;

export const MEMBER_COLORS = [
  "#0d9488",
  "#d97706",
  "#0284c7",
  "#e11d48",
  "#7c3aed",
  "#059669",
];

export function generateInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
