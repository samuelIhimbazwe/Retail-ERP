"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { bootstrapBusiness } from "@/lib/bootstrap";
import { TERMS_OF_USE, TERMS_VERSION } from "@/lib/terms";
import { Button, Input, Select } from "@/components/ui/primitives";
import { Building2, ShieldCheck } from "lucide-react";

export function SetupClient() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [currency, setCurrency] = useState("RWF");
  const [vatPercent, setVatPercent] = useState("18");
  const [branchName, setBranchName] = useState("Main");
  const [branchCode, setBranchCode] = useState("MAIN");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await bootstrapBusiness({
          businessName,
          currency,
          vatPercent: Number(vatPercent),
          branchName,
          branchCode,
          ownerName,
          ownerEmail,
          password,
          confirmPassword: confirm,
          acceptTerms: accepted,
        });

        const signed = await signIn("credentials", {
          email: result.ownerEmail,
          password,
          redirect: false,
        });
        if (signed?.error) {
          router.push("/login");
          return;
        }
        router.push("/dashboard");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Setup failed");
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <div className="rounded-2xl border border-border bg-surface-raised p-6 shadow-[var(--shadow-sm)]">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Set up your business</h1>
            <p className="mt-1 text-sm text-ink-muted">
              One-time setup. Creates your company, main branch, chart of accounts, and owner account.
              No demo data.
            </p>
          </div>
        </div>
      </div>

      <form
        onSubmit={submit}
        className="space-y-4 rounded-2xl border border-border bg-surface-raised p-6 shadow-[var(--shadow-sm)]"
      >
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-ink">Business</legend>
          <div>
            <label className="mb-1 block text-xs text-ink-muted">Business name</label>
            <Input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Your Shop Ltd"
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Currency</label>
              <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="RWF">RWF — Rwanda Franc</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="KES">KES</option>
                <option value="UGX">UGX</option>
                <option value="TZS">TZS</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">VAT %</label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={vatPercent}
                onChange={(e) => setVatPercent(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Main branch name</label>
              <Input value={branchName} onChange={(e) => setBranchName(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Branch code</label>
              <Input
                value={branchCode}
                onChange={(e) => setBranchCode(e.target.value.toUpperCase())}
                maxLength={8}
                required
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-3 border-t border-border pt-4">
          <legend className="text-sm font-semibold text-ink">Owner account</legend>
          <div>
            <label className="mb-1 block text-xs text-ink-muted">Your name</label>
            <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-muted">Work email (login)</label>
            <Input
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Password (min 8)</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Confirm password</label>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
          </div>
        </fieldset>

        <div className="border-t border-border pt-4">
          <p className="text-xs text-ink-faint">Terms · {TERMS_VERSION}</p>
          <pre className="mt-2 max-h-28 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-surface p-3 text-[11px] leading-relaxed text-ink-muted">
            {TERMS_OF_USE}
          </pre>
          <label className="mt-3 flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="mt-1 rounded border-border"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              required
            />
            <span>I accept these terms and will keep owner credentials secure.</span>
          </label>
        </div>

        {error && (
          <p className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" size="lg" disabled={pending || !accepted}>
          {pending ? "Creating business…" : "Create business & sign in"}
        </Button>

        <p className="flex items-start gap-2 text-xs text-ink-muted">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
          After setup, invite staff from User Management. Demo seed is optional (
          <code className="text-[10px]">npm run db:seed</code>
          ).
        </p>
      </form>
    </div>
  );
}
