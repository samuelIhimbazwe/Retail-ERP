"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  createPurchaseOrder,
  createSupplier,
  paySupplier,
  updateSupplier,
} from "@/lib/actions";
import { PageHeader, Panel, Button, Select, Input } from "@/components/ui/primitives";
import { Badge, statusBadge } from "@/components/ui/badge";
import { formatCurrency, cn } from "@/lib/utils";
import {
  Banknote,
  CreditCard,
  FilePlus,
  Pencil,
  Plus,
  Smartphone,
  Trash2,
  Truck,
  UserPlus,
  X,
} from "lucide-react";

type SupplierCard = {
  id: string;
  name: string;
  category: string;
  phone: string | null;
  email: string | null;
  balance: number;
  rating: number;
  leadDays: number;
  orders: number;
};

type PoRow = {
  id: string;
  number: string;
  supplier: string;
  supplierId: string;
  date: string;
  items: number;
  total: number;
  status: string;
  rawStatus: string;
  cancellable: boolean;
};

type FormOptions = {
  suppliers: { id: string; name: string }[];
  products: { id: string; name: string; sku: string; costPrice: number; unit: string }[];
};

type LineDraft = { key: string; productId: string; qty: number; qtyText: string };
type PayMethod = "CASH" | "CARD" | "MOMO";
type PanelMode = "closed" | "po" | "supplier" | "pay";

