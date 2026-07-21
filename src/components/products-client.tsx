"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Panel, Button, Input, Select } from "@/components/ui/primitives";
import { Badge, statusBadge } from "@/components/ui/badge";
import type { CatalogProduct } from "@/lib/product-utils";
import { productMatchesQuery, variantLabel } from "@/lib/product-utils";
import { formatCurrency, cn } from "@/lib/utils";
import { downloadCsv, toCsv } from "@/lib/csv";
import { createProduct, getInventoryExportRows, updateProduct } from "@/lib/actions";
import { Download, Pencil, Plus, Search, X } from "lucide-react";

type FormState = {
  name: string;
  category: string;
  brand: string;
  sku: string;
  barcode: string;
  size: string;
  color: string;
  style: string;
  cost: number;
  sell: number;
  wholesale: number;
  stock: number;
  minStock: number;
  unit: string;
  taxPct: number;
  taxExempt: boolean;
  batch: string;
  expiry: string;
  inactive: boolean;
};

const emptyForm = (): FormState => ({
  name: "",
  category: "Staples",
  brand: "",
  sku: "",
  barcode: "",
  size: "",
  color: "",
  style: "",
  cost: 1000,
  sell: 1500,
  wholesale: 1200,
  stock: 0,
  minStock: 10,
  unit: "pcs",
  taxPct: 18,
  taxExempt: false,
  batch: "",
  expiry: "",
  inactive: false,
});

function fromProduct(p: CatalogProduct): FormState {
  return {
    name: p.name,
    category: p.category,
    brand: p.brand ?? "",
    sku: p.sku,
    barcode: p.barcode ?? "",
    size: p.size ?? "",
    color: p.color ?? "",
    style: p.style ?? "",
    cost: p.cost,
    sell: p.sell,
    wholesale: p.wholesale,
    stock: p.stock,
    minStock: p.minStock,
    unit: p.unit,
    taxPct: Math.round((p.taxRate ?? 0.18) * 100),
    taxExempt: p.taxExempt ?? false,
    batch: p.batch === "—" ? "" : p.batch,
    expiry: p.expiry === "—" ? "" : p.expiry,
    inactive: p.status === "Inactive",
  };
}

