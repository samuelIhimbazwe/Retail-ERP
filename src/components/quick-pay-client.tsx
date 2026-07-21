"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency, cn } from "@/lib/utils";
import {
  ArrowLeft,
  Banknote,
  Check,
  CreditCard,
  Search,
  Smartphone,
  X,
} from "lucide-react";
import { collectCustomerPayment } from "@/lib/actions";

type Debtor = {
  id: string;
  name: string;
  phone: string | null;
  segment: string;
  type: string;
  balance: number;
  lastSale: { date: string; total: number; number: string } | null;
};

type PayMethod = "CASH" | "MOMO" | "CARD";

type Receipt = {
  customerName: string;
  paid: number;
  remaining: number;
  method: PayMethod;
};

export function QuickPayClient({
  debtors,
  totalOwed,
  initialCustomerId,
}: {
  debtors: Debtor[];
  totalOwed: number;
  initialCustomerId?: string;
}) {
  const router = useRouter();
  const initial =
    (initialCustomerId && debtors.find((d) => d.id === initialCustomerId)) ||
    (debtors.length === 1 ? debtors[0] : null);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initial?.id ?? null);
  const [amountText, setAmountText] = useState(initial ? String(initial.balance) : "");
  const [method, setMethod] = useState<PayMethod>("CASH");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return debtors;
    return debtors.filter((c) =>
      [c.name, c.phone, c.segment, c.type]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(query)),
    );
  }, [debtors, q]);

  const selected = debtors.find((c) => c.id === selectedId) ?? null;

  function pick(c: Debtor) {
    setSelectedId(c.id);
    setAmountText(String(c.balance));
    setMethod("CASH");
    setError(null);
    setReceipt(null);
  }

  async function collect() {
    if (!selected) return;
    const amount = Number(amountText);
    if (!Number.isInteger(amount) || amount <= 0) {
      setError("Enter a whole amount in RWF");
      return;
    }
    if (amount > selected.balance) {
      setError(`Max is ${formatCurrency(selected.balance)}`);
      return;
    }

    setBusy(true);
    setError(null);
    const result = await collectCustomerPayment(selected.id, amount, method);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setReceipt({
      customerName: result.customerName,
      paid: result.paid,
      remaining: result.remaining,
      method: result.method,
    });
    setSelectedId(null);
    setAmountText("");
    router.refresh();
  }

  const amount = Number(amountText) || 0;
  const amountOk =
    selected != null && Number.isInteger(amount) && amount > 0 && amount <= selected.balance;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/counter" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Counter
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Customer pay</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Collect full or partial — Cash, MoMo, or Card. Under 1 minute.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-ink-faint">Total AR</p>
          <p className="font-display text-lg font-semibold text-accent">{formatCurrency(totalOwed)}</p>
          <p className="text-[11px] text-ink-faint">{debtors.length} debtors</p>
        </div>
      </div>

      {receipt && (
        <div className="mt-4 rounded-2xl border border-brand/30 bg-brand-soft/40 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
                <Check className="h-4 w-4" /> Payment recorded
              </p>
              <p className="mt-1 text-sm text-ink">
                {receipt.customerName} · {formatCurrency(receipt.paid)} via{" "}
                {receipt.method === "CASH" ? "Cash" : receipt.method === "MOMO" ? "MoMo" : "Card"}
              </p>
              <p className="text-xs text-ink-muted">
                Remaining balance {formatCurrency(receipt.remaining)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReceipt(null)}
              className="rounded-lg p-1 text-ink-faint hover:bg-surface hover:text-ink"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setReceipt(null)}
              className="h-10 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-deep"
            >
              Collect another
            </button>
            <Link
              href="/customers"
              className="inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm font-semibold hover:bg-surface"
            >
              Customers
            </Link>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
          {error}
        </div>
      )}

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-faint" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or phone…"
          className="h-14 w-full rounded-2xl border-2 border-border bg-surface-raised pl-12 pr-4 text-lg outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
        />
      </div>

      <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto">
        {filtered.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-ink-muted">
            {debtors.length === 0
              ? "No outstanding balances — credit sales will appear here"
              : "No debtor matches that search"}
          </li>
        )}
        {filtered.map((c) => {
          const active = selectedId === c.id;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => pick(c)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition",
                  active
                    ? "border-brand bg-brand-soft/30 ring-2 ring-brand/20"
                    : "border-border bg-surface-raised hover:border-brand/40",
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">{c.name}</p>
                  <p className="text-xs text-ink-faint">
                    {c.segment} · {c.type}
                    {c.phone ? ` · ${c.phone}` : ""}
                  </p>
                  {c.lastSale && (
                    <p className="text-[11px] text-ink-faint">
                      Last sale {c.lastSale.date} · {formatCurrency(c.lastSale.total)}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] uppercase tracking-wide text-ink-faint">Owes</p>
                  <p className="font-display text-xl font-semibold text-accent">
                    {formatCurrency(c.balance)}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {selected && (
        <div className="mt-4 rounded-2xl border border-border bg-surface-raised p-4 shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{selected.name}</p>
              <p className="text-xs text-ink-muted">
                Owes {formatCurrency(selected.balance)}
              </p>
            </div>
            <Link
              href="/customers"
              className="text-xs font-medium text-brand hover:underline"
            >
              Statement
            </Link>
          </div>

          <label className="mt-3 block text-xs font-medium text-ink-muted">
            Amount to collect (type any amount)
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              value={amountText}
              onChange={(e) => {
                const v = e.target.value.trim();
                if (v !== "" && !/^\d+$/.test(v)) return;
                setAmountText(v);
              }}
              className="mt-1 h-14 w-full rounded-xl border-2 border-border px-3 text-xl font-semibold outline-none focus:border-brand"
              placeholder="e.g. 5000"
            />
          </label>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              Math.min(selected.balance, 5_000),
              Math.min(selected.balance, 20_000),
              Math.floor(selected.balance / 2),
              selected.balance,
            ]
              .filter((a, i, arr) => a > 0 && arr.indexOf(a) === i)
              .map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAmountText(String(a))}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-xs font-semibold",
                    amount === a ? "border-brand bg-brand text-white" : "border-border hover:bg-surface",
                  )}
                >
                  {a === selected.balance ? "Full" : formatCurrency(a)}
                </button>
              ))}
          </div>

          <p className="mt-3 text-xs font-medium text-ink-muted">Method</p>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {(
              [
                { id: "CASH" as const, label: "Cash", icon: Banknote },
                { id: "MOMO" as const, label: "MoMo", icon: Smartphone },
                { id: "CARD" as const, label: "Card", icon: CreditCard },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMethod(id)}
                className={cn(
                  "flex h-12 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold",
                  method === id ? "bg-brand text-white" : "border border-border hover:bg-surface",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void collect()}
            disabled={!amountOk || busy}
            className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-brand text-base font-bold text-white transition hover:bg-brand-deep active:scale-[0.99] disabled:opacity-40"
          >
            {busy ? (
              "Saving…"
            ) : (
              <>
                <Banknote className="h-5 w-5" /> Collect {formatCurrency(amount)}
              </>
            )}
          </button>
          {amountOk && amount < selected.balance && (
            <p className="mt-2 text-center text-xs text-ink-muted">
              After this, balance will be {formatCurrency(selected.balance - amount)}
            </p>
          )}
        </div>
      )}

      {!selected && !receipt && debtors.length > 0 && (
        <p className="mt-6 text-center text-sm text-ink-faint">Select a customer above to collect</p>
      )}
    </div>
  );
}
