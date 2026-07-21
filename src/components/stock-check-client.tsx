"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { CatalogProduct } from "@/lib/product-utils";
import { productMatchesQuery, variantLabel } from "@/lib/product-utils";
import { formatCurrency, cn } from "@/lib/utils";
import {
  ArrowLeft,
  PackageSearch,
  RefreshCw,
  Search,
  ShoppingCart,
  ShoppingBag,
} from "lucide-react";
import { Badge, statusBadge } from "@/components/ui/badge";
import { BarcodeScannerModal, ScanButton, type ScanOutcome } from "@/components/barcode-scanner";

type StockFilter = "all" | "in" | "low" | "out";

function stockAnswer(p: CatalogProduct) {
  if (p.stock <= 0) return { label: "No", tone: "danger" as const, hint: "Out of stock" };
  if (p.stock <= p.minStock)
    return { label: "Low", tone: "warn" as const, hint: `${p.stock} ${p.unit} left · min ${p.minStock}` };
  return { label: "Yes", tone: "success" as const, hint: `${p.stock} ${p.unit} on hand` };
}

export function StockCheckClient({ initialProducts }: { initialProducts: CatalogProduct[] }) {
  const [products] = useState(initialProducts);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<StockFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<{ text: string; tone: "success" | "warn" | "error" } | null>(
    null,
  );
  const searchRef = useRef<HTMLInputElement>(null);

  const lowStock = useMemo(
    () => products.filter((p) => p.stock > 0 && p.stock <= p.minStock),
    [products],
  );
  const outStock = useMemo(() => products.filter((p) => p.stock <= 0), [products]);
  const inStock = useMemo(() => products.filter((p) => p.stock > p.minStock), [products]);

  const hits = useMemo(() => {
    const query = q.trim();
    let list = query
      ? products.filter((p) => productMatchesQuery(p, query))
      : filter === "low"
        ? lowStock
        : filter === "out"
          ? outStock
          : filter === "in"
            ? inStock.slice(0, 12)
            : [...lowStock, ...outStock].slice(0, 10);

    if (!query && filter === "all" && list.length === 0) {
      list = products.slice(0, 8);
    }

    return list.sort((a, b) => {
      if (selectedId && a.id === selectedId) return -1;
      if (selectedId && b.id === selectedId) return 1;
      if (a.stock <= 0 && b.stock > 0) return 1;
      if (a.stock > 0 && b.stock <= 0) return -1;
      return a.name.localeCompare(b.name);
    });
  }, [q, products, filter, lowStock, outStock, inStock, selectedId]);

  const primary = selectedId
    ? products.find((p) => p.id === selectedId) ?? hits[0]
    : hits.length === 1
      ? hits[0]
      : null;

  const handleScanResult = useCallback(
    (outcome: ScanOutcome) => {
      setQ(outcome.rawCode);
      if (outcome.status === "found" || outcome.status === "out_of_stock") {
        setSelectedId(outcome.product.id);
        setFilter("all");
      }
      const tone =
        outcome.status === "found"
          ? "success"
          : outcome.status === "out_of_stock"
            ? "warn"
            : "error";
      setScanMsg({ text: outcome.message, tone });
      window.setTimeout(() => setScanMsg(null), 5000);
    },
    [],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        setScanning(true);
      }
      if (e.key === "Escape") {
        setQ("");
        setSelectedId(null);
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const emptyHint = q.trim()
    ? "No match — try size, color, brand, SKU, or scan"
    : filter === "low"
      ? "No low-stock items"
      : filter === "out"
        ? "Nothing out of stock"
        : "Search or scan a product";

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/counter" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Counter
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Stock check</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Answer “Do you have it?” in seconds — search or scan (F2).
          </p>
        </div>
        <PackageSearch className="hidden h-8 w-8 text-ink-faint sm:block" />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-lg border border-border bg-surface-raised px-2.5 py-1 text-ink-muted">
          {products.length} SKUs
        </span>
        <button
          type="button"
          onClick={() => {
            setFilter("low");
            setQ("");
            setSelectedId(null);
          }}
          className={cn(
            "rounded-lg border px-2.5 py-1 font-medium",
            filter === "low" ? "border-warn bg-warn-soft text-warn" : "border-border text-ink-muted",
          )}
        >
          {lowStock.length} low
        </button>
        <button
          type="button"
          onClick={() => {
            setFilter("out");
            setQ("");
            setSelectedId(null);
          }}
          className={cn(
            "rounded-lg border px-2.5 py-1 font-medium",
            filter === "out" ? "border-danger bg-danger-soft text-danger" : "border-border text-ink-muted",
          )}
        >
          {outStock.length} out
        </button>
      </div>

      {scanMsg && (
        <div
          className={cn(
            "mt-3 rounded-xl px-3 py-2.5 text-sm font-semibold",
            scanMsg.tone === "success" && "bg-success-soft text-success",
            scanMsg.tone === "warn" && "bg-warn-soft text-warn",
            scanMsg.tone === "error" && "bg-danger-soft text-danger",
          )}
        >
          {scanMsg.text}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-faint" />
          <input
            ref={searchRef}
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSelectedId(null);
              setFilter("all");
            }}
            placeholder="black 42 · polo m · SKU · barcode…"
            className="h-14 w-full rounded-2xl border-2 border-border bg-surface-raised pl-12 pr-4 text-lg outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
          />
        </div>
        <ScanButton onClick={() => setScanning(true)} className="rounded-2xl" />
      </div>

      {!q && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(
            [
              { id: "all", label: "Needs attention" },
              { id: "in", label: "In stock" },
              { id: "low", label: "Low" },
              { id: "out", label: "Out" },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setFilter(f.id);
                setSelectedId(null);
              }}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium",
                filter === f.id ? "bg-brand text-white" : "border border-border text-ink-muted hover:bg-surface",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {primary && (
        <div
          className={cn(
            "mt-4 rounded-2xl border-2 p-5",
            stockAnswer(primary).tone === "success" && "border-brand/40 bg-brand-soft/40",
            stockAnswer(primary).tone === "warn" && "border-warn/40 bg-warn-soft/40",
            stockAnswer(primary).tone === "danger" && "border-danger/40 bg-danger-soft/40",
          )}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Answer</p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-display text-xl font-semibold">{primary.name}</p>
              <p className="text-sm text-ink-muted">{variantLabel(primary) || primary.category}</p>
              <p className="mt-1 font-mono text-xs text-ink-faint">
                {primary.sku}
                {primary.barcode ? ` · ${primary.barcode}` : ""}
              </p>
            </div>
            <div className="text-right">
              <p
                className={cn(
                  "font-display text-4xl font-bold",
                  stockAnswer(primary).tone === "success" && "text-brand",
                  stockAnswer(primary).tone === "warn" && "text-warn",
                  stockAnswer(primary).tone === "danger" && "text-danger",
                )}
              >
                {stockAnswer(primary).label}
              </p>
              <p className="text-sm font-medium text-ink">{stockAnswer(primary).hint}</p>
              <p className="text-xs text-ink-faint">{formatCurrency(primary.sell)}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {primary.stock > 0 && (
              <Link
                href={`/pos?product=${primary.id}`}
                className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl bg-brand text-sm font-bold text-white hover:bg-brand-deep"
              >
                <ShoppingBag className="h-4 w-4" /> Sell
              </Link>
            )}
            <Link
              href={`/inventory?product=${primary.id}`}
              className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl border border-border bg-surface-raised text-sm font-semibold hover:bg-surface"
            >
              <RefreshCw className="h-4 w-4" /> Adjust
            </Link>
            {(primary.stock <= primary.minStock || primary.stock <= 0) && (
              <Link
                href="/procurement"
                className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl border border-border bg-surface-raised text-sm font-semibold hover:bg-surface sm:col-span-1"
              >
                <ShoppingCart className="h-4 w-4" /> Reorder
              </Link>
            )}
          </div>
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {hits.map((p) => {
          const ans = stockAnswer(p);
          const active = primary?.id === p.id;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-2xl border bg-surface-raised px-4 py-4 text-left transition",
                  active ? "border-brand ring-2 ring-brand/20" : "border-border hover:border-brand/40",
                  p.stock === 0 && !active && "opacity-70",
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-ink">{p.name}</p>
                  <p className="text-xs text-ink-muted">{variantLabel(p) || p.category}</p>
                  <p className="text-xs text-ink-faint">
                    {p.sku} · {formatCurrency(p.sell)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={cn(
                      "font-display text-2xl font-semibold tabular-nums",
                      ans.tone === "success" && "text-brand",
                      ans.tone === "warn" && "text-warn",
                      ans.tone === "danger" && "text-danger",
                    )}
                  >
                    {p.stock}
                  </p>
                  <p className="text-[11px] text-ink-faint">{p.unit}</p>
                  <Badge variant={statusBadge(p.status)} className="mt-1">
                    {ans.label}
                  </Badge>
                </div>
              </button>
            </li>
          );
        })}
        {hits.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-ink-muted">
            {emptyHint}
          </li>
        )}
      </ul>

      <BarcodeScannerModal
        open={scanning}
        onClose={() => setScanning(false)}
        onResult={handleScanResult}
        mode="stock"
        title="Scan to check stock"
      />
    </div>
  );
}
