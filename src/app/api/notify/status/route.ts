import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { getVapidPublicKey, isPushConfigured, sendPushToUser } from "@/lib/push";
import { isSmtpConfigured, sendMail, verifySmtp } from "@/lib/mail";
import { isSmsConfigured, sendSms, normalizePhone } from "@/lib/sms";
import { prisma } from "@/lib/db";
import { appBaseUrl } from "@/lib/app-url";

export async function GET() {
  const result = await requireUser();
  if ("error" in result && result.error) return result.error;
  const { user } = result as { user: { id: string } };

  const full = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      alertEmail: true,
      alertSms: true,
      phone: true,
      email: true,
      _count: { select: { pushSubs: true } },
    },
  });

  return NextResponse.json({
    push: {
      configured: isPushConfigured(),
      publicKey: getVapidPublicKey(),
      subscriptions: full?._count.pushSubs ?? 0,
    },
    smtp: {
      configured: isSmtpConfigured(),
    },
    sms: {
      configured: isSmsConfigured(),
    },
    alertEmail: full?.alertEmail ?? false,
    alertSms: full?.alertSms ?? false,
    phone: full?.phone ?? null,
    email: full?.email,
  });
}

export async function POST(req: Request) {
  const result = await requireUser();
  if ("error" in result && result.error) return result.error;
  const { user } = result as { user: { id: string; email: string } };

  const body = (await req.json()) as {
    action?: "test-push" | "test-email" | "test-sms" | "verify-smtp";
  };

  if (body.action === "test-push") {
    const r = await sendPushToUser(user.id, {
      title: "Flowdesk",
      body: "Push notifications are working.",
      url: `${appBaseUrl()}/today`,
    });
    return NextResponse.json(r);
  }

  if (body.action === "verify-smtp") {
    return NextResponse.json(await verifySmtp());
  }

  if (body.action === "test-email") {
    const mail = await sendMail({
      to: user.email,
      subject: "Flowdesk test email",
      html: "<p>SMTP is working for Flowdesk.</p>",
      text: "SMTP is working for Flowdesk.",
    });
    return NextResponse.json(mail);
  }

  if (body.action === "test-sms") {
    const full = await prisma.user.findUnique({
      where: { id: user.id },
      select: { phone: true },
    });
    const to = normalizePhone(full?.phone);
    if (!to) {
      return NextResponse.json(
        { ok: false, error: "Add a phone number in Account first" },
        { status: 400 }
      );
    }
    if (!isSmsConfigured()) {
      return NextResponse.json(
        { ok: false, error: "Twilio not configured on the server" },
        { status: 503 }
      );
    }
    const r = await sendSms({
      to,
      body: "Flowdesk test SMS — alerts are working.",
    });
    return NextResponse.json(r);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
