"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  collectCustomerPayment,
  createCustomer,
  getCustomerStatement,
  updateCustomer,
} from "@/lib/actions";
import { PageHeader, Panel, Button, Input, Select } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, cn } from "@/lib/utils";
import {
  Banknote,
  CreditCard,
  FileText,
  Pencil,
  Search,
  Smartphone,
  UserPlus,
  Wallet,
  X,
} from "lucide-react";

type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  type: string;
  segment: string;
  balance: number;
  points: number;
  isActive: boolean;
  saleCount: number;
  lifetime: number;
  lastPurchase: string;
  lastTotal: number;
};

type Statement = NonNullable<Awaited<ReturnType<typeof getCustomerStatement>>>;
type PayMethod = "CASH" | "CARD" | "MOMO";
type PanelMode = "closed" | "form" | "pay" | "statement";

const SEGMENTS = ["Regular", "VIP", "Wholesale", "Pharmacy", "New"] as const;
const TYPES = ["Walk-in", "Credit"] as const;

export function CustomersClient({
  customers,
  withDebt,
  debtTotal,
  initialCustomerId,
}: {
  customers: CustomerRow[];
  withDebt: number;
  debtTotal: number;
  initialCustomerId?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "debt" | "credit" | "inactive">("all");
  const [panel, setPanel] = useState<PanelMode>("closed");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [type, setType] = useState<string>("Walk-in");
  const [segment, setSegment] = useState<string>("Regular");
  const [inactive, setInactive] = useState(false);

  const [payCustomerId, setPayCustomerId] = useState("");
  const [payAmountText, setPayAmountText] = useState("");
  const [payMethod, setPayMethod] = useState<PayMethod>("CASH");

  const [statement, setStatement] = useState<Statement | null>(null);
  const [expandedSale, setExpandedSale] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const payTarget = customers.find((c) => c.id === payCustomerId) ?? null;

  useEffect(() => {
    if (!initialCustomerId) return;
    const c = customers.find((x) => x.id === initialCustomerId);
    if (!c) return;
    setError(null);
    setMessage(null);
    setExpandedSale(null);
    startTransition(async () => {
      const data = await getCustomerStatement(c.id);
      if (!data) return;
      setStatement(data);
      setPanel("statement");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once from deep link
  }, [initialCustomerId]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return customers.filter((c) => {
      if (filter === "debt" && c.balance <= 0) return false;
      if (filter === "credit" && c.type !== "Credit") return false;
      if (filter === "inactive" && c.isActive) return false;
      if (filter === "all" && !c.isActive) return false;
      if (!query) return true;
      return [c.name, c.phone, c.email, c.segment, c.type]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(query));
    });
  }, [customers, filter, q]);

  function closePanel() {
    setPanel("closed");
    setEditingId(null);
    setStatement(null);
    setError(null);
  }

  function openCreate() {
    setEditingId(null);
    setName("");
    setPhone("");
    setEmail("");
    setType("Walk-in");
    setSegment("Regular");
    setInactive(false);
    setPanel("form");
    setError(null);
  }

  function openEdit(c: CustomerRow) {
    setEditingId(c.id);
    setName(c.name);
    setPhone(c.phone ?? "");
    setEmail(c.email ?? "");
    setType(c.type);
    setSegment(c.segment);
    setInactive(!c.isActive);
    setPanel("form");
    setError(null);
  }

  function openPay(c: CustomerRow) {
    setPayCustomerId(c.id);
    setPayAmountText(String(c.balance));
    setPayMethod("CASH");
    setPanel("pay");
    setError(null);
  }

  function openStatement(c: CustomerRow) {
    setError(null);
    setMessage(null);
    setExpandedSale(null);
    startTransition(async () => {
      const data = await getCustomerStatement(c.id);
      if (!data) {
        setError("Could not load statement");
        return;
      }
      setStatement(data);
      setPanel("statement");
    });
  }

  function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      if (editingId) {
        const result = await updateCustomer({
          id: editingId,
          name,
          phone: phone || null,
          email: email || null,
          type: type as "Walk-in" | "Credit",
          segment: segment as (typeof SEGMENTS)[number],
          isActive: !inactive,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setMessage(`Updated ${name}`);
      } else {
        const result = await createCustomer({
          name,
          phone: phone || null,
          email: email || null,
          type: type as "Walk-in" | "Credit",
          segment: segment as (typeof SEGMENTS)[number],
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setMessage(`Added ${name}`);
      }
      closePanel();
      router.refresh();
    });
  }

  function submitPay(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const amount = Number(payAmountText);
    if (!Number.isInteger(amount) || amount <= 0) {
      setError("Enter a whole amount in RWF");
      return;
    }
    startTransition(async () => {
      const result = await collectCustomerPayment(payCustomerId, amount, payMethod);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(
        `Collected ${formatCurrency(result.paid)} · remaining ${formatCurrency(result.remaining)}`,
      );
      closePanel();
      router.refresh();
    });
  }

  return (
    <div>
      <PageHeader
        title="Customer Management"
        description={`${customers.filter((c) => c.isActive).length} active · ${withDebt} with debt · ${formatCurrency(debtTotal)} outstanding.`}
        actions={
          <>
            <Link href="/quick-pay">
              <Button variant="secondary" size="sm">
                <Wallet className="h-4 w-4" /> Quick pay
              </Button>
            </Link>
            <Button size="sm" onClick={() => (panel === "form" && !editingId ? closePanel() : openCreate())}>
              {panel === "form" && !editingId ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {panel === "form" && !editingId ? "Close" : "Add customer"}
            </Button>
          </>
        }
      />

      {message && <p className="mb-3 text-sm font-medium text-brand-deep">{message}</p>}
      {error && panel === "closed" && <p className="mb-3 text-sm text-danger">{error}</p>}

      {panel === "form" && (
        <Panel title={editingId ? "Edit customer" : "New customer"} className="mb-4">
          <form onSubmit={submitForm} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="mb-1 block text-xs text-ink-muted">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Phone</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07…" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Email</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Type</label>
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Segment</label>
              <Select value={segment} onChange={(e) => setSegment(e.target.value)}>
                {SEGMENTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </div>
            {editingId && (
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={inactive}
                    onChange={(e) => setInactive(e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  Inactive (hide from POS)
                </label>
              </div>
            )}
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Saving…" : editingId ? "Update customer" : "Save customer"}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={closePanel}>
                Cancel
              </Button>
              {error && <p className="text-sm text-danger">{error}</p>}
            </div>
          </form>
        </Panel>
      )}

      {panel === "pay" && payTarget && (
        <Panel
          title={`Collect from ${payTarget.name}`}
          subtitle={`Owed ${formatCurrency(payTarget.balance)}`}
          className="mb-4"
        >
          <form onSubmit={submitPay} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Amount (RWF)</label>
              <Input
                type="text"
                inputMode="numeric"
                autoFocus
                className="h-12 text-lg font-semibold"
                value={payAmountText}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  if (v !== "" && !/^\d+$/.test(v)) return;
                  setPayAmountText(v);
                }}
                required
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[
                  Math.min(payTarget.balance, 5_000),
                  Math.min(payTarget.balance, 20_000),
                  payTarget.balance,
                ]
                  .filter((a, i, arr) => a > 0 && arr.indexOf(a) === i)
                  .map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setPayAmountText(String(a))}
                      className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:bg-surface"
                    >
                      {formatCurrency(a)}
                    </button>
                  ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-ink-muted">Method</label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: "CASH" as const, label: "Cash", icon: Banknote },
                    { id: "CARD" as const, label: "Card", icon: CreditCard },
                    { id: "MOMO" as const, label: "MoMo", icon: Smartphone },
                  ] as const
                ).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPayMethod(id)}
                    className={cn(
                      "flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold",
                      payMethod === id ? "bg-brand text-white" : "border border-border",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Collecting…" : "Collect payment"}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={closePanel}>
                Cancel
              </Button>
              {error && <p className="text-sm text-danger">{error}</p>}
            </div>
          </form>
        </Panel>
      )}

      {panel === "statement" && statement && (
        <Panel
          title={`Statement · ${statement.name}`}
          subtitle={`${statement.saleCount} sales · lifetime ${formatCurrency(statement.lifetime)} · balance ${formatCurrency(statement.balance)}`}
          className="mb-4"
          actions={
            <Button type="button" variant="secondary" size="sm" onClick={closePanel}>
              <X className="h-4 w-4" /> Close
            </Button>
          }
        >
          <div className="mb-3 grid gap-2 sm:grid-cols-4 text-sm">
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-[11px] text-ink-faint">Phone</p>
              <p className="font-medium">{statement.phone ?? "—"}</p>
            </div>
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-[11px] text-ink-faint">Type / segment</p>
              <p className="font-medium">
                {statement.type} · {statement.segment}
              </p>
            </div>
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-[11px] text-ink-faint">Loyalty points</p>
              <p className="font-medium">{statement.points}</p>
            </div>
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-[11px] text-ink-faint">Credit tickets</p>
              <p className="font-medium">{statement.creditTicketCount}</p>
            </div>
          </div>

          {statement.sales.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">No sales on record yet.</p>
          ) : (
            <ul className="max-h-[28rem] space-y-2 overflow-y-auto">
              {statement.sales.map((s) => (
                <li key={s.id} className="rounded-xl border border-border bg-surface px-3 py-2.5">
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 text-left"
                    onClick={() => setExpandedSale((id) => (id === s.id ? null : s.id))}
                  >
                    <div>
                      <p className="font-mono text-xs font-semibold">{s.number}</p>
                      <p className="text-[11px] text-ink-muted">
                        {s.date} {s.time} · {s.cashier} · {s.method.toLowerCase()}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold">{formatCurrency(s.total)}</p>
                  </button>
                  {expandedSale === s.id && (
                    <div className="mt-2 border-t border-border pt-2 text-xs">
                      <ul className="space-y-1">
                        {s.lines.map((l, i) => (
                          <li key={`${l.sku}-${i}`} className="flex justify-between gap-2">
                            <span>
                              {l.qty}× {l.name}
                            </span>
                            <span>{formatCurrency(l.lineTotal)}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2 space-y-0.5 text-ink-muted">
                        {s.discount > 0 && (
                          <div className="flex justify-between">
                            <span>Discount</span>
                            <span>-{formatCurrency(s.discount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>VAT</span>
                          <span>{formatCurrency(s.tax)}</span>
                        </div>
                        {s.payments.map((p, i) => (
                          <div key={`${p.method}-${i}`} className="flex justify-between capitalize">
                            <span>{p.method.toLowerCase()}</span>
                            <span>{formatCurrency(p.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {[
          { l: "Outstanding AR", v: formatCurrency(debtTotal) },
          { l: "Customers with debt", v: String(withDebt) },
          {
            l: "Lifetime sales (listed)",
            v: formatCurrency(customers.reduce((s, c) => s + c.lifetime, 0)),
          },
        ].map((x) => (
          <div key={x.l} className="rounded-[var(--radius)] border border-border bg-surface-raised px-4 py-3">
            <p className="text-xs text-ink-faint">{x.l}</p>
            <p className="mt-0.5 font-display text-xl font-semibold">{x.v}</p>
          </div>
        ))}
      </div>

      <Panel bodyClassName="p-0">
        <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input
              className="pl-9"
              placeholder="Search name, phone, email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="sm:w-44"
          >
            <option value="all">Active</option>
            <option value="debt">With debt</option>
            <option value="credit">Credit type</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-surface text-xs uppercase text-ink-faint">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Segment</th>
                <th className="px-4 py-3 text-right font-medium">Balance</th>
                <th className="px-4 py-3 text-right font-medium">Lifetime</th>
                <th className="px-4 py-3 font-medium">Last purchase</th>
                <th className="px-4 py-3 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-ink-muted">
                    No customers match.
                  </td>
                </tr>
              )}
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className={cn(
                    "border-t border-border hover:bg-surface/80",
                    !c.isActive && "opacity-60",
                  )}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-[11px] text-ink-faint">
                      {[c.phone, c.email].filter(Boolean).join(" · ") || "—"}
                      {c.points > 0 ? ` · ${c.points} pts` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{c.type}</td>
                  <td className="px-4 py-3">
                    <Badge variant={c.segment === "VIP" ? "brand" : "info"}>{c.segment}</Badge>
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-medium",
                      c.balance > 0 ? "text-accent" : "",
                    )}
                  >
                    {formatCurrency(c.balance)}
                  </td>
                  <td className="px-4 py-3 text-right text-ink-muted">
                    {formatCurrency(c.lifetime)}
                    <p className="text-[11px] text-ink-faint">{c.saleCount} sales</p>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {c.lastPurchase}
                    {c.lastTotal > 0 && (
                      <p className="text-[11px] text-ink-faint">{formatCurrency(c.lastTotal)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openStatement(c)}
                        disabled={pending}
                      >
                        <FileText className="h-3.5 w-3.5" /> Statement
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={c.balance <= 0}
                        onClick={() => openPay(c)}
                      >
                        Collect
                      </Button>
                    </div>
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
