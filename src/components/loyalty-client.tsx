"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adjustLoyaltyPoints, redeemLoyaltyPoints } from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/kpi-card";
import { Button, Input, Panel } from "@/components/ui/primitives";
import { formatCurrency, cn } from "@/lib/utils";
import {
  Gift,
  Minus,
  Plus,
  Search,
  Sparkles,
  Star,
  Users,
  X,
} from "lucide-react";

type Member = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  segment: string;
  type: string;
  points: number;
  tier: "Bronze" | "Silver" | "Gold";
  balance: number;
  saleCount: number;
  lastPurchase: string | null;
  redeemValue: number;
  nextTierAt: number | null;
  ptsToNext: number;
  progress: number;
};

type LoyaltyPayload = {
  memberCount: number;
  pointsIssued: number;
  redeemableValue: number;
  membersWithPoints: number;
  tiers: { Bronze: number; Silver: number; Gold: number };
  members: Member[];
  rules: {
    earnRate: string;
    redeemRate: string;
    tiers: { name: string; range: string; perk: string }[];
  };
};

const TIER_FILTERS = ["All", "Gold", "Silver", "Bronze"] as const;

const tierBadge: Record<Member["tier"], "brand" | "info" | "default"> = {
  Gold: "brand",
  Silver: "info",
  Bronze: "default",
};

