"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, statusBadge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/kpi-card";
import { Button, Input, Panel } from "@/components/ui/primitives";
import { productMatchesQuery } from "@/lib/product-utils";
import { formatCurrency, cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowDownToLine,
  Boxes,
  ClipboardList,
  MapPin,
  Package,
  Search,
  Truck,
  Warehouse,
  X,
} from "lucide-react";

type WarehouseProduct = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  category: string;
  stockQty: number;
  minStock: number;
  unit: string;
  value: number;
  location: string;
  status: "out" | "low" | "ok";
};

type WarehousePayload = {
  zones: {
    id: string;
    name: string;
    skus: number;
    value: number;
    units: number;
    low: number;
    out: number;
    utilization: number;
    share: number;
  }[];
  totalSkus: number;
  totalValue: number;
  totalUnits: number;
  openReceives: number;
  lowStockCount: number;
  outOfStockCount: number;
  expiringCount: number;
  products: WarehouseProduct[];
  pickList: {
    id: string;
    name: string;
    sku: string;
    category: string;
    stockQty: number;
    minStock: number;
    unit: string;
    reorderQty: number;
    status: string;
  }[];
  movements: {
    id: string;
    productId: string;
    product: string;
    sku: string;
    type: string;
    qty: number;
    note: string | null;
    user: string;
    time: string;
  }[];
  inbound: {
    id: string;
    number: string;
    supplier: string;
    status: string;
    total: number;
    lines: number;
    progress: number;
    orderDate: string;
  }[];
};

const MOVEMENT_FILTERS = ["All", "Receive", "Sale", "Adjustment", "Return"] as const;

