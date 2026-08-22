import { prisma } from "@/lib/db";
import {
  getFreshGoogleAccessToken,
  hasTasksScope,
} from "@/lib/google";

type GoogleTaskList = {
  id: string;
  title?: string;
};

type GoogleTask = {
  id: string;
  title?: string;
  notes?: string;
  status?: "needsAction" | "completed";
  due?: string;
  deleted?: boolean;
  parent?: string;
  completed?: string;
};

async function googleAccountForUser(userId: string) {
  return prisma.account.findFirst({
    where: { userId, provider: "google" },
  });
}

export async function requireGoogleTasksAccess(userId: string) {
  const account = await googleAccountForUser(userId);
  if (!account) {
    return {
      ok: false as const,
      status: 400,
      error: "Link Google on Account first.",
      hint: "Use Link Google account, approve calendar + tasks access, then try again.",
    };
  }
  const token = await getFreshGoogleAccessToken(account);
  if (!token.ok) {
    return {
      ok: false as const,
      status: 401,
      error: token.error,
      hint: token.hint,
    };
  }
  if (!hasTasksScope(token.scope)) {
    return {
      ok: false as const,
      status: 403,
      error: "Google Tasks permission is missing.",
      hint: "Unlink Google, then Link Google again and accept Tasks access.",
      scope: token.scope,
    };
  }
  return { ok: true as const, accessToken: token.accessToken, scope: token.scope };
}

async function listTaskLists(accessToken: string) {
  const lists: GoogleTaskList[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(
      "https://tasks.googleapis.com/tasks/v1/users/@me/lists"
    );
    url.searchParams.set("maxResults", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false as const,
        status: res.status,
        detail: text.slice(0, 400),
      };
    }
    const data = (await res.json()) as {
      items?: GoogleTaskList[];
      nextPageToken?: string;
    };
    lists.push(...(data.items || []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return { ok: true as const, lists };
}

async function listTasks(accessToken: string, taskListId: string) {
  const tasks: GoogleTask[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(
      `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks`
    );
    url.searchParams.set("showCompleted", "true");
    url.searchParams.set("showHidden", "true");
    // Assigned tasks from Docs/Chat/Calendar only appear with this flag.
    url.searchParams.set("showAssigned", "true");
    url.searchParams.set("maxResults", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false as const,
        status: res.status,
        detail: text.slice(0, 400),
      };
    }
    const data = (await res.json()) as {
      items?: GoogleTask[];
      nextPageToken?: string;
    };
    tasks.push(...(data.items || []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return { ok: true as const, tasks };
}

async function projectForTaskList(
  householdId: string,
  list: GoogleTaskList
) {
  const name = (list.title || "Google Tasks").trim() || "Google Tasks";
  const existing = await prisma.project.findFirst({
    where: { householdId, name },
  });
  if (existing) return existing;
  return prisma.project.create({
    data: {
      householdId,
      name,
      color: "#4285f4",
      description: "Synced from Google Tasks",
      status: "active",
    },
  });
}

function parseGoogleDue(due?: string): Date | null {
  if (!due) return null;
  const d = new Date(due);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Pull Google Tasks into Flowdesk tickets (one-way).
 * externalSource = "google_tasks", externalId = `${listId}:${taskId}`
 */
export async function syncGoogleTasks(opts: {
  householdId: string;
  userId: string;
  accessToken: string;
}) {
  const listed = await listTaskLists(opts.accessToken);
  if (!listed.ok) {
    return {
      ok: false as const,
      error: "Google Tasks API failed",
      detail: listed.detail,
      status: listed.status,
    };
  }

  let upserted = 0;
  let completed = 0;
  const listResults: {
    listId: string;
    title: string;
    upserted: number;
  }[] = [];

  for (const list of listed.lists) {
    if (!list.id) continue;
    const fetched = await listTasks(opts.accessToken, list.id);
    if (!fetched.ok) {
      return {
        ok: false as const,
        error: "Google Tasks API failed",
        detail: fetched.detail,
        status: fetched.status,
        listTitle: list.title,
      };
    }

    const project = await projectForTaskList(opts.householdId, list);
    let listUpserted = 0;

    for (const task of fetched.tasks) {
      if (!task.id || task.deleted) continue;
      // Skip subtasks — keep top-level todos only
      if (task.parent) continue;

      const externalId = `${list.id}:${task.id}`;
      const title = task.title?.trim() || "Google task";
      const isDone = task.status === "completed";
      const dueAt = parseGoogleDue(task.due);
      const description = task.notes?.trim() || null;

      const data = {
        title,
        description,
        type: "task" as const,
        status: isDone ? "Done" : dueAt ? "Ready" : "Backlog",
        dueAt,
        projectId: project.id,
        isInbox: false,
        isFocus: false,
        externalSource: "google_tasks" as const,
        externalId,
        assigneeId: opts.userId,
        createdById: opts.userId,
      };

      const existing = await prisma.ticket.findFirst({
        where: {
          householdId: opts.householdId,
          externalSource: "google_tasks",
          externalId,
        },
      });

      if (existing) {
        // Don't clobber local status if user moved an open synced task on the board,
        // unless Google marks it completed (or reopens it).
        const status =
          isDone
            ? "Done"
            : existing.status === "Done"
              ? dueAt
                ? "Ready"
                : "Backlog"
              : existing.status;

        await prisma.ticket.update({
          where: { id: existing.id },
          data: {
            title: data.title,
            description: data.description,
            dueAt: data.dueAt,
            projectId: data.projectId,
            status,
            ...(isDone ? { isFocus: false, workStartedAt: null } : {}),
          },
        });
      } else {
        await prisma.ticket.create({
          data: {
            ...data,
            householdId: opts.householdId,
            priority: "P2",
          },
        });
      }

      upserted++;
      listUpserted++;
      if (isDone) completed++;
    }

    listResults.push({
      listId: list.id,
      title: list.title || list.id,
      upserted: listUpserted,
    });
  }

  return {
    ok: true as const,
    lists: listed.lists.length,
    upserted,
    completed,
    listResults,
  };
}
