"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Minus,
  Plus,
  Search,
  Trash2,
  CreditCard,
  Banknote,
  Smartphone,
  ArrowLeft,
  SplitSquareHorizontal,
  NotebookPen,
  Printer,
  X,
  Percent,
} from "lucide-react";
import { BarcodeScannerModal, ScanButton, type ScanOutcome } from "@/components/barcode-scanner";
import { createSale } from "@/lib/actions";
import type { CatalogProduct } from "@/lib/product-utils";
import { productMatchesQuery, variantLabel } from "@/lib/product-utils";
import { formatCurrency, cn } from "@/lib/utils";

type CartLine = {
  id: string;
  name: string;
  price: number;
  qty: number;
  stock: number;
  taxRate: number;
  taxExempt: boolean;
  unit: string;
};

type CustomerOption = {
  id: string;
  name: string;
  phone: string | null;
  balance: number;
  type: string;
};

type PayMethod = "CASH" | "CARD" | "MOMO" | "CREDIT";

type Receipt = {
  number: string;
  createdAt: string;
  customerName: string | null;
  lines: { name: string; qty: number; price: number; total: number }[];
  subtotal: number;
  discountPct: number;
  discountAmt: number;
  taxAmt: number;
  total: number;
  payments: { method: string; amount: number }[];
  cashTendered?: number;
  change?: number;
};

const DISCOUNT_PRESETS = [0, 5, 10, 15];