export function WarehouseClient({ data }: { data: WarehousePayload }) {
  const [q, setQ] = useState("");
  const [zone, setZone] = useState<string | null>(null);
  const [movementFilter, setMovementFilter] =
    useState<(typeof MOVEMENT_FILTERS)[number]>("All");

  const locatorResults = useMemo(() => {
    let list = data.products;
    if (zone) list = list.filter((p) => p.category === zone);
    if (!q.trim()) return list.slice(0, 8);
    return list
      .filter((p) =>
        productMatchesQuery(
          {
            name: p.name,
            sku: p.sku,
            barcode: p.barcode,
            brand: null,
            size: null,
            color: null,
            style: null,
            category: p.category,
          },
          q,
        ),
      )
      .slice(0, 12);
  }, [data.products, q, zone]);

  const filteredMovements = useMemo(() => {
    if (movementFilter === "All") return data.movements;
    const map: Record<(typeof MOVEMENT_FILTERS)[number], string> = {
      All: "",
      Receive: "RECEIVE",
      Sale: "SALE",
      Adjustment: "ADJUSTMENT",
      Return: "RETURN",
    };
    const t = map[movementFilter];
    return data.movements.filter((m) => m.type === t);
  }, [data.movements, movementFilter]);

  const featured = locatorResults[0] ?? null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Warehouse Management
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Category zones, inbound POs, pick list, and stock movements from live inventory.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/receive">
            <Button size="sm">
              <ArrowDownToLine className="h-4 w-4" /> Receive goods
            </Button>
          </Link>
          <Link href="/inventory">
            <Button variant="secondary" size="sm">
              <Boxes className="h-4 w-4" /> Inventory
            </Button>
          </Link>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Active SKUs" value={data.totalSkus} icon={Package} tone="brand" />
        <KpiCard label="Inventory value" value={data.totalValue} icon={Warehouse} currency tone="accent" />
        <KpiCard label="Units on hand" value={data.totalUnits} icon={Boxes} tone="info" />
        <KpiCard
          label="Low stock"
          value={data.lowStockCount}
          icon={AlertTriangle}
          tone={data.lowStockCount ? "warn" : "info"}
        />
        <KpiCard
          label="Out of stock"
          value={data.outOfStockCount}
          icon={AlertTriangle}
          tone={data.outOfStockCount ? "warn" : "info"}
        />
        <KpiCard label="Open inbound" value={data.openReceives} icon={Truck} tone="brand" />
      </div>

      {data.expiringCount > 0 && (
        <p className="mb-4 rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-sm text-warn">
          {data.expiringCount} SKU{data.expiringCount === 1 ? "" : "s"} expiring within 30 days — review in{" "}
          <Link href="/inventory" className="font-medium underline">
            Inventory
          </Link>
          .
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-ink-muted">Zones:</span>
        <button
          type="button"
          onClick={() => setZone(null)}
          className={cn(
            "rounded-lg border px-3 py-1 text-xs font-medium",
            !zone ? "border-brand bg-brand text-white" : "border-border hover:border-brand",
          )}
        >
          All
        </button>
        {data.zones.map((z) => (
          <button
            key={z.id}
            type="button"
            onClick={() => setZone(z.name === zone ? null : z.name)}
            className={cn(
              "rounded-lg border px-3 py-1 text-xs font-medium",
              zone === z.name
                ? "border-brand bg-brand text-white"
                : "border-border hover:border-brand",
            )}
          >
            {z.name}
            {(z.low > 0 || z.out > 0) && (
              <span className="ml-1 opacity-80">({z.low + z.out})</span>
            )}
          </button>
        ))}
        {zone && (
          <button
            type="button"
            onClick={() => setZone(null)}
            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.zones.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => setZone(w.name === zone ? null : w.name)}
            className={cn(
              "rounded-[var(--radius)] border border-border bg-surface-raised p-4 text-left shadow-[var(--shadow-sm)] transition-colors hover:border-brand",
              zone === w.name && "ring-1 ring-brand",
            )}
          >
            <div className="flex items-center gap-2">
              <Warehouse className="h-4 w-4 text-brand" />
              <p className="text-sm font-semibold">{w.name}</p>
            </div>
            <p className="mt-3 font-display text-2xl font-semibold">{w.utilization}%</p>
            <p className="text-xs text-ink-faint">{w.share}% of inventory value</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
              <div className="h-full bg-brand" style={{ width: `${w.utilization}%` }} />
            </div>
            <p className="mt-3 text-xs text-ink-muted">
              {w.skus} SKUs · {w.units} units · {formatCurrency(w.value)}
            </p>
            {(w.low > 0 || w.out > 0) && (
              <p className="mt-1 text-xs text-warn">
                {w.out > 0 ? `${w.out} out` : ""}
                {w.out > 0 && w.low > 0 ? " · " : ""}
                {w.low > 0 ? `${w.low} low` : ""}
              </p>
            )}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Product locator" subtitle="Search by name, SKU, or barcode">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Scan or type SKU…"
              className="pl-9"
            />
          </div>
          {featured ? (
            <div className="mb-3 flex items-start gap-3 rounded-lg border border-border bg-surface p-4">
              <MapPin className="mt-0.5 h-5 w-5 text-accent" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{featured.name}</p>
                  <Badge
                    variant={
                      featured.status === "out"
                        ? "danger"
                        : featured.status === "low"
                          ? "warn"
                          : "success"
                    }
                  >
                    {featured.status === "out"
                      ? "Out"
                      : featured.status === "low"
                        ? "Low"
                        : "OK"}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-ink-muted">{featured.location}</p>
                <p className="mt-2 font-mono text-xs text-ink-faint">
                  {featured.sku}
                  {featured.barcode ? ` · ${featured.barcode}` : ""} · {featured.stockQty}{" "}
                  {featured.unit}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/inventory?product=${featured.id}`}>
                    <Button size="sm" variant="secondary">
                      Adjust / count
                    </Button>
                  </Link>
                  <Link href="/stock-check">
                    <Button size="sm" variant="ghost">
                      Stock check
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <p className="mb-3 text-sm text-ink-muted">No products match.</p>
          )}
          {locatorResults.length > 1 && (
            <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
              {locatorResults.slice(1).map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/inventory?product=${p.id}`}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-surface"
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="shrink-0 text-xs text-ink-faint">
                      {p.stockQty} {p.unit}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Receiving bay" subtitle="Open purchase orders">
          {data.inbound.length === 0 ? (
            <div className="text-sm text-ink-muted">
              <p>No open purchase orders.</p>
              <Link href="/purchasing" className="mt-2 inline-block text-brand hover:underline">
                Create a PO →
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {data.inbound.map((po) => (
                <li
                  key={po.id}
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{po.number}</p>
                      <p className="text-xs text-ink-faint">
                        {po.supplier} · {po.orderDate} · {po.lines} line{po.lines === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant={statusBadge(po.status)}>{po.status}</Badge>
                      <p className="mt-1 text-xs">{formatCurrency(po.total)}</p>
                    </div>
                  </div>
                  {po.progress > 0 && po.progress < 100 && (
                    <div className="mt-2">
                      <div className="h-1 overflow-hidden rounded-full bg-surface-sunken">
                        <div className="h-full bg-brand" style={{ width: `${po.progress}%` }} />
                      </div>
                      <p className="mt-0.5 text-[10px] text-ink-faint">{po.progress}% received</p>
                    </div>
                  )}
                  <Link href={`/receive?po=${po.id}`} className="mt-2 inline-block">
                    <Button size="sm" variant="secondary">
                      Open receive
                    </Button>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {data.pickList.length > 0 && (
        <Panel title="Pick / reorder list" subtitle="Low and out-of-stock SKUs" className="mt-4">
          <ul className="divide-y divide-border">
            {data.pickList.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-ink-faint">
                    {p.sku} · {p.category} · {p.stockQty}/{p.minStock} {p.unit}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={p.status === "out" ? "danger" : "warn"}>
                    {p.status === "out" ? "Out" : "Low"}
                  </Badge>
                  <span className="text-xs text-ink-muted">Reorder ~{p.reorderQty}</span>
                  <Link href={`/inventory?product=${p.id}`}>
                    <Button size="sm" variant="ghost">
                      Adjust
                    </Button>
                  </Link>
                  <Link href={`/purchasing?product=${p.id}`}>
                    <Button size="sm" variant="secondary">
                      <ClipboardList className="h-3.5 w-3.5" /> PO
                    </Button>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel
        title="Recent stock movements"
        className="mt-4"
        bodyClassName="p-0"
        actions={
          <div className="flex flex-wrap gap-1">
            {MOVEMENT_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setMovementFilter(f)}
                className={cn(
                  "rounded-md px-2 py-0.5 text-[10px] font-medium",
                  movementFilter === f
                    ? "bg-brand text-white"
                    : "text-ink-muted hover:bg-surface",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        }
      >
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-xs uppercase text-ink-faint">
            <tr>
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">Product</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 text-right font-medium">Qty</th>
              <th className="px-4 py-2 font-medium">By</th>
            </tr>
          </thead>
          <tbody>
            {filteredMovements.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-muted">
                  No movements in this filter
                </td>
              </tr>
            )}
            {filteredMovements.map((m) => (
              <tr key={m.id} className="border-t border-border">
                <td className="px-4 py-2 text-xs text-ink-faint">
                  {new Date(m.time).toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="px-4 py-2">
                  <Link
                    href={`/inventory?product=${m.productId}`}
                    className="hover:text-brand hover:underline"
                  >
                    {m.product}
                  </Link>
                  <p className="text-[10px] text-ink-faint">{m.sku}</p>
                </td>
                <td className="px-4 py-2">
                  <Badge variant={statusBadge(m.type)}>{m.type}</Badge>
                </td>
                <td
                  className={cn(
                    "px-4 py-2 text-right font-medium",
                    m.qty > 0 ? "text-success" : m.qty < 0 ? "text-danger" : "",
                  )}
                >
                  {m.qty > 0 ? `+${m.qty}` : m.qty}
                </td>
                <td className="px-4 py-2 text-ink-muted">{m.user}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