export function PurchasingClient({
  suppliers,
  purchaseOrders,
  openCount,
  payableTotal,
  formOptions,
  initialPaySupplierId,
  initialPoId,
  initialProductId,
}: {
  suppliers: SupplierCard[];
  purchaseOrders: PoRow[];
  openCount: number;
  payableTotal: number;
  formOptions: FormOptions;
  initialPaySupplierId?: string;
  initialPoId?: string;
  initialProductId?: string;
}) {
  const router = useRouter();
  const seedPay = initialPaySupplierId
    ? suppliers.find((s) => s.id === initialPaySupplierId)
    : null;
  const [panel, setPanel] = useState<PanelMode>(seedPay ? "pay" : "closed");
  const [supplierId, setSupplierId] = useState(formOptions.suppliers[0]?.id ?? "");
  const [lines, setLines] = useState<LineDraft[]>([
    {
      key: "1",
      productId: initialProductId && formOptions.products.some((p) => p.id === initialProductId)
        ? initialProductId
        : (formOptions.products[0]?.id ?? ""),
      qty: 10,
      qtyText: "10",
    },
  ]);

  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [sName, setSName] = useState("");
  const [sCategory, setSCategory] = useState("General");
  const [sPhone, setSPhone] = useState("");
  const [sEmail, setSEmail] = useState("");
  const [sLead, setSLead] = useState(3);
  const [sLeadText, setSLeadText] = useState("3");
  const [sRating, setSRating] = useState(4);

  const [paySupplierId, setPaySupplierId] = useState(seedPay?.id ?? "");
  const [payAmountText, setPayAmountText] = useState(seedPay ? String(seedPay.balance) : "");
  const [payMethod, setPayMethod] = useState<PayMethod>("CASH");

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(
    initialPoId
      ? (() => {
          const po = purchaseOrders.find((p) => p.id === initialPoId);
          return po ? `Focused PO ${po.number} · ${po.status}` : null;
        })()
      : initialProductId
        ? "New PO prefilled with selected product"
        : null,
  );
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (initialProductId && !seedPay) setPanel("po");
  }, [initialProductId, seedPay]);

  const productById = useMemo(
    () => new Map(formOptions.products.map((p) => [p.id, p])),
    [formOptions.products],
  );

  const payTarget = suppliers.find((s) => s.id === paySupplierId) ?? null;

  const draftTotal = lines.reduce((s, l) => {
    const p = productById.get(l.productId);
    return s + (p?.costPrice ?? 0) * (l.qty || 0);
  }, 0);

  function closePanel() {
    setPanel("closed");
    setEditingSupplierId(null);
    setError(null);
  }

  function openNewSupplier() {
    setEditingSupplierId(null);
    setSName("");
    setSCategory("General");
    setSPhone("");
    setSEmail("");
    setSLead(3);
    setSLeadText("3");
    setSRating(4);
    setPanel("supplier");
    setError(null);
  }

  function openEditSupplier(s: SupplierCard) {
    setEditingSupplierId(s.id);
    setSName(s.name);
    setSCategory(s.category);
    setSPhone(s.phone ?? "");
    setSEmail(s.email ?? "");
    setSLead(s.leadDays);
    setSLeadText(String(s.leadDays));
    setSRating(s.rating);
    setPanel("supplier");
    setError(null);
  }

  function openPay(s: SupplierCard) {
    setPaySupplierId(s.id);
    setPayAmountText(String(s.balance));
    setPayMethod("CASH");
    setPanel("pay");
    setError(null);
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        key: String(Date.now()),
        productId: formOptions.products[0]?.id ?? "",
        qty: 1,
        qtyText: "1",
      },
    ]);
  }

  function submitPo(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await createPurchaseOrder({
        supplierId,
        lines: lines
          .filter((l) => l.productId && l.qty > 0)
          .map((l) => ({ productId: l.productId, qty: l.qty })),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(`Created ${result.number}`);
      closePanel();
      setLines([
        {
          key: "1",
          productId: formOptions.products[0]?.id ?? "",
          qty: 10,
          qtyText: "10",
        },
      ]);
      router.refresh();
    });
  }

  function submitSupplier(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      if (editingSupplierId) {
        const result = await updateSupplier({
          id: editingSupplierId,
          name: sName,
          category: sCategory,
          phone: sPhone || null,
          email: sEmail || null,
          leadDays: sLead,
          rating: sRating,
          isActive: true,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setMessage(`Updated ${sName}`);
      } else {
        const result = await createSupplier({
          name: sName,
          category: sCategory,
          phone: sPhone || null,
          email: sEmail || null,
          leadDays: sLead,
          rating: sRating,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setMessage(`Added supplier ${sName}`);
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
      const result = await paySupplier({
        supplierId: paySupplierId,
        amount,
        method: payMethod,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(
        `Paid ${formatCurrency(result.paid)} to ${result.supplierName} · remaining ${formatCurrency(result.remaining)}`,
      );
      closePanel();
      router.refresh();
    });
  }

  function onCancelPo(id: string, number: string) {
    if (!window.confirm(`Cancel ${number}? This cannot be undone.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelPurchaseOrder(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(`Cancelled ${result.number}`);
      router.refresh();
    });
  }

  function onApprovePo(id: string, number: string) {
    setError(null);
    startTransition(async () => {
      try {
        await approvePurchaseOrder(id);
        setMessage(`Approved ${number} — ready to receive`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Approve failed");
      }
    });
  }

  return (
    <div>
      <PageHeader
        title="Purchasing & Suppliers"
        description={`${openCount} open POs · ${formatCurrency(payableTotal)} accounts payable.`}
        actions={
          <>
            <Link href="/receive">
              <Button variant="secondary" size="sm">
                <Truck className="h-4 w-4" /> Receive
              </Button>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => (panel === "supplier" ? closePanel() : openNewSupplier())}
            >
              {panel === "supplier" ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {panel === "supplier" ? "Close" : "Add supplier"}
            </Button>
            <Button
              size="sm"
              onClick={() => (panel === "po" ? closePanel() : (setPanel("po"), setError(null)))}
            >
              {panel === "po" ? <X className="h-4 w-4" /> : <FilePlus className="h-4 w-4" />}
              {panel === "po" ? "Close" : "New PO"}
            </Button>
          </>
        }
      />

      {message && <p className="mb-3 text-sm font-medium text-brand-deep">{message}</p>}
      {error && panel === "closed" && <p className="mb-3 text-sm text-danger">{error}</p>}

      {panel === "po" && (
        <Panel title="New purchase order" className="mb-4">
          <form onSubmit={submitPo} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Supplier</label>
              <Select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full"
                required
              >
                {formOptions.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              {formOptions.suppliers.length === 0 && (
                <p className="mt-1 text-xs text-warn">Add a supplier first.</p>
              )}
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
              {lines.map((line) => {
                const p = productById.get(line.productId);
                return (
                  <div key={line.key} className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[200px] flex-1">
                      <label className="mb-1 block text-[10px] text-ink-faint">Product</label>
                      <Select
                        value={line.productId}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((x) =>
                              x.key === line.key ? { ...x, productId: e.target.value } : x,
                            ),
                          )
                        }
                        className="w-full"
                      >
                        {formOptions.products.map((prod) => (
                          <option key={prod.id} value={prod.id}>
                            {prod.name} ({prod.sku}) · {formatCurrency(prod.costPrice)}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="w-28">
                      <label className="mb-1 block text-[10px] text-ink-faint">Qty</label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={line.qtyText}
                        onChange={(e) => {
                          const v = e.target.value.trim();
                          if (v !== "" && !/^\d+$/.test(v)) return;
                          setLines((prev) =>
                            prev.map((x) =>
                              x.key === line.key
                                ? { ...x, qtyText: v, qty: v === "" ? 0 : Number(v) }
                                : x,
                            ),
                          );
                        }}
                      />
                    </div>
                    <div className="w-28 pb-2 text-xs text-ink-muted">
                      {p ? formatCurrency(p.costPrice * line.qty) : "—"}
                    </div>
                    <button
                      type="button"
                      onClick={() => setLines((prev) => prev.filter((x) => x.key !== line.key))}
                      className="mb-1 rounded-lg p-2 text-ink-faint hover:bg-surface hover:text-danger"
                      aria-label="Remove line"
                      disabled={lines.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <p className="text-sm">
                Total <span className="font-semibold">{formatCurrency(draftTotal)}</span>
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={closePanel}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={pending || !supplierId || draftTotal <= 0}>
                  {pending ? "Creating…" : "Create PO"}
                </Button>
              </div>
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
          </form>
        </Panel>
      )}

      {panel === "supplier" && (
        <Panel
          title={editingSupplierId ? "Edit supplier" : "New supplier"}
          className="mb-4"
        >
          <form onSubmit={submitSupplier} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="mb-1 block text-xs text-ink-muted">Name</label>
              <Input value={sName} onChange={(e) => setSName(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Category</label>
              <Input value={sCategory} onChange={(e) => setSCategory(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Phone</label>
              <Input value={sPhone} onChange={(e) => setSPhone(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Email</label>
              <Input value={sEmail} onChange={(e) => setSEmail(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Lead days</label>
              <Input
                type="text"
                inputMode="numeric"
                value={sLeadText}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  if (v !== "" && !/^\d+$/.test(v)) return;
                  setSLeadText(v);
                  setSLead(v === "" ? 0 : Number(v));
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Rating (1–5)</label>
              <Input
                type="text"
                inputMode="decimal"
                value={String(sRating)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isNaN(n)) return;
                  setSRating(Math.min(5, Math.max(1, n)));
                }}
              />
            </div>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Saving…" : editingSupplierId ? "Update supplier" : "Save supplier"}
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
        <Panel title={`Pay ${payTarget.name}`} subtitle={`Owed ${formatCurrency(payTarget.balance)}`} className="mb-4">
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
                  Math.min(payTarget.balance, 10_000),
                  Math.min(payTarget.balance, 50_000),
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
              <label className="mb-1 block text-xs text-ink-muted">Pay from</label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: "CASH" as const, label: "Cash", icon: Banknote },
                    { id: "CARD" as const, label: "Bank", icon: CreditCard },
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
                {pending ? "Paying…" : "Record payment"}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={closePanel}>
                Cancel
              </Button>
              {error && <p className="text-sm text-danger">{error}</p>}
            </div>
          </form>
        </Panel>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[var(--radius)] border border-border bg-surface-raised p-4">
          <p className="text-xs uppercase tracking-wide text-ink-faint">Accounts payable</p>
          <p className="mt-1 font-display text-2xl font-semibold">{formatCurrency(payableTotal)}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-border bg-surface-raised p-4">
          <p className="text-xs uppercase tracking-wide text-ink-faint">Open POs</p>
          <p className="mt-1 font-display text-2xl font-semibold">{openCount}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-border bg-surface-raised p-4">
          <p className="text-xs uppercase tracking-wide text-ink-faint">Suppliers</p>
          <p className="mt-1 font-display text-2xl font-semibold">{suppliers.length}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-border bg-surface-raised p-4">
          <p className="text-xs uppercase tracking-wide text-ink-faint">POs listed</p>
          <p className="mt-1 font-display text-2xl font-semibold">{purchaseOrders.length}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Panel title="Purchase orders" className="xl:col-span-3" bodyClassName="p-0">
          {purchaseOrders.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-muted">No purchase orders yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-surface text-xs uppercase text-ink-faint">
                  <tr>
                    <th className="px-4 py-2 font-medium">PO #</th>
                    <th className="px-4 py-2 font-medium">Supplier</th>
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 text-right font-medium">Total</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium"> </th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseOrders.map((po) => (
                    <tr
                      key={po.id}
                      className={cn(
                        "border-t border-border",
                        initialPoId === po.id && "bg-brand-soft/40",
                      )}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs">{po.number}</td>
                      <td className="px-4 py-2.5">{po.supplier}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{po.date}</td>
                      <td className="px-4 py-2.5 text-right font-medium">
                        {formatCurrency(po.total)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={statusBadge(po.status)}>{po.status}</Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap items-center gap-1">
                          {po.rawStatus === "PENDING_APPROVAL" && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={pending}
                              onClick={() => onApprovePo(po.id, po.number)}
                            >
                              Approve
                            </Button>
                          )}
                          {["ORDERED", "PARTIAL"].includes(po.rawStatus) && (
                            <Link
                              href={`/receive?po=${po.id}`}
                              className="text-xs font-medium text-brand hover:underline"
                            >
                              Receive
                            </Link>
                          )}
                          {po.cancellable && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={pending}
                              onClick={() => onCancelPo(po.id, po.number)}
                              className="text-danger"
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Suppliers" className="xl:col-span-2" bodyClassName="p-0">
          <ul className="max-h-[32rem] divide-y divide-border overflow-y-auto">
            {suppliers.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-ink-muted">No suppliers yet.</li>
            )}
            {suppliers.map((s) => (
              <li key={s.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    <p className="text-[11px] text-ink-muted">
                      {s.category} · Lead {s.leadDays}d · {s.rating}★ · {s.orders} POs
                    </p>
                    {(s.phone || s.email) && (
                      <p className="truncate text-[11px] text-ink-faint">
                        {[s.phone, s.email].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <p
                    className={cn(
                      "shrink-0 text-sm font-semibold",
                      s.balance > 0 ? "text-accent" : "text-ink-muted",
                    )}
                  >
                    {formatCurrency(s.balance)}
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button type="button" variant="ghost" size="sm" onClick={() => openEditSupplier(s)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={s.balance <= 0}
                    onClick={() => openPay(s)}
                  >
                    Pay
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSupplierId(s.id);
                      setPanel("po");
                      setError(null);
                    }}
                  >
                    New PO
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
