"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { acceptPasswordReset } from "@/lib/actions";
import { Button, Input } from "@/components/ui/primitives";
import { KeyRound } from "lucide-react";

type Preview =
  | {
      name: string;
      email: string;
      businessName: string;
      expiresAt: string;
    }
  | { error: string };

export function ResetPasswordClient({
  token,
  preview,
}: {
  token: string;
  preview: Preview;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if ("error" in preview) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-surface-raised p-6 shadow-[var(--shadow-sm)]">
        <h1 className="font-display text-xl font-semibold">Reset unavailable</h1>
        <p className="mt-2 text-sm text-ink-muted">{preview.error}</p>
        <Link href="/login" className="mt-4 inline-block text-sm text-brand hover:underline">
          Go to sign in
        </Link>
      </div>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await acceptPasswordReset({
          token,
          password,
          confirmPassword: confirm,
        });
        router.push("/login?reset=1");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not reset password");
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <div className="rounded-2xl border border-border bg-surface-raised p-6 shadow-[var(--shadow-sm)]">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Set a new password</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {preview.name} · {preview.email}
            </p>
            <p className="mt-0.5 text-xs text-ink-faint">
              {preview.businessName} · expires{" "}
              {new Date(preview.expiresAt).toLocaleString("en-GB")}
            </p>
          </div>
        </div>
      </div>

      <form
        onSubmit={submit}
        className="space-y-4 rounded-2xl border border-border bg-surface-raised p-6 shadow-[var(--shadow-sm)]"
      >
        <div>
          <label className="mb-1 block text-xs text-ink-muted">New password (min 8)</label>
          <Input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-muted">Confirm password</label>
          <Input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
          />
        </div>

        {error && (
          <p className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}
