"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Suspense, useState } from "react";
import { Button, Input } from "@/components/ui/primitives";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invited = searchParams.get("invited") === "1";
  const resetDone = searchParams.get("reset") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
      return;
    }

    router.push("/counter");
    router.refresh();
  }

  return (
    <div className="w-full max-w-md animate-fade-up">
      <div className="mb-8 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand font-display font-bold text-white">
            R
          </div>
          <span className="font-display text-xl font-semibold">RBIAP</span>
        </div>
      </div>

      <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">Welcome back</h2>
      <p className="mt-2 text-sm text-ink-muted">Sign in to your business workspace.</p>

      {invited && (
        <div className="mt-4 rounded-lg border border-brand/30 bg-brand-soft/60 px-3 py-2 text-sm text-brand-deep">
          Account created. Sign in with the email and password you just set.
        </div>
      )}
      {resetDone && (
        <div className="mt-4 rounded-lg border border-brand/30 bg-brand-soft/60 px-3 py-2 text-sm text-brand-deep">
          Password updated. Sign in with your new password.
        </div>
      )}

      <form onSubmit={handleLogin} className="mt-8 space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-muted">Email</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-muted">Password</label>
          <div className="relative">
            <Input
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="pr-10"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-faint hover:text-ink"
              onClick={() => setShow((s) => !s)}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center gap-2 text-ink-muted">
            <input type="checkbox" className="rounded border-border" defaultChecked />
            Remember device
          </label>
          <span
            className="text-ink-faint"
            title="Ask an Owner or Manager to create a reset link in User Management"
          >
            Forgot password? Ask admin for a reset link
          </span>
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      <div className="mt-6 flex items-start gap-2 rounded-xl border border-border bg-brand-soft/50 p-3 text-xs text-brand-deep">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Access is by invite only. New installation? Complete{" "}
          <a href="/setup" className="font-medium underline">
            first-run setup
          </a>{" "}
          when the database has no users yet.
        </p>
      </div>
    </div>
  );
}

export default function LoginPageClient() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="login-atmosphere relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex">
        <div className="animate-fade-up">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand font-display text-lg font-bold">
              R
            </div>
            <div>
              <p className="font-display text-2xl font-semibold tracking-tight">RBIAP</p>
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">Retail OS</p>
            </div>
          </div>
        </div>

        <div className="max-w-lg animate-fade-up-delay-1">
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
            One platform for inventory, sales, books, and insight.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/70">
            Every transaction updates stock, ledgers, tax, and dashboards — so you run the business,
            not the paperwork.
          </p>
        </div>

        <p className="text-xs text-white/40 animate-fade-up-delay-2">Your data · Your credentials · Local SQLite</p>
      </section>

      <section className="flex items-center justify-center bg-surface px-6 py-12">
        <Suspense fallback={<div className="text-sm text-ink-muted">Loading…</div>}>
          <LoginForm />
        </Suspense>
      </section>
    </div>
  );
}
