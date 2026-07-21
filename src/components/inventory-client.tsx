"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adjustStock, getInventoryExportRows } from "@/lib/actions";
import { PageHeader, Panel, Button, Select, Input } from "@/components/ui/primitives";
import { Badge, statusBadge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/kpi-card";
import { formatCurrency, cn } from "@/lib/utils";
import { downloadCsv, toCsv } from "@/lib/csv";
import type { CatalogProduct } from "@/lib/product-utils";
import { productMatchesQuery, variantLabel } from "@/lib/product-utils";
import { BarcodeScannerModal, ScanButton, type ScanOutcome } from "@/components/barcode-scanner";
import {
  AlertTriangle,
  Boxes,
  Download,
  RefreshCw,
  Search,
  ShoppingCart,
  X,
} from "lucide-react";

type MovementRow = {
  id: string;
  createdAt: Date | string;
  type: string;
  qty: number;
  note: string | null;
  product: { id: string; name: string; sku: string; unit: string };
  user: { name: string } | null;
};

type Reason = "COUNT" | "DAMAGE" | "FOUND" | "SHRINKAGE" | "RETURN" | "OTHER";

const REASONS: { id: Reason; label: string }[] = [
  { id: "COUNT", label: "Stock count" },
  { id: "DAMAGE", label: "Damage" },
  { id: "FOUND", label: "Found / surplus" },
  { id: "SHRINKAGE", label: "Shrinkage" },
  { id: "RETURN", label: "Customer return" },
  { id: "OTHER", label: "Other" },
];

export function InventoryClient({
  products,
  movements,
  initialProductId,
}: {
  products: CatalogProduct[];
  movements: MovementRow[];
  initialProductId?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out" | "ok">("all");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"delta" | "count">("delta");
  const [productId, setProductId] = useState(initialProductId ?? products[0]?.id ?? "");
  const [qtyDelta, setQtyDelta] = useState(1);
  const [qtyDeltaText, setQtyDeltaText] = useState("1");
  const [countedQty, setCountedQty] = useState(0);
  const [countedQtyText, setCountedQtyText] = useState("0");
  const [reason, setReason] = useState<Reason>("COUNT");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [pending, startTransition] = useTransition();

  const activeProducts = useMemo(
    () => products.filter((p) => p.status !== "Inactive"),
    [products],
  );

  const selected = activeProducts.find((p) => p.id === productId) ?? null;

  useEffect(() => {
    if (!initialProductId) return;
    const p = activeProducts.find((x) => x.id === initialProductId);
    if (!p) return;
    setProductId(p.id);
    setCountedQty(p.stock);
    setCountedQtyText(String(p.stock));
    setMode("count");
    setReason("COUNT");
    setOpen(true);
    setQ(p.name);
  }, [initialProductId, activeProducts]);

  const inventoryValue = activeProducts.reduce((s, p) => s + p.stock * p.cost, 0);
  const lowStock = activeProducts.filter((p) => p.stock > 0 && p.stock <= p.minStock);
  const outStock = activeProducts.filter((p) => p.stock <= 0);
  const okStock = activeProducts.filter((p) => p.stock > p.minStock);

  const filtered = useMemo(() => {
    return activeProducts.filter((p) => {
      if (q && !productMatchesQuery(p, q)) return false;
      if (filter === "low") return p.stock > 0 && p.stock <= p.minStock;
      if (filter === "out") return p.stock <= 0;
      if (filter === "ok") return p.stock > p.minStock;
      return true;
    });
  }, [activeProducts, filter, q]);

  function openAdjust(id?: string) {
    const pid = id ?? productId ?? activeProducts[0]?.id ?? "";
    const p = activeProducts.find((x) => x.id === pid);
    setProductId(pid);
    setCountedQty(p?.stock ?? 0);
    setCountedQtyText(String(p?.stock ?? 0));
    setQtyDelta(1);
    setQtyDeltaText("1");
    setReason("COUNT");
    setMode("delta");
    setNote("");
    setError(null);
    setOpen(true);
  }

  const handleScan = useCallback(
    (outcome: ScanOutcome) => {
      if (outcome.status === "found" || outcome.status === "out_of_stock") {
        const p = products.find((x) => x.id === outcome.product.id) ?? outcome.product;
        setProductId(p.id);
        setCountedQty(p.stock);
        setCountedQtyText(String(p.stock));
        setOpen(true);
        setMode("count");
        setReason("COUNT");
        setMessage(`Scanned ${p.name} · ${p.stock} ${p.unit} on hand`);
        setError(null);
      } else {
        setError(outcome.message);
      }
    },
    [products],
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await adjustStock(
        mode === "count"
          ? { productId, countedQty, reason, note: note || undefined }
          : { productId, qtyDelta, reason, note: note || undefined },
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(
        `${result.productName}: ${result.qtyDelta > 0 ? "+" : ""}${result.qtyDelta} → ${result.stockQty} on hand`,
      );
      setOpen(false);
      setNote("");
      router.refresh();
    });
  }

  function exportInventory() {
    startTransition(async () => {
      const rows = await getInventoryExportRows();
      const csv = toCsv(
        ["SKU", "Name", "Category", "Stock", "Min", "Unit", "Cost", "Sell", "Value", "Status"],
        rows.map((r) => [
          r.sku,
          r.name,
          r.category,
          r.stock,
          r.min,
          r.unit,
          r.cost,
          r.sell,
          r.value,
          r.status,
        ]),
      );
      downloadCsv("rbiap-inventory.csv", csv);
    });
  }

  function formatWhen(createdAt: Date | string) {
    const d = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const previewDelta =
    mode === "count" && selected ? countedQty - selected.stock : qtyDelta;

  return (
    <div>
      <PageHeader
        title="Inventory Management"
        description="Levels, counts, adjustments, and movement history — scan a barcode to start a count."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={exportInventory} disabled={pending}>
              <Download className="h-4 w-4" /> Export
            </Button>
            <ScanButton onClick={() => setScanning(true)} className="h-8 rounded-lg px-3 text-xs" />
            <Button size="sm" onClick={() => (open ? setOpen(false) : openAdjust())}>
              {open ? <X className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
              {open ? "Close" : "Adjust stock"}
            </Button>
          </>
        }
      />

      {message && <p className="mb-3 text-sm font-medium text-brand-deep">{message}</p>}
      {error && !open && <p className="mb-3 text-sm text-danger">{error}</p>}

      {open && (
        <Panel
          title="Stock adjustment"
          subtitle={
            selected
              ? `${selected.name} · on hand ${selected.stock} ${selected.unit}`
              : "Pick a product"
          }
          className="mb-4"
        >
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="mb-1 block text-xs text-ink-muted">Product</label>
              <Select
                value={productId}
                onChange={(e) => {
                  const id = e.target.value;
                  setProductId(id);
                  const p = activeProducts.find((x) => x.id === id);
                  setCountedQty(p?.stock ?? 0);
                  setCountedQtyText(String(p?.stock ?? 0));
                }}
                className="w-full"
                required
              >
                {activeProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.stock} {p.unit}
                    {p.stock <= p.minStock ? " · LOW" : ""}
                  </option>
                ))}
              </Select>
            </div>

            <div className="sm:col-span-2 lg:col-span-2">
              <label className="mb-1 block text-xs text-ink-muted">Mode</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode("delta")}
                  className={cn(
                    "h-10 flex-1 rounded-lg text-sm font-medium",
                    mode === "delta" ? "bg-brand text-white" : "border border-border bg-surface",
                  )}
                >
                  Change +/−
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("count");
                    setReason("COUNT");
                    setCountedQty(selected?.stock ?? 0);
                    setCountedQtyText(String(selected?.stock ?? 0));
                  }}
                  className={cn(
                    "h-10 flex-1 rounded-lg text-sm font-medium",
                    mode === "count" ? "bg-brand text-white" : "border border-border bg-surface",
                  )}
                >
                  Set counted qty
                </button>
              </div>
            </div>

            {mode === "delta" ? (
              <div className="sm:col-span-2 lg:col-span-2">
                <label className="mb-1 block text-xs text-ink-muted">
                  Qty change (type any number, e.g. <span className="font-medium text-ink">-3</span> or{" "}
                  <span className="font-medium text-ink">25</span>)
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={qtyDeltaText}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    if (v !== "" && v !== "-" && !/^-?\d+$/.test(v)) return;
                    setQtyDeltaText(v);
                    if (v === "" || v === "-") {
                      setQtyDelta(0);
                      return;
                    }
                    setQtyDelta(Number(v));
                  }}
                  placeholder="-5 or 12"
                  required
                  className="h-12 text-lg font-semibold"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="self-center text-[11px] text-ink-faint">Shortcuts:</span>
                  {[-10, -1, 1, 5, 10].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setQtyDelta(n);
                        setQtyDeltaText(String(n));
                      }}
                      className={cn(
                        "h-8 rounded-lg px-2.5 text-xs font-semibold",
                        qtyDelta === n ? "bg-brand text-white" : "border border-border hover:bg-surface",
                      )}
                    >
                      {n > 0 ? `+${n}` : n}
                    </button>
                  ))}
                </div>
                {selected && qtyDelta !== 0 && (
                  <p className="mt-1 text-[11px] text-ink-faint">
                    {selected.stock} →{" "}
                    <span className="font-medium text-ink">
                      {selected.stock + qtyDelta} {selected.unit}
                    </span>
                  </p>
                )}
              </div>
            ) : (
              <div className="sm:col-span-2 lg:col-span-2">
                <label className="mb-1 block text-xs text-ink-muted">
                  Counted on hand (type the full quantity you see)
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={countedQtyText}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    if (v !== "" && !/^\d+$/.test(v)) return;
                    setCountedQtyText(v);
                    setCountedQty(v === "" ? 0 : Number(v));
                  }}
                  placeholder="e.g. 48"
                  required
                  className="h-12 text-lg font-semibold"
                />
                <p className="mt-1 text-[11px] text-ink-faint">
                  Current {selected?.stock ?? 0} → delta{" "}
                  <span className={previewDelta < 0 ? "text-danger" : "text-success"}>
                    {previewDelta > 0 ? `+${previewDelta}` : previewDelta}
                  </span>
                </p>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs text-ink-muted">Reason</label>
              <Select
                value={reason}
                onChange={(e) => setReason(e.target.value as Reason)}
                className="w-full"
              >
                {REASONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="sm:col-span-2 lg:col-span-2">
              <label className="mb-1 block text-xs text-ink-muted">Note (optional)</label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Shelf A, damaged bag, count sheet #…"
              />
            </div>

            <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4">
              <Button type="submit" size="sm" disabled={pending || !productId || previewDelta === 0}>
                {pending ? "Saving…" : "Apply adjustment"}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              {error && <p className="text-sm text-danger">{error}</p>}
            </div>
          </form>
        </Panel>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Inventory value" value={inventoryValue} icon={Boxes} currency />
        <button type="button" onClick={() => setFilter("low")} className="text-left">
          <KpiCard label="Low stock SKUs" value={lowStock.length} icon={AlertTriangle} tone="warn" />
        </button>
        <button type="button" onClick={() => setFilter("out")} className="text-left">
          <KpiCard
            label="Out of stock"
            value={outStock.length}
            icon={AlertTriangle}
            tone="accent"
          />
        </button>
        <KpiCard label="Healthy SKUs" value={okStock.length} icon={Boxes} tone="info" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Panel title="Stock levels" className="xl:col-span-3" bodyClassName="p-0">
          <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <Input
                className="pl-9"
                placeholder="Search name, SKU, barcode…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="sm:w-40"
            >
              <option value="all">All ({activeProducts.length})</option>
              <option value="low">Low ({lowStock.length})</option>
              <option value="out">Out ({outStock.length})</option>
              <option value="ok">Healthy ({okStock.length})</option>
            </Select>
          </div>
          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="sticky top-0 bg-surface text-xs uppercase text-ink-faint">
                <tr>
                  <th className="px-4 py-2 font-medium">Product</th>
                  <th className="px-4 py-2 text-right font-medium">On hand</th>
                  <th className="px-4 py-2 text-right font-medium">Value</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-ink-muted">
                      No SKUs match.
                    </td>
                  </tr>
                )}
                {filtered.map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-surface/80">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{p.name}</p>
                      {variantLabel(p) && (
                        <p className="text-[11px] text-ink-muted">{variantLabel(p)}</p>
                      )}
                      <p className="font-mono text-[11px] text-ink-faint">
                        {p.sku} · min {p.minStock}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">
                      {p.stock} {p.unit}
                    </td>
                    <td className="px-4 py-2.5 text-right text-ink-muted">
                      {formatCurrency(p.stock * p.cost)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={statusBadge(p.status)}>{p.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <Button type="button" variant="ghost" size="sm" onClick={() => openAdjust(p.id)}>
                        Adjust
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Stock alerts" className="xl:col-span-2" bodyClassName="p-0">
          <div className="border-b border-border px-4 py-3">
            <Link
              href="/procurement"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
            >
              <ShoppingCart className="h-4 w-4" /> Generate reorder POs
            </Link>
          </div>
          <ul className="max-h-[28rem] space-y-0 overflow-y-auto">
            {[...outStock, ...lowStock].length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-ink-muted">All SKUs above minimum</li>
            )}
            {[...outStock, ...lowStock].map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5 text-sm last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="text-[11px] text-ink-faint">
                    {p.stock} / min {p.minStock} {p.unit}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge variant={statusBadge(p.status)}>
                    {p.stock <= 0 ? "Out" : "Low"}
                  </Badge>
                  <Button type="button" variant="ghost" size="sm" onClick={() => openAdjust(p.id)}>
                    Fix
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Movement history" subtitle="Last 80 events" className="mt-4" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-surface text-xs uppercase text-ink-faint">
              <tr>
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Product</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 text-right font-medium">Qty</th>
                <th className="px-4 py-2 font-medium">Note</th>
                <th className="px-4 py-2 font-medium">By</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-ink-muted">
                    No movements yet — sell, receive, or adjust stock
                  </td>
                </tr>
              )}
              {movements.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="whitespace-nowrap px-4 py-2.5 text-ink-faint">
                    {formatWhen(m.createdAt)}
                  </td>
                  <td className="px-4 py-2.5">
                    <p>{m.product.name}</p>
                    <p className="font-mono text-[11px] text-ink-faint">{m.product.sku}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={statusBadge(m.type)}>{m.type}</Badge>
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2.5 text-right font-medium",
                      m.qty < 0 ? "text-danger" : "text-success",
                    )}
                  >
                    {m.qty > 0 ? `+${m.qty}` : m.qty} {m.product.unit}
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-2.5 text-ink-muted">
                    {m.note ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-ink-muted">{m.user?.name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <BarcodeScannerModal
        open={scanning}
        onClose={() => setScanning(false)}
        onResult={handleScan}
        mode="stock"
        title="Scan product to count / adjust"
      />
    </div>
  );
}