export function ProductsClient({ initialProducts }: { initialProducts: CatalogProduct[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"active" | "all" | "inactive">("active");
  const [mode, setMode] = useState<"closed" | "create" | "edit">("closed");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(initialProducts.map((p) => p.category))).sort()],
    [initialProducts],
  );

  const filtered = initialProducts.filter((p) => {
    const matchQ = !q || productMatchesQuery(p, q);
    const matchCat = cat === "All" || p.category === cat;
    const inactive = p.status === "Inactive";
    const matchStatus =
      statusFilter === "all" ||
      (statusFilter === "inactive" ? inactive : !inactive);
    return matchQ && matchCat && matchStatus;
  });

  const kpis = useMemo(() => {
    const active = initialProducts.filter((p) => p.status !== "Inactive");
    const low = active.filter((p) => p.stock > 0 && p.stock <= p.minStock).length;
    const out = active.filter((p) => p.stock <= 0).length;
    const value = active.reduce((s, p) => s + p.stock * p.cost, 0);
    return { skus: active.length, low, out, value };
  }, [initialProducts]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openCreate() {
    setMode("create");
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
  }

  function openEdit(p: CatalogProduct) {
    setMode("edit");
    setEditingId(p.id);
    setForm(fromProduct(p));
    setError(null);
  }

  function closeForm() {
    setMode("closed");
    setEditingId(null);
    setError(null);
  }

  function exportCatalog() {
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
      downloadCsv("rbiap-products.csv", csv);
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      if (mode === "create") {
        const result = await createProduct({
          name: form.name,
          category: form.category,
          brand: form.brand || undefined,
          sku: form.sku,
          barcode: form.barcode || undefined,
          size: form.size || undefined,
          color: form.color || undefined,
          costPrice: form.cost,
          sellPrice: form.sell,
          stockQty: form.stock,
          minStock: form.minStock,
          unit: form.unit,
          taxRate: form.taxExempt ? 0 : form.taxPct / 100,
          taxExempt: form.taxExempt,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
      } else if (mode === "edit" && editingId) {
        const result = await updateProduct({
          id: editingId,
          name: form.name,
          category: form.category,
          brand: form.brand || null,
          sku: form.sku,
          barcode: form.barcode || null,
          size: form.size || null,
          color: form.color || null,
          style: form.style || null,
          costPrice: form.cost,
          sellPrice: form.sell,
          wholesalePrice: form.wholesale || null,
          minStock: form.minStock,
          unit: form.unit,
          taxRate: form.taxExempt ? 0 : form.taxPct / 100,
          taxExempt: form.taxExempt,
          batchNumber: form.batch || null,
          expiryDate: form.expiry || null,
          inactive: form.inactive,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
      }
      closeForm();
      router.refresh();
    });
  }

  const margin =
    form.sell > 0 ? Math.round(((form.sell - form.cost) / form.sell) * 1000) / 10 : 0;

  return (
    <div>
      <PageHeader
        title="Product Management"
        description="Catalog, pricing, barcodes, and tax — edit any SKU without leaving the list."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={exportCatalog} disabled={pending}>
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button size="sm" onClick={() => (mode === "closed" ? openCreate() : closeForm())}>
              {mode !== "closed" ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {mode !== "closed" ? "Close" : "Add product"}
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { l: "Active SKUs", v: String(kpis.skus) },
          { l: "Inventory value", v: formatCurrency(kpis.value) },
          { l: "Low stock", v: String(kpis.low) },
          { l: "Out of stock", v: String(kpis.out) },
        ].map((x) => (
          <div key={x.l} className="rounded-[var(--radius)] border border-border bg-surface-raised px-4 py-3">
            <p className="text-xs text-ink-faint">{x.l}</p>
            <p className="mt-0.5 font-display text-xl font-semibold">{x.v}</p>
          </div>
        ))}
      </div>

      {mode !== "closed" && (
        <Panel
          title={mode === "create" ? "New product" : "Edit product"}
          subtitle={
            mode === "edit"
              ? "Stock qty is changed in Inventory — here you set prices, barcode, and mins."
              : "Opening stock is recorded as an adjustment."
          }
          className="mb-4"
        >
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="mb-1 block text-xs text-ink-muted">Name</label>
              <Input
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Category</label>
              <Input
                value={form.category}
                onChange={(e) => setField("category", e.target.value)}
                required
                list="product-categories"
              />
              <datalist id="product-categories">
                {categories
                  .filter((c) => c !== "All")
                  .map((c) => (
                    <option key={c} value={c} />
                  ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Brand</label>
              <Input value={form.brand} onChange={(e) => setField("brand", e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">SKU</label>
              <Input
                value={form.sku}
                onChange={(e) => setField("sku", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Barcode</label>
              <Input
                value={form.barcode}
                onChange={(e) => setField("barcode", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Size</label>
              <Input
                value={form.size}
                onChange={(e) => setField("size", e.target.value)}
                placeholder="e.g. 42"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Color</label>
              <Input
                value={form.color}
                onChange={(e) => setField("color", e.target.value)}
                placeholder="e.g. Black"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Style</label>
              <Input
                value={form.style}
                onChange={(e) => setField("style", e.target.value)}
                placeholder="e.g. Slim"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Unit</label>
              <Input value={form.unit} onChange={(e) => setField("unit", e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Cost (RWF)</label>
              <Input
                type="number"
                min={0}
                value={form.cost}
                onChange={(e) => setField("cost", Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Sell (RWF)</label>
              <Input
                type="number"
                min={1}
                value={form.sell}
                onChange={(e) => setField("sell", Number(e.target.value) || 0)}
              />
              <p className="mt-0.5 text-[11px] text-ink-faint">Margin ~{margin}%</p>
            </div>
            {mode === "edit" && (
              <div>
                <label className="mb-1 block text-xs text-ink-muted">Wholesale (RWF)</label>
                <Input
                  type="number"
                  min={0}
                  value={form.wholesale}
                  onChange={(e) => setField("wholesale", Number(e.target.value) || 0)}
                />
              </div>
            )}
            {mode === "create" && (
              <div>
                <label className="mb-1 block text-xs text-ink-muted">Opening stock</label>
                <Input
                  type="number"
                  min={0}
                  value={form.stock}
                  onChange={(e) => setField("stock", Number(e.target.value) || 0)}
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Min stock</label>
              <Input
                type="number"
                min={0}
                value={form.minStock}
                onChange={(e) => setField("minStock", Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">VAT %</label>
              <Input
                type="number"
                min={0}
                max={100}
                disabled={form.taxExempt}
                value={form.taxPct}
                onChange={(e) => setField("taxPct", Number(e.target.value) || 0)}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={form.taxExempt}
                  onChange={(e) => setField("taxExempt", e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Tax exempt
              </label>
            </div>
            {mode === "edit" && (
              <>
                <div>
                  <label className="mb-1 block text-xs text-ink-muted">Batch</label>
                  <Input
                    value={form.batch}
                    onChange={(e) => setField("batch", e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-ink-muted">Expiry</label>
                  <Input
                    type="date"
                    value={form.expiry}
                    onChange={(e) => setField("expiry", e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={form.inactive}
                      onChange={(e) => setField("inactive", e.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    Inactive (hide from POS)
                  </label>
                </div>
                <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-ink-muted sm:col-span-2 lg:col-span-3">
                  Current stock:{" "}
                  <span className="font-semibold text-ink">
                    {form.stock} {form.unit}
                  </span>{" "}
                  — adjust quantities in Inventory.
                </div>
              </>
            )}
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Saving…" : mode === "create" ? "Save product" : "Update product"}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={closeForm}>
                Cancel
              </Button>
              {error && <p className="text-sm text-danger">{error}</p>}
            </div>
          </form>
        </Panel>
      )}

      <Panel bodyClassName="p-0">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input
              className="pl-9"
              placeholder="Search name, size, color, SKU, barcode…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={cat} onChange={(e) => setCat(e.target.value)}>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All statuses</option>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Cost / Sell</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Tax</th>
                <th className="px-4 py-3 font-medium">Batch / Expiry</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-ink-muted">
                    No products match these filters.
                  </td>
                </tr>
              )}
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className={cn(
                    "border-t border-border hover:bg-surface/80",
                    editingId === p.id && "bg-brand-soft/30",
                  )}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{p.name}</p>
                    {variantLabel(p) && (
                      <p className="text-xs text-ink-muted">{variantLabel(p)}</p>
                    )}
                    <p className="font-mono text-[11px] text-ink-faint">
                      {p.sku} · {p.barcode || "no barcode"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{p.category}</td>
                  <td className="px-4 py-3">
                    <p className="text-ink-muted">{formatCurrency(p.cost)}</p>
                    <p className="font-medium">{formatCurrency(p.sell)}</p>
                  </td>
                  <td className="px-4 py-3">
                    {p.stock} {p.unit}
                    <p className="text-[11px] text-ink-faint">Min {p.minStock}</p>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{p.tax}</td>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs">{p.batch}</p>
                    <p className="text-[11px] text-ink-faint">{p.expiry}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusBadge(p.status)}>{p.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(p)}
                      className="gap-1.5"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
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
