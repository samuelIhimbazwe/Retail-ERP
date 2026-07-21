"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createManualJournal } from "@/lib/actions";
import { PageHeader, Panel, Button, Input, Select } from "@/components/ui/primitives";
import { Badge, statusBadge } from "@/components/ui/badge";
import { formatCurrency, cn } from "@/lib/utils";
import { downloadCsv, toCsv } from "@/lib/csv";
import { BookPlus, Download, Plus, Trash2, X } from "lucide-react";

type AccountRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  balance: number;
};

type JournalLine = {
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
};

type JournalRow = {
  id: string;
  number: string;
  description: string;
  status: string;
  refType: string | null;
  date: string;
  time: string;
  amount: number;
  lines: JournalLine[];
};

type AccountOption = { code: string; name: string; type: string };

type DraftLine = {
  key: string;
  code: string;
  side: "debit" | "credit";
  amountText: string;
};

export function AccountingClient({
  accounts,
  accountOptions,
  journals,
  totals,
  cash,
  bank,
  momo,
  ar,
  ap,
}: {
  accounts: AccountRow[];
  accountOptions: AccountOption[];
  journals: JournalRow[];
  totals: {
    assets: number;
    liabilities: number;
    equity: number;
    revenue: number;
    expenses: number;
  };
  cash: number;
  bank: number;
  momo: number;
  ar: number;
  ap: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([
    { key: "1", code: "5100", side: "debit", amountText: "" },
    { key: "2", code: "1000", side: "credit", amountText: "" },
  ]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filteredAccounts = useMemo(() => {
    if (typeFilter === "ALL") return accounts;
    return accounts.filter((a) => a.type === typeFilter);
  }, [accounts, typeFilter]);

  const debitSum = lines.reduce((s, l) => {
    if (l.side !== "debit") return s;
    const n = Number(l.amountText);
    return s + (Number.isInteger(n) ? n : 0);
  }, 0);
  const creditSum = lines.reduce((s, l) => {
    if (l.side !== "credit") return s;
    const n = Number(l.amountText);
    return s + (Number.isInteger(n) ? n : 0);
  }, 0);
  const balanced = debitSum > 0 && debitSum === creditSum;

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        key: String(Date.now()),
        code: accountOptions[0]?.code ?? "1000",
        side: "debit",
        amountText: "",
      },
    ]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!balanced) {
      setError("Debits must equal credits");
      return;
    }
    startTransition(async () => {
      const result = await createManualJournal({
        description,
        lines: lines.map((l) => {
          const amount = Number(l.amountText) || 0;
          return {
            code: l.code,
            debit: l.side === "debit" ? amount : 0,
            credit: l.side === "credit" ? amount : 0,
          };
        }),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(`Posted ${result.number}`);
      setOpen(false);
      setDescription("");
      setLines([
        { key: "1", code: "5100", side: "debit", amountText: "" },
        { key: "2", code: "1000", side: "credit", amountText: "" },
      ]);
      router.refresh();
    });
  }

  function exportTrial() {
    const csv = toCsv(
      ["Code", "Account", "Type", "Balance"],
      accounts.map((a) => [a.code, a.name, a.type, a.balance]),
    );
    downloadCsv("rbiap-trial-balance.csv", csv);
  }

  return (
    <div>
      <PageHeader
        title="Accounting & Financial Management"
        description="Chart of accounts, auto-journals from operations, and manual double-entry."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={exportTrial}>
              <Download className="h-4 w-4" /> Trial balance
            </Button>
            <Link href="/banking">
              <Button variant="secondary" size="sm">
                Banking
              </Button>
            </Link>
            <Button size="sm" onClick={() => (open ? setOpen(false) : (setOpen(true), setError(null)))}>
              {open ? <X className="h-4 w-4" /> : <BookPlus className="h-4 w-4" />}
              {open ? "Close" : "Manual journal"}
            </Button>
          </>
        }
      />

      {message && <p className="mb-3 text-sm font-medium text-brand-deep">{message}</p>}

      {open && (
        <Panel title="Manual journal entry" subtitle="Debits must equal credits" className="mb-4">
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Accrue electricity bill"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-ink-muted">Lines</p>
                <button
                  type="button"
                  onClick={addLine}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" /> Add line
                </button>
              </div>
              {lines.map((line) => (
                <div key={line.key} className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[200px] flex-1">
                    <label className="mb-1 block text-[10px] text-ink-faint">Account</label>
                    <Select
                      value={line.code}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((x) => (x.key === line.key ? { ...x, code: e.target.value } : x)),
                        )
                      }
                      className="w-full"
                    >
                      {accountOptions.map((a) => (
                        <option key={a.code} value={a.code}>
                          {a.code} · {a.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="w-28">
                    <label className="mb-1 block text-[10px] text-ink-faint">Side</label>
                    <Select
                      value={line.side}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((x) =>
                            x.key === line.key
                              ? { ...x, side: e.target.value as "debit" | "credit" }
                              : x,
                          ),
                        )
                      }
                      className="w-full"
                    >
                      <option value="debit">Debit</option>
                      <option value="credit">Credit</option>
                    </Select>
                  </div>
                  <div className="w-32">
                    <label className="mb-1 block text-[10px] text-ink-faint">Amount</label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={line.amountText}
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        if (v !== "" && !/^\d+$/.test(v)) return;
                        setLines((prev) =>
                          prev.map((x) => (x.key === line.key ? { ...x, amountText: v } : x)),
                        );
                      }}
                      placeholder="0"
                      required
                    />
                  </div>
                  <button
                    type="button"
                    disabled={lines.length <= 2}
                    onClick={() => setLines((prev) => prev.filter((x) => x.key !== line.key))}
                    className="mb-1 rounded-lg p-2 text-ink-faint hover:bg-surface hover:text-danger disabled:opacity-30"
                    aria-label="Remove line"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <p
                className={cn(
                  "text-sm font-medium",
                  balanced ? "text-brand" : "text-warn",
                )}
              >
                Debit {formatCurrency(debitSum)} · Credit {formatCurrency(creditSum)}
                {balanced ? " · balanced" : " · unbalanced"}
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={pending || !balanced}>
                  {pending ? "Posting…" : "Post journal"}
                </Button>
              </div>
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
          </form>
        </Panel>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { l: "Assets", v: totals.assets },
          { l: "Liabilities", v: totals.liabilities },
          { l: "Equity", v: totals.equity },
          { l: "Revenue", v: totals.revenue },
          { l: "Expenses", v: totals.expenses },
        ].map((x) => (
          <div key={x.l} className="rounded-[var(--radius)] border border-border bg-surface-raised p-4">
            <p className="text-xs uppercase tracking-wide text-ink-faint">{x.l}</p>
            <p className="mt-1 font-display text-xl font-semibold">{formatCurrency(x.v)}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {[
          { l: "Cash", v: cash },
          { l: "Bank + MoMo", v: bank + momo },
          { l: "AR / AP", v: null as number | null, display: `${formatCurrency(ar)} / ${formatCurrency(ap)}` },
        ].map((x) => (
          <div key={x.l} className="rounded-[var(--radius)] border border-border bg-surface px-4 py-3">
            <p className="text-xs text-ink-faint">{x.l}</p>
            <p className="mt-0.5 text-lg font-semibold">
              {x.display ?? formatCurrency(x.v as number)}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Chart of Accounts"
          bodyClassName="p-0"
          actions={
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-8 text-xs"
            >
              <option value="ALL">All types</option>
              <option value="ASSET">Assets</option>
              <option value="LIABILITY">Liabilities</option>
              <option value="EQUITY">Equity</option>
              <option value="REVENUE">Revenue</option>
              <option value="EXPENSE">Expenses</option>
            </Select>
          }
        >
          <div className="max-h-[32rem] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-surface text-xs uppercase text-ink-faint">
                <tr>
                  <th className="px-4 py-2 font-medium">Code</th>
                  <th className="px-4 py-2 font-medium">Account</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((a) => (
                  <tr key={a.id} className="border-t border-border">
                    <td className="px-4 py-2 font-mono text-xs">{a.code}</td>
                    <td className="px-4 py-2">{a.name}</td>
                    <td className="px-4 py-2 capitalize text-ink-muted">{a.type.toLowerCase()}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatCurrency(a.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Journal entries" subtitle="Tap a row for debit/credit lines" bodyClassName="p-0">
          <div className="max-h-[32rem] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-surface text-xs uppercase text-ink-faint">
                <tr>
                  <th className="px-4 py-2 font-medium">Entry</th>
                  <th className="px-4 py-2 font-medium">Description</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {journals.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-ink-muted">
                      No journals yet — sell, transfer, or post a manual entry
                    </td>
                  </tr>
                )}
                {journals.map((j) => (
                  <Fragment key={j.id}>
                    <tr
                      className="cursor-pointer border-t border-border hover:bg-surface/80"
                      onClick={() => setExpanded((id) => (id === j.id ? null : j.id))}
                    >
                      <td className="px-4 py-2.5">
                        <p className="font-mono text-xs">{j.number}</p>
                        <p className="text-[11px] text-ink-faint">
                          {j.date} {j.time}
                          {j.refType ? ` · ${j.refType}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-2.5">{j.description}</td>
                      <td className="px-4 py-2.5 text-right font-medium">
                        {formatCurrency(j.amount)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={statusBadge(j.status)}>{j.status}</Badge>
                      </td>
                    </tr>
                    {expanded === j.id && (
                      <tr className="border-t border-border bg-surface">
                        <td colSpan={4} className="px-4 py-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-ink-faint">
                                <th className="pb-1 text-left font-medium">Account</th>
                                <th className="pb-1 text-right font-medium">Debit</th>
                                <th className="pb-1 text-right font-medium">Credit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {j.lines.map((l, i) => (
                                <tr key={`${l.code}-${i}`}>
                                  <td className="py-0.5">
                                    <span className="font-mono">{l.code}</span> {l.name}
                                  </td>
                                  <td className="py-0.5 text-right">
                                    {l.debit > 0 ? formatCurrency(l.debit) : "—"}
                                  </td>
                                  <td className="py-0.5 text-right">
                                    {l.credit > 0 ? formatCurrency(l.credit) : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
