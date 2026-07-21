"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/kpi-card";
import { Button, Input, Panel } from "@/components/ui/primitives";
import {
  createLocalApiKey,
  loadIntegrationPrefs,
  markIntegrationChecked,
  revokeLocalApiKey,
  setIntegrationEnabled,
  type IntegrationPrefs,
} from "@/lib/integration-prefs";
import { formatCurrency, cn } from "@/lib/utils";
import {
  CheckCircle2,
  Copy,
  KeyRound,
  Plug,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

type Channel = {
  id: string;
  name: string;
  category: string;
  status: "live" | "configured" | "planned" | "offline";
  detail: string;
  href: string;
  canToggle: boolean;
};

type IntegrationsPayload = {
  businessName: string;
  channels: Channel[];
  live: number;
  planned: number;
  configured: number;
  total: number;
  liquid: number;
  salesToday: number;
};

const CATS = ["All", "Payments", "Banking", "Tax", "Platform", "Hardware", "Messaging"] as const;
const STATUSES = ["All", "live", "configured", "planned"] as const;

const statusBadge: Record<Channel["status"], "success" | "info" | "default" | "warn"> = {
  live: "success",
  configured: "info",
  planned: "default",
  offline: "warn",
};

export function IntegrationsClient({ data }: { data: IntegrationsPayload }) {
  const router = useRouter();
  const [prefs, setPrefs] = useState<IntegrationPrefs>({
    disabled: [],
    apiKeys: [],
    lastChecked: {},
  });
  const [cat, setCat] = useState<(typeof CATS)[number]>("All");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("All");
  const [showKeys, setShowKeys] = useState(false);
  const [keyName, setKeyName] = useState("POS terminal");
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function syncPrefs() {
    setPrefs(loadIntegrationPrefs());
  }

  useEffect(() => {
    syncPrefs();
    const on = () => syncPrefs();
    window.addEventListener("storage", on);
    window.addEventListener("rbiap:integration-prefs", on);
    return () => {
      window.removeEventListener("storage", on);
      window.removeEventListener("rbiap:integration-prefs", on);
    };
  }, []);

  const disabled = useMemo(() => new Set(prefs.disabled), [prefs.disabled]);

  const channels = useMemo(() => {
    return data.channels.map((c) => ({
      ...c,
      enabled: !disabled.has(c.id),
      effectiveStatus: (!c.canToggle || !disabled.has(c.id)
        ? c.status
        : "offline") as Channel["status"],
      lastChecked: prefs.lastChecked[c.id] ?? null,
    }));
  }, [data.channels, disabled, prefs.lastChecked]);

  const filtered = useMemo(() => {
    let list = channels;
    if (cat !== "All") list = list.filter((c) => c.category === cat);
    if (status !== "All") {
      list = list.filter((c) =>
        status === "planned"
          ? c.status === "planned"
          : c.effectiveStatus === status,
      );
    }
    return list;
  }, [channels, cat, status]);

  const enabledLive = channels.filter(
    (c) => c.enabled && (c.status === "live" || c.status === "configured"),
  ).length;

  function toggle(id: string, canToggle: boolean, currentlyEnabled: boolean) {
    if (!canToggle) return;
    setIntegrationEnabled(id, !currentlyEnabled);
    syncPrefs();
  }

  function testChannel(id: string, status: Channel["status"]) {
    if (status === "planned") {
      setMessage("Planned channel — marked as reviewed (no live connection yet)");
      markIntegrationChecked(id);
      syncPrefs();
      return;
    }
    setChecking(id);
    markIntegrationChecked(id);
    syncPrefs();
    startTransition(() => {
      router.refresh();
      setTimeout(() => {
        setChecking(null);
        setMessage("Live channel checked — ledger data refreshed");
      }, 400);
    });
  }

  function mintKey() {
    const created = createLocalApiKey(keyName);
    setNewSecret(created.secret);
    syncPrefs();
    setMessage("API key created — copy it now; it won’t be shown again");
  }

  function copySecret() {
    if (!newSecret) return;
    void navigator.clipboard.writeText(newSecret);
    setMessage("Copied to clipboard");
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Integrations
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            {data.businessName} · live ledgers, planned gateways, and local API keys for demos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setShowKeys((v) => !v);
              setNewSecret(null);
            }}
          >
            <KeyRound className="h-4 w-4" /> API keys
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              startTransition(() => {
                router.refresh();
                setMessage("Refreshed from database");
              });
            }}
          >
            <RefreshCw className={cn("h-4 w-4", pending && "animate-spin")} /> Refresh
          </Button>
        </div>
      </div>

      {message && (
        <p className="mb-3 text-sm text-brand-deep">{message}</p>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Live / configured" value={enabledLive} icon={CheckCircle2} tone="brand" />
        <KpiCard label="Planned" value={data.planned} icon={Plug} tone="info" />
        <KpiCard label="Channels" value={data.total} icon={Plug} tone="accent" />
        <KpiCard label="Liquid on ledger" value={data.liquid} icon={Plug} currency tone="warn" />
      </div>

      {showKeys && (
        <Panel
          title="API keys"
          subtitle="Stored on this device only — for local demos / terminal labels"
          className="mb-4"
          actions={
            <button
              type="button"
              onClick={() => {
                setShowKeys(false);
                setNewSecret(null);
              }}
              className="rounded p-1 text-ink-muted hover:bg-surface"
            >
              <X className="h-4 w-4" />
            </button>
          }
        >
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-xs text-ink-muted">Key name</label>
              <Input value={keyName} onChange={(e) => setKeyName(e.target.value)} />
            </div>
            <Button onClick={mintKey}>
              <KeyRound className="h-4 w-4" /> Generate key
            </Button>
          </div>
          {newSecret && (
            <div className="mt-3 rounded-lg border border-brand/30 bg-brand-soft/40 p-3">
              <p className="text-xs text-ink-muted">New secret (copy now)</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <code className="break-all font-mono text-xs">{newSecret}</code>
                <Button size="sm" variant="secondary" onClick={copySecret}>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </Button>
              </div>
            </div>
          )}
          {prefs.apiKeys.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">No keys yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {prefs.apiKeys.map((k) => (
                <li
                  key={k.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{k.name}</p>
                    <p className="font-mono text-xs text-ink-faint">
                      {k.prefix} · {k.createdAt.slice(0, 10)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      revokeLocalApiKey(k.id);
                      syncPrefs();
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {CATS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className={cn(
              "rounded-lg border px-3 py-1 text-xs font-medium",
              cat === c ? "border-brand bg-brand text-white" : "border-border hover:border-brand",
            )}
          >
            {c}
          </button>
        ))}
        <span className="mx-1 text-ink-faint">|</span>
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={cn(
              "rounded-lg border px-3 py-1 text-xs font-medium capitalize",
              status === s
                ? "border-brand bg-brand text-white"
                : "border-border hover:border-brand",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((i) => (
          <div
            key={i.id}
            className={cn(
              "rounded-[var(--radius)] border border-border bg-surface-raised p-4 shadow-[var(--shadow-sm)]",
              !i.enabled && "opacity-60",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-ink-faint">{i.category}</p>
                <p className="mt-1 text-sm font-semibold">{i.name}</p>
              </div>
              <Badge variant={statusBadge[i.effectiveStatus]}>
                {i.effectiveStatus === "offline" ? "Disabled" : i.effectiveStatus}
              </Badge>
            </div>
            <p className="mt-2 text-xs text-ink-muted">{i.detail}</p>
            {i.lastChecked && (
              <p className="mt-1 text-[10px] text-ink-faint">
                Last check{" "}
                {new Date(i.lastChecked).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={i.href}>
                <Button size="sm" variant="secondary" disabled={i.status === "planned" && i.href === "/integrations"}>
                  Open
                </Button>
              </Link>
              <Button
                size="sm"
                variant="ghost"
                disabled={checking === i.id}
                onClick={() => testChannel(i.id, i.status)}
              >
                <RefreshCw
                  className={cn("h-3.5 w-3.5", checking === i.id && "animate-spin")}
                />
                {i.status === "planned" ? "Mark reviewed" : "Test"}
              </Button>
              {i.canToggle && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toggle(i.id, i.canToggle, i.enabled)}
                >
                  {i.enabled ? "Disable" : "Enable"}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-ink-muted">No channels in this filter.</p>
      )}

      <Panel title="How it works" className="mt-4">
        <ul className="space-y-1.5 text-sm text-ink-muted">
          <li>
            · <span className="font-medium text-ink">Live</span> channels post to the chart of
            accounts from POS, receive, payroll, and banking.
          </li>
          <li>
            · <span className="font-medium text-ink">Planned</span> items (RRA EBM, SMS, webhooks)
            keep a slot — enable to mark intent; no external calls yet.
          </li>
          <li>
            · API keys stay in this browser for labeling terminals; they are not sent to a remote
            API.
          </li>
          <li>
            · Today: {data.salesToday} completed sale{data.salesToday === 1 ? "" : "s"} · liquid{" "}
            {formatCurrency(data.liquid)}.
          </li>
        </ul>
      </Panel>
    </div>
  );
}
