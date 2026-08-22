import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/push";

export async function GET() {
  const key = getVapidPublicKey();
  if (!key) {
    return NextResponse.json({
      publicKey: null,
      hint: "Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT in .env",
    });
  }
  return NextResponse.json({ publicKey: key });
}
