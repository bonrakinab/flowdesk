"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { AuthShell } from "@/components/layout/app-shell";
import { Button, Input, Label } from "@/components/ui/primitives";

function oauthErrorMessage(code: string | null) {
  switch (code) {
    case "Configuration":
    case "OAuthCallback":
    case "Callback":
      return "Google sign-in failed (session cookie). Try again in the browser, or sign in with email.";
    case "AccessDenied":
      return "Google sign-in was cancelled or denied.";
    case "OAuthAccountNotLinked":
      return "That Google email is already linked to another sign-in method.";
    case "Verification":
      return "The sign-in link expired. Request a new one.";
    default:
      return code ? "Sign-in failed. Try email and password, or Google again." : "";
  }
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(() => oauthErrorMessage(params.get("error")));
  const [loading, setLoading] = useState(false);
  const googleEnabled =
    process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "1";

  function callbackTarget() {
    const path = params.get("callbackUrl") || "/today";
    return `${window.location.origin}${path.startsWith("/") ? path : "/today"}`;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password");
      return;
    }
    router.push(params.get("callbackUrl") || "/today");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
          className="py-3"
        />
      </div>
      <div>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-xs text-accent hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="py-3"
        />
      </div>
      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </Button>
      <div className="relative py-1 text-center text-[11px] uppercase tracking-[0.16em] text-muted">
        <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
        <span className="relative bg-card px-3">or</span>
      </div>
      {googleEnabled ? (
        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="w-full"
          onClick={() => signIn("google", { callbackUrl: callbackTarget() })}
        >
          Continue with Google
        </Button>
      ) : (
        <p className="text-center text-xs text-muted">
          Google sign-in available after adding OAuth keys to `.env`
        </p>
      )}
      <p className="text-center text-sm text-muted">
        New here?{" "}
        <Link href="/signup" className="text-accent font-medium">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthShell>
      <h2 className="text-xl font-semibold mb-4">Welcome back</h2>
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
