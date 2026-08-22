import { NextResponse } from "next/server";
import { requireHousehold } from "@/lib/session";
import {
  requireGoogleTasksAccess,
  syncGoogleTasks,
} from "@/lib/google-tasks";

/** Sync Google Tasks (todos shown in Google Calendar) into Flowdesk tickets. */
export async function POST() {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;
  const { householdId, user } = result as {
    householdId: string;
    user: { id: string };
  };

  const access = await requireGoogleTasksAccess(user.id);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error, hint: access.hint, scope: access.scope },
      { status: access.status }
    );
  }

  const synced = await syncGoogleTasks({
    householdId,
    userId: user.id,
    accessToken: access.accessToken,
  });

  if (!synced.ok) {
    return NextResponse.json(
      {
        error: synced.error,
        detail: synced.detail,
        hint: "Enable Google Tasks API in Google Cloud Console, then unlink/link Google on Account.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json(synced);
}
