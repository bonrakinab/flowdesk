const KEY = "flowdesk-outbox";

type OutboxItem = {
  id: string;
  type: "ticket";
  payload: Record<string, unknown>;
  createdAt: string;
};

function read(): OutboxItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as OutboxItem[];
  } catch {
    return [];
  }
}

function write(items: OutboxItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function queueTicketCreate(payload: Record<string, unknown>) {
  const items = read();
  items.push({
    id: crypto.randomUUID(),
    type: "ticket",
    payload,
    createdAt: new Date().toISOString(),
  });
  write(items);
}

export async function flushOutbox() {
  if (!navigator.onLine) return;
  const items = read();
  const remaining: OutboxItem[] = [];
  for (const item of items) {
    try {
      if (item.type === "ticket") {
        const res = await fetch("/api/tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.payload),
        });
        if (!res.ok) remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }
  write(remaining);
}
