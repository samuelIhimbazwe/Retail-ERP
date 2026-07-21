"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  changeOwnPassword,
  updateBusinessSettings,
  updateOwnProfile,
} from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader, Panel, Button, Input, Select } from "@/components/ui/primitives";
import {
  Building2,
  GitBranch,
  Package,
  Shield,
  Users,
} from "lucide-react";

type SettingsPayload = {
  business: {
    id: string;
    name: string;
    currency: string;
    fiscalYear: string;
    vatRate: number;
  };
  defaultBranchId: string;
  defaultBranchName: string;
  branches: { id: string; name: string; code: string; isDefault: boolean }[];
  roleCounts: { role: string; count: number }[];
  counts: { users: number; branches: number; products: number; accounts: number };
  me: {
    id: string;
    name: string;
    email: string;
    role: string;
    branchName: string | null;
  };
};

const ROLES = ["OWNER", "MANAGER", "CASHIER", "ACCOUNTANT", "STOREKEEPER"] as const;

export function SettingsForm({ data }: { data: SettingsPayload }) {
  const router = useRouter();
  const canEditBusiness =
    data.me.role === "OWNER" || data.me.role === "MANAGER";
  const [name, setName] = useState(data.business.name);
  const [currency, setCurrency] = useState(data.business.currency);
  const [fiscalYear, setFiscalYear] = useState(data.business.fiscalYear);
  const [vatPct, setVatPct] = useState(String(Math.round(data.business.vatRate * 1000) / 10));
  const [defaultBranchId, setDefaultBranchId] = useState(data.defaultBranchId);
  const [profileName, setProfileName] = useState(data.me.name);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [bizMessage, setBizMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [profileMessage, setProfileMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwMessage, setPwMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pendingBiz, startBiz] = useTransition();
  const [pendingProfile, startProfile] = useTransition();
  const [pendingPw, startPw] = useTransition();

  const dirty = useMemo(() => {
    const vat = Number(vatPct) / 100;
    return (
      name.trim() !== data.business.name ||
      currency !== data.business.currency ||
      fiscalYear.trim() !== data.business.fiscalYear ||
      Math.abs(vat - data.business.vatRate) > 0.0001 ||
      defaultBranchId !== data.defaultBranchId
    );
  }, [name, currency, fiscalYear, vatPct, defaultBranchId, data]);

  function saveBusiness() {
    setBizMessage(null);
    const vatRate = Number(vatPct) / 100;
    if (Number.isNaN(vatRate) || vatRate < 0 || vatRate > 1) {
      setBizMessage({ ok: false, text: "VAT rate must be between 0 and 100" });
      return;
    }
    startBiz(async () => {
      try {
        await updateBusinessSettings({
          name,
          currency,
          fiscalYear,
          vatRate,
          defaultBranchId: defaultBranchId || undefined,
        });
        setBizMessage({ ok: true, text: "Business settings saved" });
        router.refresh();
      } catch (e) {
        setBizMessage({ ok: false, text: e instanceof Error ? e.message : "Save failed" });
      }
    });
  }

  function saveProfile() {
    setProfileMessage(null);
    startProfile(async () => {
      try {
        await updateOwnProfile({ name: profileName });
        setProfileMessage({ ok: true, text: "Profile saved" });
        router.refresh();
      } catch (e) {
        setProfileMessage({ ok: false, text: e instanceof Error ? e.message : "Save failed" });
      }
    });
  }

  function savePassword() {
    setPwMessage(null);
    if (newPassword !== confirmPassword) {
      setPwMessage({ ok: false, text: "New passwords do not match" });
      return;
    }
    startPw(async () => {
      try {
        await changeOwnPassword({ currentPassword, newPassword });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setPwMessage({ ok: true, text: "Password updated" });
      } catch (e) {
        setPwMessage({ ok: false, text: e instanceof Error ? e.message : "Update failed" });
      }
    });
  }

  return (
    <div>
      <PageHeader
        title="User & Business Settings"
        description={
          canEditBusiness
            ? "Company profile, default branch, VAT, your account, and password."
            : "Your profile and password. Business settings require Owner or Manager."
        }
        actions={
          canEditBusiness ? (
            <Button size="sm" onClick={saveBusiness} disabled={pendingBiz || !dirty}>
              {pendingBiz ? "Saving…" : dirty ? "Save business" : "Saved"}
            </Button>
          ) : undefined
        }
      />

      {canEditBusiness && (
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Active users" value={data.counts.users} icon={Users} tone="brand" />
        <KpiCard label="Branches" value={data.counts.branches} icon={GitBranch} tone="info" />
        <KpiCard label="Active products" value={data.counts.products} icon={Package} tone="accent" />
        <KpiCard label="GL accounts" value={data.counts.accounts} icon={Building2} tone="warn" />
      </div>
      )}

      {bizMessage && (
        <p className={`mb-3 text-sm ${bizMessage.ok ? "text-brand-deep" : "text-danger"}`}>
          {bizMessage.text}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {canEditBusiness && (
        <Panel title="Business profile" subtitle="Affects receipts, tax, and reports">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Business name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Default branch</label>
              <Select value={defaultBranchId} onChange={(e) => setDefaultBranchId(e.target.value)}>
                {data.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code}){b.isDefault ? " — current default" : ""}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-[11px] text-ink-faint">
                Manage locations on{" "}
                <Link href="/branches" className="text-brand hover:underline">
                  Branches
                </Link>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-ink-muted">Currency</label>
                <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="RWF">RWF</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-muted">Financial year</label>
                <Input
                  value={fiscalYear}
                  onChange={(e) => setFiscalYear(e.target.value)}
                  placeholder="FY 2026"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">VAT rate (%)</label>
              <Input
                value={vatPct}
                onChange={(e) => setVatPct(e.target.value)}
                inputMode="decimal"
              />
              <p className="mt-1 text-[11px] text-ink-faint">
                Rwanda standard is 18%. Applied on taxable sales — see{" "}
                <Link href="/tax" className="text-brand hover:underline">
                  Tax
                </Link>
                .
              </p>
            </div>
            <Button onClick={saveBusiness} disabled={pendingBiz || !dirty} className="w-full sm:w-auto">
              {pendingBiz ? "Saving…" : "Save business settings"}
            </Button>
          </div>
        </Panel>
        )}

        <Panel title="Your account" subtitle="Signed-in profile">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge variant="brand">{data.me.role}</Badge>
            {data.me.branchName && <Badge variant="info">{data.me.branchName}</Badge>}
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Display name</label>
              <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Email</label>
              <Input value={data.me.email} readOnly />
            </div>
            {profileMessage && (
              <p className={`text-sm ${profileMessage.ok ? "text-brand-deep" : "text-danger"}`}>
                {profileMessage.text}
              </p>
            )}
            <Button
              variant="secondary"
              onClick={saveProfile}
              disabled={pendingProfile || profileName.trim() === data.me.name}
            >
              {pendingProfile ? "Saving…" : "Update name"}
            </Button>
          </div>
        </Panel>

        <Panel title="Change password" subtitle="At least 6 characters">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Current password</label>
              <Input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">New password</label>
              <Input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Confirm new password</label>
              <Input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            {pwMessage && (
              <p className={`text-sm ${pwMessage.ok ? "text-brand-deep" : "text-danger"}`}>
                {pwMessage.text}
              </p>
            )}
            <Button
              variant="secondary"
              onClick={savePassword}
              disabled={pendingPw || !currentPassword || !newPassword}
            >
              {pendingPw ? "Updating…" : "Update password"}
            </Button>
          </div>
        </Panel>

        <Panel title="Roles & access">
          <ul className="space-y-2 text-sm">
            {ROLES.map((r) => {
              const count = data.roleCounts.find((x) => x.role === r)?.count ?? 0;
              return (
                <li
                  key={r}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                >
                  <span>{r.charAt(0) + r.slice(1).toLowerCase()}</span>
                  <span className="text-xs text-ink-faint">
                    {count} user{count === 1 ? "" : "s"}
                  </span>
                </li>
              );
            })}
          </ul>
          <Link href="/security" className="mt-3 inline-flex items-center gap-1.5 text-xs text-brand hover:underline">
            <Shield className="h-3.5 w-3.5" /> Open Security & audit
          </Link>
        </Panel>

        <Panel title="Branches" className="lg:col-span-2">
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.branches.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span>
                  {b.name}{" "}
                  <span className="text-xs text-ink-faint">({b.code})</span>
                </span>
                {b.isDefault && <Badge variant="brand">Default</Badge>}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/branches">
              <Button variant="secondary" size="sm">
                Branch performance
              </Button>
            </Link>
            <Link href="/notifications">
              <Button variant="ghost" size="sm">
                View alerts
              </Button>
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}