export function PosClient({
  businessName,
  initialProducts,
  initialProductId,
  customers,
}: {
  businessName: string;
  initialProducts: CatalogProduct[];
  initialProductId?: string;
  customers: CustomerOption[];
}) {
  const seedProduct = initialProductId
    ? initialProducts.find((p) => p.id === initialProductId)
    : undefined;
  const [products, setProducts] = useState(initialProducts);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartLine[]>(() => {
    if (!seedProduct || seedProduct.stock <= 0) return [];
    return [
      {
        id: seedProduct.id,
        name: seedProduct.name,
        price: seedProduct.sell,
        qty: 1,
        stock: seedProduct.stock,
        taxRate: seedProduct.taxRate ?? 0.18,
        taxExempt: seedProduct.taxExempt ?? false,
        unit: seedProduct.unit,
      },
    ];
  });
  const [customerId, setCustomerId] = useState("");
  const [discountPct, setDiscountPct] = useState(0);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [cashOpen, setCashOpen] = useState(false);
  const [cashTendered, setCashTendered] = useState(0);
  const [splitCash, setSplitCash] = useState(0);
  const [splitCard, setSplitCard] = useState(0);
  const [splitMomo, setSplitMomo] = useState(0);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [scanMsg, setScanMsg] = useState<{ text: string; tone: "success" | "warn" | "error" } | null>(
    null,
  );
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedCustomer = customers.find((c) => c.id === customerId) ?? null;
  const creditAllowed = Boolean(customerId);

  const catalog = useMemo(() => {
    const matched = products.filter((p) => productMatchesQuery(p, q));
    return matched.sort((a, b) => {
      if (a.stock <= 0 && b.stock > 0) return 1;
      if (a.stock > 0 && b.stock <= 0) return -1;
      return a.name.localeCompare(b.name);
    });
  }, [products, q]);

  const addToCart = useCallback((p: CatalogProduct) => {
    if (p.stock <= 0) {
      setScanMsg({ text: `${p.name} is out of stock`, tone: "warn" });
      window.setTimeout(() => setScanMsg(null), 4000);
      return;
    }
    setQ("");
    setCart((prev) => {
      const existing = prev.find((l) => l.id === p.id);
      if (existing) {
        if (existing.qty >= p.stock) return prev;
        return prev.map((l) => (l.id === p.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [
        ...prev,
        {
          id: p.id,
          name: p.name,
          price: p.sell,
          qty: 1,
          stock: p.stock,
          taxRate: p.taxRate ?? 0.18,
          taxExempt: p.taxExempt ?? false,
          unit: p.unit,
        },
      ];
    });
    searchRef.current?.focus();
  }, []);

  const handleScanResult = useCallback(
    (outcome: ScanOutcome) => {
      if (outcome.status === "found" && "product" in outcome) {
        const p = products.find((x) => x.id === outcome.product.id) ?? outcome.product;
        addToCart(p);
        setScanMsg({ text: `Added ${p.name}`, tone: "success" });
      } else if (outcome.status === "out_of_stock") {
        setScanMsg({ text: outcome.message, tone: "warn" });
      } else {
        setQ(outcome.rawCode);
        setScanMsg({ text: outcome.message, tone: "error" });
      }
      window.setTimeout(() => setScanMsg(null), 5000);
    },
    [addToCart, products],
  );

  function updateQty(id: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.id !== id) return l;
          const next = Math.max(0, Math.min(l.stock, l.qty + delta));
          return { ...l, qty: next };
        })
        .filter((l) => l.qty > 0),
    );
  }

  const subtotal = useMemo(() => cart.reduce((s, l) => s + l.price * l.qty, 0), [cart]);
  const discountAmt = Math.round(subtotal * (discountPct / 100));
  const total = subtotal - discountAmt;
  const taxAmt = useMemo(() => {
    if (subtotal <= 0) return 0;
    const rawTax = cart.reduce((s, l) => {
      if (l.taxExempt) return s;
      const line = l.price * l.qty;
      return s + Math.round(line - line / (1 + l.taxRate));
    }, 0);
    return discountAmt > 0 ? Math.round(rawTax * (total / subtotal)) : rawTax;
  }, [cart, discountAmt, subtotal, total]);

  const splitSum = splitCash + splitCard + splitMomo;
  const splitOk = splitSum === total && splitSum > 0;
  const cashChange = cashTendered - total;
  const cashOk = cashTendered >= total && total > 0;

  async function submitPayments(
    payments: { method: PayMethod; amount: number }[],
    extras?: { cashTendered?: number },
  ) {
    if (!cart.length || busy) return;
    setBusy(true);
    const cartSnapshot = [...cart];
    const result = await createSale({
      items: cart.map((l) => ({ productId: l.id, qty: l.qty })),
      payments,
      customerId: customerId || null,
      discountPct,
    });
    setBusy(false);

    if (!result.ok) {
      setScanMsg({ text: result.error, tone: "error" });
      return;
    }

    setSplitOpen(false);
    setCashOpen(false);
    setProducts((prev) =>
      prev.map((p) => {
        const line = cartSnapshot.find((c) => c.id === p.id);
        if (!line) return p;
        const stock = p.stock - line.qty;
        return {
          ...p,
          stock,
          status: stock <= 0 ? "Out of Stock" : stock <= p.minStock ? "Low Stock" : "Active",
        };
      }),
    );

    setReceipt({
      number: result.number,
      createdAt: result.createdAt,
      customerName: result.customerName,
      lines: cartSnapshot.map((l) => ({
        name: l.name,
        qty: l.qty,
        price: l.price,
        total: l.price * l.qty,
      })),
      subtotal: result.subtotal,
      discountPct,
      discountAmt: result.discountAmt,
      taxAmt: result.taxAmt,
      total: result.total,
      payments: result.payments,
      cashTendered: extras?.cashTendered,
      change:
        extras?.cashTendered != null ? Math.max(0, extras.cashTendered - result.total) : undefined,
    });
    setCart([]);
    setDiscountPct(0);
    setSplitCash(0);
    setSplitCard(0);
    setSplitMomo(0);
    setCashTendered(0);
  }

  function checkout(method: Exclude<PayMethod, "CREDIT"> | "CREDIT") {
    if (method === "CASH") {
      setCashTendered(total);
      setCashOpen(true);
      setSplitOpen(false);
      return;
    }
    if (method === "CREDIT") {
      if (!creditAllowed) {
        setScanMsg({ text: "Select a credit customer first", tone: "warn" });
        return;
      }
      void submitPayments([{ method: "CREDIT", amount: total }]);
      return;
    }
    void submitPayments([{ method, amount: total }]);
  }

  function openSplit() {
    setCashOpen(false);
    setSplitCash(Math.floor(total / 2));
    setSplitMomo(total - Math.floor(total / 2));
    setSplitCard(0);
    setSplitOpen(true);
  }

  function startNewSale() {
    setReceipt(null);
    searchRef.current?.focus();
  }

  function printReceipt() {
    window.print();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" && document.activeElement === searchRef.current) {
        const first = catalog.find((p) => p.stock > 0);
        if (first) {
          e.preventDefault();
          addToCart(first);
        }
      }
      if (e.key === "F2") {
        e.preventDefault();
        setScanning(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addToCart, catalog]);

  const cashSuggestions = useMemo(() => {
    if (total <= 0) return [];
    const roundUp = Math.ceil(total / 1000) * 1000;
    const amounts = [total, roundUp, roundUp + 1000, roundUp + 5000, 5000, 10000, 20000];
    return [...new Set(amounts.filter((a) => a >= total))].slice(0, 5);
  }, [total]);

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      <div className="mb-3 flex items-center justify-between gap-2 print:hidden">
        <Link href="/counter" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Counter
        </Link>
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-brand">
          Sell · {businessName}
        </p>
      </div>

      {scanMsg && (
        <div
          className={cn(
            "mb-2 rounded-xl px-3 py-2.5 text-sm font-semibold print:hidden",
            scanMsg.tone === "success" && "bg-success-soft text-success",
            scanMsg.tone === "warn" && "bg-warn-soft text-warn",
            scanMsg.tone === "error" && "bg-danger-soft text-danger",
          )}
        >
          {scanMsg.text}
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-3 print:hidden lg:grid-cols-5">
        <div className="flex min-h-0 flex-col rounded-2xl border border-border bg-surface-raised lg:col-span-3">
          <div className="border-b border-border p-3">
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-faint" />
                <input
                  ref={searchRef}
                  className="h-14 w-full rounded-xl border-2 border-border bg-surface pl-12 pr-4 text-lg outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
                  placeholder="Search or scan · Enter adds first match · F2 scan"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  autoFocus
                />
              </div>
              <ScanButton onClick={() => setScanning(true)} />
            </div>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto p-3 sm:grid-cols-3">
            {catalog.length === 0 && (
              <p className="col-span-full py-12 text-center text-sm text-ink-muted">
                No products match — try another search or scan a barcode.
              </p>
            )}
            {catalog.map((p) => {
              const out = p.stock <= 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addToCart(p)}
                  disabled={out}
                  className={cn(
                    "min-h-[96px] rounded-xl border p-3 text-left transition active:scale-[0.98]",
                    out
                      ? "cursor-not-allowed border-border bg-surface opacity-50"
                      : "border-border bg-surface hover:border-brand hover:bg-brand-soft/40",
                  )}
                >
                  <p className="line-clamp-2 text-sm font-semibold text-ink">{p.name}</p>
                  {variantLabel(p) && (
                    <p className="mt-0.5 text-[11px] text-ink-muted">{variantLabel(p)}</p>
                  )}
                  <p className="mt-2 font-display text-xl font-semibold text-brand">
                    {formatCurrency(p.sell)}
                  </p>
                  <p
                    className={cn(
                      "text-[11px]",
                      out ? "text-danger" : p.stock <= p.minStock ? "text-warn" : "text-ink-faint",
                    )}
                  >
                    {out ? "Out of stock" : `${p.stock} ${p.unit}`}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex min-h-0 flex-col rounded-2xl border border-border bg-ink text-white lg:col-span-2">
          <div className="space-y-2 border-b border-white/10 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <select
                className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="" className="text-ink">
                  Walk-in customer
                </option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id} className="text-ink">
                    {c.name}
                    {c.balance > 0 ? ` · owed ${formatCurrency(c.balance)}` : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="shrink-0 text-xs text-white/50 hover:text-white"
                onClick={() => {
                  setCart([]);
                  setDiscountPct(0);
                }}
              >
                Clear
              </button>
            </div>
            {selectedCustomer && (
              <p className="text-[11px] text-white/45">
                {selectedCustomer.type}
                {selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ""}
                {selectedCustomer.balance > 0
                  ? ` · balance ${formatCurrency(selectedCustomer.balance)}`
                  : " · no open balance"}
              </p>
            )}
          </div>

          <ul className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {cart.length === 0 && (
              <li className="py-10 text-center text-sm text-white/40">
                Scan or tap products → apply discount → pay
              </li>
            )}
            {cart.map((l) => (
              <li key={l.id} className="flex items-center gap-2 rounded-xl bg-white/5 px-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.name}</p>
                  <p className="text-xs text-white/50">
                    {formatCurrency(l.price)} · {formatCurrency(l.price * l.qty)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="rounded-lg bg-white/10 p-2"
                    onClick={() => updateQty(l.id, -1)}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-7 text-center text-base font-semibold">{l.qty}</span>
                  <button
                    type="button"
                    className="rounded-lg bg-white/10 p-2"
                    onClick={() => updateQty(l.id, 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <button
                  type="button"
                  className="p-2 text-white/40 hover:text-red-300"
                  onClick={() => updateQty(l.id, -l.qty)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>

          <div className="space-y-3 border-t border-white/10 px-4 py-4">
            <div className="flex items-center gap-2">
              <Percent className="h-3.5 w-3.5 text-white/40" />
              <div className="flex flex-wrap gap-1.5">
                {DISCOUNT_PRESETS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDiscountPct(d)}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-semibold",
                      discountPct === d ? "bg-brand text-white" : "bg-white/10 text-white/70 hover:bg-white/15",
                    )}
                  >
                    {d}%
                  </button>
                ))}
                <label className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-xs">
                  <span className="text-white/50">Custom</span>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={discountPct}
                    onChange={(e) =>
                      setDiscountPct(Math.min(50, Math.max(0, Number(e.target.value) || 0)))
                    }
                    className="w-10 bg-transparent text-right outline-none"
                  />
                  <span className="text-white/50">%</span>
                </label>
              </div>
            </div>

            <div className="space-y-1 text-sm text-white/60">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {discountAmt > 0 && (
                <div className="flex justify-between text-accent">
                  <span>Discount ({discountPct}%)</span>
                  <span>-{formatCurrency(discountAmt)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>VAT incl.</span>
                <span>{formatCurrency(taxAmt)}</span>
              </div>
            </div>
            <div className="flex justify-between font-display text-3xl font-semibold">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>

            {!splitOpen && !cashOpen ? (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { icon: Banknote, label: "Cash", method: "CASH" as const },
                    { icon: CreditCard, label: "Card", method: "CARD" as const },
                    { icon: Smartphone, label: "MoMo", method: "MOMO" as const },
                    { icon: NotebookPen, label: "Credit", method: "CREDIT" as const },
                  ].map(({ icon: Icon, label, method }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => checkout(method)}
                      disabled={!cart.length || busy || (method === "CREDIT" && !creditAllowed)}
                      title={
                        method === "CREDIT" && !creditAllowed
                          ? "Select a named customer for credit"
                          : undefined
                      }
                      className="flex h-14 flex-col items-center justify-center gap-1 rounded-xl bg-brand text-sm font-bold transition hover:bg-brand-deep active:scale-[0.98] disabled:opacity-40"
                    >
                      <Icon className="h-5 w-5" />
                      {busy ? "…" : label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={openSplit}
                  disabled={!cart.length || busy}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/20 text-sm font-semibold text-white/90 hover:bg-white/10 disabled:opacity-40"
                >
                  <SplitSquareHorizontal className="h-4 w-4" /> Split pay (cash / card / MoMo)
                </button>
              </>
            ) : cashOpen ? (
              <div className="space-y-2 rounded-xl bg-white/5 p-3">
                <p className="text-xs text-white/60">Cash tendered — change shown below</p>
                <div className="flex flex-wrap gap-1.5">
                  {cashSuggestions.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setCashTendered(a)}
                      className={cn(
                        "rounded-lg px-2.5 py-1.5 text-xs font-semibold",
                        cashTendered === a ? "bg-brand" : "bg-white/10 hover:bg-white/15",
                      )}
                    >
                      {formatCurrency(a)}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={0}
                  value={cashTendered || ""}
                  onChange={(e) => setCashTendered(Number(e.target.value) || 0)}
                  className="h-12 w-full rounded-lg border border-white/15 bg-white/5 px-3 text-right text-lg font-semibold outline-none"
                  placeholder="Amount received"
                />
                <p
                  className={cn(
                    "text-center text-sm font-semibold",
                    cashOk ? "text-success-soft" : "text-warn-soft",
                  )}
                >
                  {cashOk
                    ? `Change ${formatCurrency(cashChange)}`
                    : `Need ${formatCurrency(Math.max(0, total - cashTendered))} more`}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCashOpen(false)}
                    className="h-11 rounded-xl border border-white/20 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!cashOk || busy}
                    onClick={() =>
                      void submitPayments([{ method: "CASH", amount: total }], {
                        cashTendered,
                      })
                    }
                    className="h-11 rounded-xl bg-brand text-sm font-bold disabled:opacity-40"
                  >
                    {busy ? "…" : "Confirm cash"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 rounded-xl bg-white/5 p-3">
                <p className="text-xs text-white/60">
                  Enter amounts — must equal {formatCurrency(total)}
                </p>
                {(
                  [
                    ["Cash", splitCash, setSplitCash],
                    ["Card", splitCard, setSplitCard],
                    ["MoMo", splitMomo, setSplitMomo],
                  ] as const
                ).map(([label, value, setValue]) => (
                  <label key={label} className="flex items-center justify-between gap-2 text-sm">
                    <span className="w-14 text-white/70">{label}</span>
                    <input
                      type="number"
                      min={0}
                      value={value || ""}
                      onChange={(e) => setValue(Number(e.target.value) || 0)}
                      className="h-10 flex-1 rounded-lg border border-white/15 bg-white/5 px-3 text-right outline-none"
                    />
                  </label>
                ))}
                <p
                  className={cn(
                    "text-center text-xs font-medium",
                    splitOk ? "text-success-soft" : "text-warn-soft",
                  )}
                >
                  Sum {formatCurrency(splitSum)} {splitOk ? "✓" : `· need ${formatCurrency(total)}`}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSplitOpen(false)}
                    className="h-11 rounded-xl border border-white/20 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!splitOk || busy}
                    onClick={() => {
                      const parts: { method: PayMethod; amount: number }[] = [];
                      if (splitCash > 0) parts.push({ method: "CASH", amount: splitCash });
                      if (splitCard > 0) parts.push({ method: "CARD", amount: splitCard });
                      if (splitMomo > 0) parts.push({ method: "MOMO", amount: splitMomo });
                      void submitPayments(parts);
                    }}
                    className="h-11 rounded-xl bg-brand text-sm font-bold disabled:opacity-40"
                  >
                    {busy ? "…" : "Confirm split"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 print:static print:bg-white print:p-0">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-surface-raised shadow-[var(--shadow-lg)] print:max-h-none print:max-w-none print:rounded-none print:border-0 print:shadow-none">
            <div className="flex items-center justify-between border-b border-border px-4 py-3 print:hidden">
              <p className="text-sm font-semibold text-ink">Sale complete</p>
              <button type="button" onClick={startNewSale} className="rounded-lg p-1.5 hover:bg-surface">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div id="pos-receipt" className="px-5 py-5 font-mono text-sm text-ink">
              <p className="text-center font-display text-lg font-semibold tracking-tight">
                {businessName}
              </p>
              <p className="mt-1 text-center text-xs text-ink-muted">Sales receipt</p>
              <div className="mt-4 space-y-1 border-y border-dashed border-border py-3 text-xs">
                <div className="flex justify-between">
                  <span>Ticket</span>
                  <span className="font-semibold">{receipt.number}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date</span>
                  <span>
                    {new Date(receipt.createdAt).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Customer</span>
                  <span>{receipt.customerName ?? "Walk-in"}</span>
                </div>
              </div>

              <ul className="mt-3 space-y-2">
                {receipt.lines.map((l, i) => (
                  <li key={`${l.name}-${i}`} className="flex justify-between gap-3 text-xs">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{l.name}</span>
                      <span className="text-ink-muted">
                        {l.qty} × {formatCurrency(l.price)}
                      </span>
                    </span>
                    <span className="shrink-0 font-medium">{formatCurrency(l.total)}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 space-y-1 border-t border-dashed border-border pt-3 text-xs">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(receipt.subtotal)}</span>
                </div>
                {receipt.discountAmt > 0 && (
                  <div className="flex justify-between">
                    <span>Discount ({receipt.discountPct}%)</span>
                    <span>-{formatCurrency(receipt.discountAmt)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>VAT incl.</span>
                  <span>{formatCurrency(receipt.taxAmt)}</span>
                </div>
                <div className="flex justify-between text-base font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(receipt.total)}</span>
                </div>
              </div>

              <div className="mt-3 space-y-1 border-t border-dashed border-border pt-3 text-xs">
                {receipt.payments.map((p, i) => (
                  <div key={`${p.method}-${i}`} className="flex justify-between capitalize">
                    <span>{p.method.toLowerCase()}</span>
                    <span>{formatCurrency(p.amount)}</span>
                  </div>
                ))}
                {receipt.cashTendered != null && (
                  <>
                    <div className="flex justify-between">
                      <span>Tendered</span>
                      <span>{formatCurrency(receipt.cashTendered)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Change</span>
                      <span>{formatCurrency(receipt.change ?? 0)}</span>
                    </div>
                  </>
                )}
              </div>

              <p className="mt-5 text-center text-[11px] text-ink-faint">Thank you for your purchase</p>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-border p-4 print:hidden">
              <button
                type="button"
                onClick={printReceipt}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold hover:bg-surface"
              >
                <Printer className="h-4 w-4" /> Print
              </button>
              <button
                type="button"
                onClick={startNewSale}
                className="h-11 rounded-xl bg-brand text-sm font-bold text-white hover:bg-brand-deep"
              >
                New sale
              </button>
            </div>
          </div>
        </div>
      )}

      <BarcodeScannerModal
        open={scanning}
        onClose={() => setScanning(false)}
        onResult={handleScanResult}
        mode="sell"
        title="Scan product to sell"
      />
    </div>
  );
}
