"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { generateReorderPurchaseOrders } from "@/lib/actions";
import { PageHeader, Panel, Button } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

type Rec = {
  id: string;
  name: string;
  sku: string;
  stock: number;
  minStock: number;
  unit: string;
  suggestedQty: number;
  supplier: string;
  supplierId: string | null;
  estCost: number;
  urgency: string;
};

type SupplierOpt = {
  id: string;
  name: string;
  rating: number;
  leadDays: number;
  category: string;
};

export function ProcurementClient({
  recommendations,
  supplierOptions,
  estTotal,
}: {
  recommendations: Rec[];
  supplierOptions: SupplierOpt[];
  estTotal: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function generate() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await generateReorderPurchaseOrders();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(`Created ${result.numbers.join(", ")}`);
      router.refresh();
    });
  }

  return (
    <div>
      <PageHeader
        title="Procurement Automation"
        description={`Reorder from live stock levels · ${recommendations.length} SKUs need attention · est. ${formatCurrency(estTotal)}.`}
        actions={
          <>
            <Link href="/purchasing">
              <Button variant="secondary" size="sm">
                View purchase orders
              </Button>
            </Link>
            <Button size="sm" onClick={generate} disabled={pending || recommendations.length === 0}>
              {pending ? "Generating…" : "Generate POs"}
            </Button>
          </>
        }
      />

      {message && <p className="mb-3 text-sm font-medium text-brand-deep">{message}</p>}
      {error && <p className="mb-3 text-sm font-medium text-danger">{error}</p>}

      {supplierOptions.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {supplierOptions.map((s) => (
            <span
              key={s.id}
              className="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs text-ink-muted"
            >
              {s.name} · {s.rating}★ · {s.leadDays}d lead
            </span>
          ))}
        </div>
      )}

      <Panel title="Reorder recommendations" bodyClassName="p-0">
        {recommendations.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-muted">
            Stock is healthy — no reorder suggestions right now.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase text-ink-faint">
              <tr>
                <th className="px-4 py-2 font-medium">Product</th>
                <th className="px-4 py-2 font-medium">Stock / Min</th>
                <th className="px-4 py-2 font-medium">Suggested qty</th>
                <th className="px-4 py-2 font-medium">Supplier</th>
                <th className="px-4 py-2 font-medium">Est. cost</th>
                <th className="px-4 py-2 font-medium">Priority</th>
              </tr>
            </thead>
            <tbody>
              {recommendations.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{p.name}</p>
                    <p className="font-mono text-[11px] text-ink-faint">{p.sku}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    {p.stock} / {p.minStock} {p.unit}
                  </td>
                  <td className="px-4 py-2.5 font-medium">{p.suggestedQty}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{p.supplier}</td>
                  <td className="px-4 py-2.5 font-medium">{formatCurrency(p.estCost)}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={p.urgency === "critical" ? "danger" : "warn"}>
                      {p.urgency}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
