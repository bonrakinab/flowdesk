import nodemailer from "nodemailer";

export function isSmtpConfigured() {
  return Boolean(
    process.env.SMTP_URL ||
      (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
  );
}

function createTransport() {
  if (process.env.SMTP_URL) {
    return nodemailer.createTransport(process.env.SMTP_URL);
  }
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  // Gmail app passwords are often pasted with spaces — strip them.
  // Vercel/env files sometimes wrap values in quotes — strip those too.
  const user = (process.env.SMTP_USER || "")
    .trim()
    .replace(/^["']|["']$/g, "");
  const pass = (process.env.SMTP_PASS || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, "");
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user,
      pass,
    },
  });
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ ok: boolean; devLink?: string; error?: string }> {
  const transport = createTransport();
  if (transport) {
    try {
      await transport.sendMail({
        from: process.env.SMTP_FROM || "Flowdesk <noreply@localhost>",
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      });
      return { ok: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : "SMTP send failed";
      console.error("[mail]", message);
      return { ok: false, error: message };
    }
  }

  console.info("[mail:dev]", opts.to, opts.subject);
  console.info(opts.text || opts.html);
  const match = (opts.text || opts.html).match(/https?:\/\/[^\s"'<>]+/);
  return { ok: true, devLink: match?.[0] };
}

export async function verifySmtp(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const transport = createTransport();
  if (!transport) {
    return { ok: false, error: "SMTP not configured" };
  }
  try {
    await transport.verify();
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "SMTP verify failed",
    };
  }
}
