"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { acceptUserInvite } from "@/lib/actions";
import { Button, Input } from "@/components/ui/primitives";
import { ShieldCheck } from "lucide-react";

type Preview = {
  name: string;
  email: string;
  role: string;
  businessName: string;
  branchName: string | null;
  expiresAt: string;
  terms: string;
  termsVersion: string;
};

export function InviteAcceptClient({
  token,
  preview,
}: {
  token: string;
  preview: Preview | { error: string };
}) {
  const router = useRouter();
  const [name, setName] = useState("name" in preview ? preview.name : "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if ("error" in preview) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-surface-raised p-6 shadow-[var(--shadow-sm)]">
        <h1 className="font-display text-xl font-semibold">Invite unavailable</h1>
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
        await acceptUserInvite({
          token,
          password,
          confirmPassword: confirm,
          acceptTerms: accepted,
          name,
        });
        router.push("/login?invited=1");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not accept invite");
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-4">
      <div className="rounded-2xl border border-border bg-surface-raised p-6 shadow-[var(--shadow-sm)]">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Join {preview.businessName}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Invited as <span className="font-medium text-ink">{preview.role}</span>
              {preview.branchName ? ` · ${preview.branchName}` : ""} · {preview.email}
            </p>
            <p className="mt-1 text-xs text-ink-faint">
              Link expires {new Date(preview.expiresAt).toLocaleString("en-GB")}
            </p>
          </div>
        </div>
      </div>

      <form
        onSubmit={submit}
        className="space-y-4 rounded-2xl border border-border bg-surface-raised p-6 shadow-[var(--shadow-sm)]"
      >
        <div>
          <h2 className="text-sm font-semibold">Terms & privacy</h2>
          <p className="mt-0.5 text-xs text-ink-faint">Version {preview.termsVersion}</p>
          <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-surface p-3 text-xs leading-relaxed text-ink-muted">
            {preview.terms}
          </pre>
          <label className="mt-3 flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="mt-1 rounded border-border"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              required
            />
            <span>I have read and agree to these terms. I will keep my credentials private.</span>
          </label>
        </div>

        <div>
          <label className="mb-1 block text-xs text-ink-muted">Display name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-muted">Create password (min 8)</label>
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

        <Button type="submit" className="w-full" size="lg" disabled={pending || !accepted}>
          {pending ? "Creating account…" : "Accept & create account"}
        </Button>
      </form>
    </div>
  );
}