export function LoyaltyClient({ data }: { data: LoyaltyPayload }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [tierFilter, setTierFilter] = useState<(typeof TIER_FILTERS)[number]>("All");
  const [selectedId, setSelectedId] = useState<string | null>(data.members[0]?.id ?? null);
  const [mode, setMode] = useState<"idle" | "award" | "redeem">("idle");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    let list = data.members;
    if (tierFilter !== "All") list = list.filter((m) => m.tier === tierFilter);
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(needle) ||
          (m.phone ?? "").toLowerCase().includes(needle) ||
          (m.email ?? "").toLowerCase().includes(needle),
      );
    }
    return list;
  }, [data.members, q, tierFilter]);

  const selected = useMemo(
    () => data.members.find((m) => m.id === selectedId) ?? filtered[0] ?? null,
    [data.members, selectedId, filtered],
  );

  function openAward() {
    setMode("award");
    setAmount("100");
    setReason("Manual award");
    setMessage(null);
  }

  function openRedeem() {
    setMode("redeem");
    const maxBlock = selected ? Math.floor(selected.points / 100) * 100 : 0;
    setAmount(selected && maxBlock > 0 ? String(Math.min(100, maxBlock)) : "");
    setReason("In-store redeem → store credit");
    setMessage(null);
  }

  function submit() {
    if (!selected) return;
    const pts = Math.trunc(Number(amount));
    if (!Number.isFinite(pts) || pts <= 0) {
      setMessage({ ok: false, text: "Enter a positive points amount" });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      try {
        const result =
          mode === "redeem"
            ? await redeemLoyaltyPoints({
                customerId: selected.id,
                points: pts,
                reason,
              })
            : await adjustLoyaltyPoints({
                customerId: selected.id,
                delta: pts,
                reason,
              });
        if (mode === "redeem" && "creditValue" in result) {
          setMessage({
            ok: true,
            text: `${result.customerName}: −${pts} pts → ${formatCurrency(result.creditValue)} store credit (balance ${formatCurrency(result.balance)}) · ${result.tier}`,
          });
        } else if ("delta" in result) {
          setMessage({
            ok: true,
            text: `${result.customerName}: ${result.delta > 0 ? "+" : ""}${result.delta} pts → ${result.points} (${result.tier})`,
          });
        }
        setMode("idle");
        setAmount("");
        router.refresh();
      } catch (e) {
        setMessage({ ok: false, text: e instanceof Error ? e.message : "Failed" });
      }
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Loyalty & CRM
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Points, tiers, and redeem — redeem posts store credit to the customer balance and ledger.
          </p>
        </div>
        <Link href="/customers">
          <Button size="sm" variant="secondary">
            <Users className="h-4 w-4" /> Customers
          </Button>
        </Link>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Active members" value={data.memberCount} icon={Users} tone="brand" />
        <KpiCard label="Points on file" value={data.pointsIssued.toLocaleString()} icon={Star} tone="accent" />
        <KpiCard
          label="With points"
          value={data.membersWithPoints}
          icon={Sparkles}
          tone="info"
        />
        <KpiCard
          label="Est. redeem value"
          value={data.redeemableValue}
          icon={Gift}
          currency
          tone="warn"
        />
      </div>

      {message && (
        <p className={`mb-3 text-sm ${message.ok ? "text-brand-deep" : "text-danger"}`}>
          {message.text}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <Panel title="Membership levels">
            <ul className="space-y-2 text-sm">
              {data.rules.tiers.map((t) => {
                const n = data.tiers[t.name as keyof typeof data.tiers] ?? 0;
                return (
                  <li
                    key={t.name}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5"
                  >
                    <div>
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-ink-faint">{t.range}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-brand">{t.perk}</span>
                      <p className="text-[11px] text-ink-faint">{n} members</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-ink-muted">
              <p>{data.rules.earnRate}</p>
              <p>{data.rules.redeemRate}</p>
            </div>
          </Panel>

          {selected && (
            <Panel
              title={selected.name}
              subtitle={`${selected.tier} · ${selected.points.toLocaleString()} pts`}
              actions={
                <Badge variant={tierBadge[selected.tier]}>{selected.tier}</Badge>
              }
            >
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-ink-faint">Phone</dt>
                  <dd>{selected.phone ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-faint">Segment</dt>
                  <dd>{selected.segment}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-faint">Tickets</dt>
                  <dd>{selected.saleCount}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-faint">Last purchase</dt>
                  <dd>{selected.lastPurchase ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-faint">Redeem value</dt>
                  <dd className="font-medium text-brand">
                    {formatCurrency(selected.redeemValue)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-faint">AR balance</dt>
                  <dd>
                    {selected.balance > 0
                      ? `Owes ${formatCurrency(selected.balance)}`
                      : selected.balance < 0
                        ? `Credit ${formatCurrency(-selected.balance)}`
                        : "—"}
                  </dd>
                </div>
              </dl>

              {selected.nextTierAt != null && (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-ink-muted">
                    <span>Progress to next tier</span>
                    <span>{selected.ptsToNext} pts to go</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${selected.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {mode === "idle" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" onClick={openAward}>
                    <Plus className="h-3.5 w-3.5" /> Award points
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={openRedeem}
                    disabled={selected.points <= 0}
                  >
                    <Minus className="h-3.5 w-3.5" /> Redeem
                  </Button>
                  <Link href={`/customers?customer=${selected.id}`}>
                    <Button size="sm" variant="ghost">
                      Customer profile
                    </Button>
                  </Link>
                  {selected.balance > 0 && (
                    <Link href={`/quick-pay?customer=${selected.id}`}>
                      <Button size="sm" variant="ghost">
                        Collect debt
                      </Button>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="mt-4 space-y-3 rounded-lg border border-border bg-surface p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {mode === "redeem" ? "Redeem points" : "Award points"}
                    </p>
                    <button
                      type="button"
                      onClick={() => setMode("idle")}
                      className="rounded p-1 text-ink-muted hover:bg-surface-sunken"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-ink-muted">Points</label>
                    <Input
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      inputMode="numeric"
                      placeholder="100"
                    />
                    {mode === "redeem" && (
                      <p className="mt-1 text-[11px] text-ink-faint">
                        Available {selected.points.toLocaleString()} · ≈{" "}
                        {formatCurrency(
                          Math.floor(Math.max(0, Number(amount) || 0) / 100) * 1000,
                        )}{" "}
                        value
                      </p>
                    )}
                    {mode === "redeem" && selected.points >= 100 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {[100, 200, 500]
                          .filter((n) => n <= selected.points)
                          .map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setAmount(String(n))}
                              className="rounded border border-border px-2 py-0.5 text-[10px] hover:border-brand"
                            >
                              {n}
                            </button>
                          ))}
                        <button
                          type="button"
                          onClick={() => setAmount(String(selected.points))}
                          className="rounded border border-border px-2 py-0.5 text-[10px] hover:border-brand"
                        >
                          All
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-ink-muted">Reason</label>
                    <Input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Optional note"
                    />
                  </div>
                  <Button onClick={submit} disabled={pending} className="w-full">
                    {pending
                      ? "Saving…"
                      : mode === "redeem"
                        ? "Confirm redeem"
                        : "Confirm award"}
                  </Button>
                </div>
              )}
            </Panel>
          )}
        </div>

        <Panel
          title="Members"
          subtitle={`${filtered.length} shown`}
          className="lg:col-span-3"
          bodyClassName="p-0"
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
            <div className="relative min-w-[180px] flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name or phone…"
                className="h-8 pl-8 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {TIER_FILTERS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTierFilter(t)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-xs font-medium",
                    tierFilter === t
                      ? "border-brand bg-brand text-white"
                      : "border-border hover:border-brand",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <ul className="max-h-[32rem] overflow-y-auto">
            {filtered.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-ink-muted">No members match.</li>
            )}
            {filtered.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(m.id);
                    setMode("idle");
                    setMessage(null);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 border-b border-border px-4 py-3 text-left text-sm hover:bg-surface",
                    selected?.id === m.id && "bg-brand-soft/40",
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.name}</p>
                    <p className="text-xs text-ink-faint">
                      {m.phone ?? m.segment}
                      {m.lastPurchase ? ` · last ${m.lastPurchase}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge variant={tierBadge[m.tier]}>{m.tier}</Badge>
                    <p className="mt-1 font-medium text-brand">{m.points.toLocaleString()} pts</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
