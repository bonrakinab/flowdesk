"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { AuthShell } from "@/components/layout/app-shell";
import { Button, Input, Label } from "@/components/ui/primitives";

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [inviteCode, setInviteCode] = useState(params.get("invite") || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const googleEnabled =
    process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "1";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        householdName: inviteCode ? undefined : householdName || undefined,
        inviteCode: inviteCode || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setLoading(false);
      setError(data.error || "Signup failed");
      return;
    }
    const login = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (login?.error) {
      setError("Account created — please sign in");
      router.push("/login");
      return;
    }
    router.push("/today");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Your name</Label>
        <Input
          id="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {!inviteCode && (
        <div>
          <Label htmlFor="household">Household name (optional)</Label>
          <Input
            id="household"
            value={householdName}
            onChange={(e) => setHouseholdName(e.target.value)}
            placeholder="Banerjee Family"
          />
        </div>
      )}
      <div>
        <Label htmlFor="invite">Family invite code (optional)</Label>
        <Input
          id="invite"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
          placeholder="Join an existing household"
        />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creating…" : "Create account"}
      </Button>
      {googleEnabled && (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => signIn("google", { callbackUrl: "/today" })}
        >
          Continue with Google
        </Button>
      )}
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-accent font-medium">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export default function SignupPage() {
  return (
    <AuthShell>
      <h2 className="text-xl font-semibold mb-4">Create your workspace</h2>
      <Suspense>
        <SignupForm />
      </Suspense>
    </AuthShell>
  );
}
