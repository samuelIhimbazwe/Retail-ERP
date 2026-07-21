"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency, cn } from "@/lib/utils";
import { ArrowLeft, Check, PackageCheck } from "lucide-react";
import { Badge, statusBadge } from "@/components/ui/badge";
import { receivePurchaseOrder } from "@/lib/actions";

type LineCard = {
  id: string;
  productId: string;
  productName: string;
  size: string | null;
  color: string | null;
  qtyOrdered: number;
  qtyReceived: number;
  unitCost: number;
};

type OrderCard = {
  id: string;
  number: string;
  supplier: string;
  total: number;
  date: string;
  status: string;
  lines: LineCard[];
};

type AltProduct = { id: string; name: string; size: string | null; color: string | null };

type LineEdit = {
  qtyGood: number;
  qtyRejected: number;
  rejectReason: string;
  receiveAsProductId: string;
};

export function ReceiveClient({
  orders,
  alternateProducts,
  initialPoId,
}: {
  orders: OrderCard[];
  alternateProducts: AltProduct[];
  initialPoId?: string;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(
    initialPoId && orders.some((o) => o.id === initialPoId)
      ? initialPoId
      : (orders[0]?.id ?? null),
  );
  const [edits, setEdits] = useState<Record<string, LineEdit>>({});
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function lineEdit(line: LineCard): LineEdit {
    return (
      edits[line.id] ?? {
        qtyGood: Math.max(0, line.qtyOrdered - line.qtyReceived),
        qtyRejected: 0,
        rejectReason: "",
        receiveAsProductId: "",
      }
    );
  }

  function setLine(lineId: string, patch: Partial<LineEdit>) {
    setEdits((prev) => {
      const order = orders.find((o) => o.lines.some((l) => l.id === lineId));
      const line = order?.lines.find((l) => l.id === lineId);
      const base = line
        ? lineEdit(line)
        : { qtyGood: 0, qtyRejected: 0, rejectReason: "", receiveAsProductId: "" };
      return { ...prev, [lineId]: { ...base, ...patch } };
    });
  }

  const altsByOrder = useMemo(() => alternateProducts, [alternateProducts]);

  async function submit(order: OrderCard, mode: "full" | "custom") {
    setBusy(order.id);
    setError(null);

    const lines =
      mode === "full"
        ? order.lines.map((l) => ({
            lineId: l.id,
            qtyGood: Math.max(0, l.qtyOrdered - l.qtyReceived),
            qtyRejected: 0,
          }))
        : order.lines.map((l) => {
            const e = lineEdit(l);
            return {
              lineId: l.id,
              qtyGood: e.qtyGood,
              qtyRejected: e.qtyRejected,
              rejectReason: e.rejectReason || null,
              receiveAsProductId: e.receiveAsProductId || null,
            };
          });

    const result = await receivePurchaseOrder({
      purchaseOrderId: order.id,
      lines,
    });
    setBusy(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setDone(order.id);
    setTimeout(() => {
      setDone(null);
      router.refresh();
    }, 1200);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/counter" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Counter
      </Link>

      <h1 className="font-display text-2xl font-semibold tracking-tight">Receive goods</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Full receive in one tap — or open lines for short delivery, damage, or wrong size.
      </p>

      {error && (
        <div className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-sm font-medium text-danger">{error}</div>
      )}

      <ul className="mt-5 space-y-3">
        {orders.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-ink-muted">
            No open purchase orders to receive
          </li>
        )}
        {orders.map((po) => {
          const justDone = done === po.id;
          const open = expanded === po.id;
          return (
            <li key={po.id} className="rounded-2xl border border-border bg-surface-raised p-4">
              <button type="button" className="w-full text-left" onClick={() => setExpanded(open ? null : po.id)}>
                <p className="font-mono text-xs text-ink-faint">{po.number}</p>
                <p className="mt-0.5 text-base font-semibold">{po.supplier}</p>
                <p className="mt-1 text-sm text-ink-muted">
                  {po.lines.length} lines · {formatCurrency(po.total)} · {po.date}
                </p>
                <div className="mt-2">
                  <Badge variant={statusBadge(po.status)}>{po.status}</Badge>
                </div>
              </button>

              {open && (
                <div className="mt-4 space-y-3 border-t border-border pt-3">
                  {po.lines.map((line) => {
                    const e = lineEdit(line);
                    const remaining = line.qtyOrdered - line.qtyReceived;
                    const alts = altsByOrder.filter((a) => a.id !== line.productId);
                    return (
                      <div key={line.id} className="rounded-xl bg-surface p-3">
                        <p className="text-sm font-semibold">{line.productName}</p>
                        <p className="text-xs text-ink-faint">
                          {[line.color, line.size].filter(Boolean).join(" · ") || "—"} · ordered{" "}
                          {line.qtyOrdered} · remaining {remaining}
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <label className="text-xs text-ink-muted">
                            Good qty
                            <input
                              type="number"
                              min={0}
                              max={remaining}
                              value={e.qtyGood}
                              onChange={(ev) => setLine(line.id, { qtyGood: Number(ev.target.value) || 0 })}
                              className="mt-1 h-10 w-full rounded-lg border border-border px-2 text-sm"
                            />
                          </label>
                          <label className="text-xs text-ink-muted">
                            Rejected
                            <input
                              type="number"
                              min={0}
                              max={remaining}
                              value={e.qtyRejected}
                              onChange={(ev) => setLine(line.id, { qtyRejected: Number(ev.target.value) || 0 })}
                              className="mt-1 h-10 w-full rounded-lg border border-border px-2 text-sm"
                            />
                          </label>
                        </div>
                        {e.qtyRejected > 0 && (
                          <input
                            value={e.rejectReason}
                            onChange={(ev) => setLine(line.id, { rejectReason: ev.target.value })}
                            placeholder="Reason: damaged, poor quality…"
                            className="mt-2 h-10 w-full rounded-lg border border-border px-2 text-sm"
                          />
                        )}
                        <label className="mt-2 block text-xs text-ink-muted">
                          Arrived as different SKU (e.g. size 41 not 42)
                          <select
                            value={e.receiveAsProductId}
                            onChange={(ev) => setLine(line.id, { receiveAsProductId: ev.target.value })}
                            className="mt-1 h-10 w-full rounded-lg border border-border bg-surface-raised px-2 text-sm"
                          >
                            <option value="">Same as ordered</option>
                            {alts.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                                {[a.color, a.size].filter(Boolean).length
                                  ? ` · ${[a.color, a.size].filter(Boolean).join(" ")}`
                                  : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    );
                  })}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => submit(po, "full")}
                      disabled={justDone || busy === po.id}
                      className="flex h-12 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-white disabled:opacity-50"
                    >
                      <PackageCheck className="h-4 w-4" /> All good
                    </button>
                    <button
                      type="button"
                      onClick={() => submit(po, "custom")}
                      disabled={justDone || busy === po.id}
                      className={cn(
                        "flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50",
                        justDone ? "bg-success" : "bg-brand",
                      )}
                    >
                      {justDone ? (
                        <>
                          <Check className="h-4 w-4" /> Updated
                        </>
                      ) : busy === po.id ? (
                        "Saving…"
                      ) : (
                        "Save lines"
                      )}
                    </button>
                  </div>
                </div>
              )}

              {!open && (
                <button
                  type="button"
                  onClick={() => submit(po, "full")}
                  disabled={justDone || busy === po.id}
                  className={cn(
                    "mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold transition",
                    justDone
                      ? "bg-success text-white"
                      : "bg-accent text-white hover:bg-[#a34a1c] active:scale-[0.99]",
                  )}
                >
                  {justDone ? (
                    <>
                      <Check className="h-5 w-5" /> Stock updated
                    </>
                  ) : busy === po.id ? (
                    "Receiving…"
                  ) : (
                    <>
                      <PackageCheck className="h-5 w-5" /> Confirm all arrived
                    </>
                  )}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
