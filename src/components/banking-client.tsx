"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordCashOut, transferFunds } from "@/lib/actions";
import { PageHeader, Panel, Button, Input, Select } from "@/components/ui/primitives";
import { formatCurrency, cn } from "@/lib/utils";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Landmark,
  Smartphone,
  Wallet,
  X,
} from "lucide-react";

type AccountRow = {
  code: string;
  name: string;
  balance: number;
  type: string;
};

type CashbookRow = {
  id: string;
  number: string;
  time: string;
  date: string;
  description: string;
  account: string;
  code: string;
  refType: string | null;
  in: number;
  out: number;
};

type PanelMode = "closed" | "transfer" | "cashout";

const ACCOUNT_OPTS = [
  { code: "1000", label: "Cash" },
  { code: "1100", label: "Bank" },
  { code: "1200", label: "Mobile money" },
] as const;

const EXPENSE_CATS = [
  "Rent",
  "Utilities",
  "Transport",
  "Supplies",
  "Wages",
  "Owner draw",
  "Other",
] as const;

const icons = {
  Cash: Wallet,
  Bank: Landmark,
  "Mobile money": Smartphone,
} as const;

export function BankingClient({
  accounts,
  totalLiquid,
  todayIn,
  todayOut,
  cashbook,
}: {
  accounts: AccountRow[];
  totalLiquid: number;
  todayIn: number;
  todayOut: number;
  cashbook: CashbookRow[];
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<PanelMode>("closed");
  const [fromCode, setFromCode] = useState("1000");
  const [toCode, setToCode] = useState("1100");
  const [amountText, setAmountText] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<(typeof EXPENSE_CATS)[number]>("Other");
  const [filterCode, setFilterCode] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const balanceByCode = useMemo(
    () => new Map(accounts.map((a) => [a.code, a.balance])),
    [accounts],
  );

  const filteredBook = useMemo(() => {
    if (filterCode === "all") return cashbook;
    return cashbook.filter((r) => r.code === filterCode);
  }, [cashbook, filterCode]);

  function openTransfer() {
    setFromCode("1000");
    setToCode("1100");
    setAmountText("");
    setNote("");
    setError(null);
    setPanel("transfer");
  }

  function openCashOut(from?: string) {
    setFromCode(from ?? "1000");
    setAmountText("");
    setNote("");
    setCategory("Other");
    setError(null);
    setPanel("cashout");
  }

  function closePanel() {
    setPanel("closed");
    setError(null);
  }

  function submitTransfer(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const amount = Number(amountText);
    if (!Number.isInteger(amount) || amount <= 0) {
      setError("Enter a whole amount in RWF");
      return;
    }
    startTransition(async () => {
      const result = await transferFunds({
        fromCode: fromCode as "1000" | "1100" | "1200",
        toCode: toCode as "1000" | "1100" | "1200",
        amount,
        note: note || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(`Transferred ${formatCurrency(amount)}`);
      closePanel();
      router.refresh();
    });
  }

  function submitCashOut(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const amount = Number(amountText);
    if (!Number.isInteger(amount) || amount <= 0) {
      setError("Enter a whole amount in RWF");
      return;
    }
    startTransition(async () => {
      const result = await recordCashOut({
        fromCode: fromCode as "1000" | "1100" | "1200",
        amount,
        category,
        note: note || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(`Recorded ${formatCurrency(amount)} · ${category}`);
      closePanel();
      router.refresh();
    });
  }

  return (
    <div>
      <PageHeader
        title="Banking & Cash Management"
        description="Cash, bank, and MoMo balances from the ledger — transfer between tills or record cash-out."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => (panel === "cashout" ? closePanel() : openCashOut())}
            >
              {panel === "cashout" ? <X className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
              {panel === "cashout" ? "Close" : "Cash out"}
            </Button>
            <Button size="sm" onClick={() => (panel === "transfer" ? closePanel() : openTransfer())}>
              {panel === "transfer" ? <X className="h-4 w-4" /> : <ArrowLeftRight className="h-4 w-4" />}
              {panel === "transfer" ? "Close" : "Transfer"}
            </Button>
          </>
        }
      />

      {message && <p className="mb-3 text-sm font-medium text-brand-deep">{message}</p>}
      {error && panel === "closed" && <p className="mb-3 text-sm text-danger">{error}</p>}

      {panel === "transfer" && (
        <Panel title="Transfer between accounts" className="mb-4">
          <form onSubmit={submitTransfer} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs text-ink-muted">From</label>
              <Select
                value={fromCode}
                onChange={(e) => setFromCode(e.target.value)}
                className="w-full"
              >
                {ACCOUNT_OPTS.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.label} · {formatCurrency(balanceByCode.get(a.code) ?? 0)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">To</label>
              <Select value={toCode} onChange={(e) => setToCode(e.target.value)} className="w-full">
                {ACCOUNT_OPTS.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.label} · {formatCurrency(balanceByCode.get(a.code) ?? 0)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Amount (RWF)</label>
              <Input
                type="text"
                inputMode="numeric"
                autoFocus
                className="h-11 text-lg font-semibold"
                value={amountText}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  if (v !== "" && !/^\d+$/.test(v)) return;
                  setAmountText(v);
                }}
                placeholder="e.g. 50000"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Note (optional)</label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Bank deposit…" />
            </div>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
              <Button type="submit" size="sm" disabled={pending || fromCode === toCode}>
                {pending ? "Transferring…" : "Confirm transfer"}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={closePanel}>
                Cancel
              </Button>
              {error && <p className="text-sm text-danger">{error}</p>}
            </div>
          </form>
        </Panel>
      )}

      {panel === "cashout" && (
        <Panel title="Cash out / expense" className="mb-4">
          <form onSubmit={submitCashOut} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Pay from</label>
              <Select
                value={fromCode}
                onChange={(e) => setFromCode(e.target.value)}
                className="w-full"
              >
                {ACCOUNT_OPTS.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.label} · {formatCurrency(balanceByCode.get(a.code) ?? 0)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Category</label>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value as (typeof EXPENSE_CATS)[number])}
                className="w-full"
              >
                {EXPENSE_CATS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Amount (RWF)</label>
              <Input
                type="text"
                inputMode="numeric"
                autoFocus
                className="h-11 text-lg font-semibold"
                value={amountText}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  if (v !== "" && !/^\d+$/.test(v)) return;
                  setAmountText(v);
                }}
                placeholder="e.g. 15000"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Note (optional)</label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Receipt #, vendor…"
              />
            </div>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Saving…" : "Record cash-out"}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={closePanel}>
                Cancel
              </Button>
              {error && <p className="text-sm text-danger">{error}</p>}
            </div>
          </form>
        </Panel>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {accounts.map((a) => {
          const Icon = icons[a.type as keyof typeof icons] ?? Wallet;
          return (
            <div key={a.code} className="rounded-[var(--radius)] border border-border bg-surface-raised p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-ink-muted">
                  <Icon className="h-4 w-4" />
                  <span className="text-xs">{a.type}</span>
                </div>
                <button
                  type="button"
                  onClick={() => openCashOut(a.code)}
                  className="text-[11px] font-medium text-brand hover:underline"
                >
                  Pay from
                </button>
              </div>
              <p className="mt-2 text-sm font-medium">{a.name}</p>
              <p className="mt-1 font-display text-xl font-semibold">{formatCurrency(a.balance)}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--radius)] border border-border bg-surface-raised p-4">
          <p className="text-xs uppercase tracking-wide text-ink-faint">Total liquid</p>
          <p className="mt-1 font-display text-2xl font-semibold">{formatCurrency(totalLiquid)}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-border bg-surface-raised p-4">
          <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-ink-faint">
            <ArrowDownLeft className="h-3.5 w-3.5 text-success" /> POS in today
          </p>
          <p className="mt-1 font-display text-2xl font-semibold text-success">
            {formatCurrency(todayIn)}
          </p>
        </div>
        <div className="rounded-[var(--radius)] border border-border bg-surface-raised p-4">
          <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-ink-faint">
            <ArrowUpRight className="h-3.5 w-3.5 text-accent" /> Out today
          </p>
          <p className="mt-1 font-display text-2xl font-semibold text-accent">
            {formatCurrency(todayOut)}
          </p>
        </div>
      </div>

      <Panel
        title="Cashbook"
        subtitle="Ledger movements on cash, bank, and MoMo"
        className="mt-4"
        bodyClassName="p-0"
        actions={
          <Select
            value={filterCode}
            onChange={(e) => setFilterCode(e.target.value)}
            className="h-8 text-xs"
          >
            <option value="all">All accounts</option>
            {ACCOUNT_OPTS.map((a) => (
              <option key={a.code} value={a.code}>
                {a.label}
              </option>
            ))}
          </Select>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-surface text-xs uppercase text-ink-faint">
              <tr>
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Account</th>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2 text-right font-medium">In</th>
                <th className="px-4 py-2 text-right font-medium">Out</th>
              </tr>
            </thead>
            <tbody>
              {filteredBook.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-ink-muted">
                    No movements yet — sell, transfer, or cash out
                  </td>
                </tr>
              )}
              {filteredBook.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="whitespace-nowrap px-4 py-2.5 text-ink-faint">
                    {r.date} {r.time}
                    <p className="font-mono text-[10px]">{r.number}</p>
                  </td>
                  <td className="px-4 py-2.5 text-ink-muted">{r.account}</td>
                  <td className="px-4 py-2.5">
                    {r.description}
                    {r.refType && (
                      <span className="ml-1 text-[10px] uppercase text-ink-faint">{r.refType}</span>
                    )}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2.5 text-right font-medium",
                      r.in > 0 ? "text-success" : "text-ink-faint",
                    )}
                  >
                    {r.in > 0 ? formatCurrency(r.in) : "—"}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2.5 text-right font-medium",
                      r.out > 0 ? "text-accent" : "text-ink-faint",
                    )}
                  >
                    {r.out > 0 ? formatCurrency(r.out) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
