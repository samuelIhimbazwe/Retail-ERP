"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createBranch,
  setDefaultBranch,
  updateBranch,
} from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/kpi-card";
import { Button, Input, Panel } from "@/components/ui/primitives";
import { formatCurrency, cn } from "@/lib/utils";
import {
  ArrowLeftRight,
  Boxes,
  Building2,
  Pencil,
  Plus,
  Star,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";

export type BranchRow = {
  id: string;
  name: string;
  code: string;
  isDefault: boolean;
  sales: number;
  profit: number;
  stock: number;
  saleCount: number;
  avgTicket: number;
  staffCount: number;
  health: number;
  salesShare: number;
};

type BranchesPayload = {
  branches: BranchRow[];
  periodLabel: string;
  shortLabel: string;
  groupSales: number;
  groupProfit: number;
  groupStock: number;
  groupTickets: number;
  lowStock: number;
};

export function BranchesClient({ data }: { data: BranchesPayload }) {
  const router = useRouter();
  const [mode, setMode] = useState<"closed" | "create" | "edit">("closed");
  const [editing, setEditing] = useState<BranchRow | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [makeDefault, setMakeDefault] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function openCreate() {
    setMode("create");
    setEditing(null);
    setName("");
    setCode("");
    setMakeDefault(false);
    setMessage(null);
  }

  function openEdit(b: BranchRow) {
    setMode("edit");
    setEditing(b);
    setName(b.name);
    setCode(b.code);
    setMakeDefault(false);
    setMessage(null);
  }

  function closeForm() {
    setMode("closed");
    setEditing(null);
    setMessage(null);
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      try {
        if (mode === "create") {
          await createBranch({ name, code, makeDefault });
          setMessage({ ok: true, text: "Branch created" });
        } else if (editing) {
          await updateBranch({ id: editing.id, name, code });
          setMessage({ ok: true, text: "Branch updated" });
        }
        closeForm();
        router.refresh();
      } catch (e) {
        setMessage({ ok: false, text: e instanceof Error ? e.message : "Save failed" });
      }
    });
  }

  function makeDefaultBranch(id: string) {
    startTransition(async () => {
      try {
        await setDefaultBranch(id);
        router.refresh();
      } catch (e) {
        setMessage({ ok: false, text: e instanceof Error ? e.message : "Failed" });
      }
    });
  }

  const top = [...data.branches].sort((a, b) => b.sales - a.sales)[0];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Multi-Branch Management
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Performance for {data.periodLabel}. Inventory is shared; sales post to the selling branch.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add branch
        </Button>
      </div>

      {message && mode === "closed" && (
        <p className={`mb-3 text-sm ${message.ok ? "text-brand-deep" : "text-danger"}`}>{message.text}</p>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Group sales" value={data.groupSales} icon={Wallet} currency tone="brand" />
        <KpiCard label="Group profit" value={data.groupProfit} icon={TrendingUp} currency tone="accent" />
        <KpiCard label="Tickets" value={data.groupTickets} icon={Building2} tone="info" />
        <KpiCard
          label="Inventory (shared)"
          value={data.groupStock}
          icon={Boxes}
          currency
          tone={data.lowStock > 0 ? "warn" : "info"}
        />
      </div>

      {mode !== "closed" && (
        <Panel
          className="mb-4"
          title={mode === "create" ? "New branch" : `Edit ${editing?.name}`}
          subtitle="Code is unique (2–8 letters/digits)"
          actions={
            <button type="button" onClick={closeForm} className="rounded-lg p-1 text-ink-muted hover:bg-surface">
              <X className="h-4 w-4" />
            </button>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Gisozi Branch" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Code</label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="GIS"
                maxLength={8}
              />
            </div>
          </div>
          {mode === "create" && (
            <label className="mt-3 flex items-center gap-2 text-sm text-ink-muted">
              <input
                type="checkbox"
                checked={makeDefault}
                onChange={(e) => setMakeDefault(e.target.checked)}
                className="rounded border-border"
              />
              Set as default branch
            </label>
          )}
          {message && (
            <p className={`mt-2 text-sm ${message.ok ? "text-brand-deep" : "text-danger"}`}>{message.text}</p>
          )}
          <div className="mt-3 flex gap-2">
            <Button onClick={save} disabled={pending || !name.trim() || code.trim().length < 2}>
              {pending ? "Saving…" : mode === "create" ? "Create branch" : "Save changes"}
            </Button>
            <Button variant="ghost" onClick={closeForm}>
              Cancel
            </Button>
          </div>
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {data.branches.map((b) => (
          <div
            key={b.id}
            className={cn(
              "rounded-[var(--radius)] border border-border bg-surface-raised p-5 shadow-[var(--shadow-sm)]",
              top?.id === b.id && data.groupSales > 0 && "ring-1 ring-brand/40",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display text-xl font-semibold">{b.name}</p>
                  {b.isDefault && <Badge variant="brand">Default</Badge>}
                  {top?.id === b.id && data.groupSales > 0 && <Badge variant="success">Top</Badge>}
                </div>
                <p className="text-xs text-ink-faint">{b.code}</p>
              </div>
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-display text-lg font-bold",
                  b.health >= 80
                    ? "bg-success-soft text-success"
                    : b.health >= 65
                      ? "bg-brand-soft text-brand"
                      : "bg-warn-soft text-warn",
                )}
                title="Health score"
              >
                {b.health}
              </div>
            </div>

            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-muted">Sales</dt>
                <dd className="font-medium">{formatCurrency(b.sales)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">Share</dt>
                <dd className="font-medium">{b.salesShare}%</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">Profit</dt>
                <dd className="font-medium">{formatCurrency(b.profit)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">Tickets</dt>
                <dd className="font-medium">{b.saleCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">Avg ticket</dt>
                <dd className="font-medium">{formatCurrency(b.avgTicket)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">Staff</dt>
                <dd className="font-medium">{b.staffCount}</dd>
              </div>
            </dl>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${Math.min(100, b.salesShare)}%` }}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => openEdit(b)} disabled={pending}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              {!b.isDefault && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => makeDefaultBranch(b.id)}
                  disabled={pending}
                >
                  <Star className="h-3.5 w-3.5" /> Default
                </Button>
              )}
              <Link href="/banking" className="ml-auto">
                <Button variant="ghost" size="sm">
                  <ArrowLeftRight className="h-3.5 w-3.5" /> Transfer funds
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>

      <Panel title="Consolidated snapshot" subtitle={data.shortLabel} className="mt-4">
        <p className="text-sm text-ink-muted">
          Group sales {formatCurrency(data.groupSales)} · Group profit{" "}
          {formatCurrency(data.groupProfit)} · Shared inventory {formatCurrency(data.groupStock)}
          {data.lowStock > 0 ? ` · ${data.lowStock} low-stock SKUs` : ""} · {data.branches.length}{" "}
          location{data.branches.length === 1 ? "" : "s"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/settings">
            <Button variant="secondary" size="sm">
              Business settings
            </Button>
          </Link>
          <Link href="/bi">
            <Button variant="ghost" size="sm">
              BI analytics
            </Button>
          </Link>
        </div>
      </Panel>
    </div>
  );
}
