"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Input, Label } from "@/components/ui/primitives";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setDevLink(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setMessage(
        "If that email has an account, a reset link was sent (or logged in dev)."
      );
      if (data.devLink) setDevLink(data.devLink);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 space-y-4"
      >
        <h1 className="font-[family-name:var(--font-display)] text-2xl">
          Forgot password
        </h1>
        <p className="text-sm text-muted">
          We&apos;ll email a reset link. Without SMTP configured, the link
          appears here in development.
        </p>
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Sending…" : "Send reset link"}
        </Button>
        {message && <p className="text-sm text-muted">{message}</p>}
        {devLink && (
          <p className="text-sm break-all">
            Dev link:{" "}
            <Link href={devLink} className="text-accent underline">
              {devLink}
            </Link>
          </p>
        )}
        <Link href="/login" className="text-sm text-accent block">
          Back to login
        </Link>
      </form>
    </div>
  );
}
