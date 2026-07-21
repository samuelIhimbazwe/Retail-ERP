import Link from "next/link";
import { getBiData } from "@/lib/actions";
import { REPORT_PERIODS, isReportPeriodId } from "@/lib/report-periods";
import { PageHeader, Panel } from "@/components/ui/primitives";
import { formatCurrency, cn } from "@/lib/utils";
import {
  BiCategoryChart,
  BiPaymentChart,
  BiProductsChart,
  BiRevenueChart,
} from "@/components/bi-charts";

export default async function BiPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const period = isReportPeriodId(params.period) ? params.period : "this_month";
  const data = await getBiData(period);

  return (
    <div>
      <PageHeader
        title="Business Intelligence"
        description={`Analytics for ${data.periodLabel} · revenue ${formatCurrency(data.revenue)} · margin ${data.marginPct}%.`}
        actions={
          <Link
            href={`/reports?period=${data.period}`}
            className="inline-flex h-8 items-center rounded-lg border border-border bg-surface-raised px-3 text-xs font-medium hover:bg-surface"
          >
            Full reports
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap gap-1.5 rounded-[var(--radius)] border border-border bg-surface-raised p-1.5">
        {REPORT_PERIODS.map((p) => {
          const active = p.id === data.period;
          return (
            <Link
              key={p.id}
              href={`/bi?period=${p.id}`}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                active ? "bg-brand text-white" : "text-ink-muted hover:bg-surface hover:text-ink",
              )}
            >
              {p.label}
            </Link>
          );
        })}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          { l: "Net revenue", v: formatCurrency(data.revenue) },
          { l: "Gross profit", v: formatCurrency(data.profit) },
          { l: "Margin", v: `${data.marginPct}%` },
          { l: "Tickets", v: String(data.tickets) },
          { l: "Avg ticket", v: formatCurrency(data.avgTicket) },
          { l: "Inventory", v: formatCurrency(data.inventoryValue) },
        ].map((x) => (
          <div key={x.l} className="rounded-[var(--radius)] border border-border bg-surface-raised p-4">
            <p className="text-xs uppercase tracking-wide text-ink-faint">{x.l}</p>
            <p className="mt-1 font-display text-xl font-semibold">{x.v}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Revenue vs COGS" subtitle={data.shortLabel}>
          <BiRevenueChart data={data.trend} />
        </Panel>
        <Panel title="Top products" subtitle="By sales">
          <BiProductsChart data={data.topProducts} />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Payment mix" subtitle={data.shortLabel}>
          <BiPaymentChart data={data.paymentMix} />
          {data.paymentMix.length > 0 && (
            <ul className="mt-2 space-y-1 border-t border-border pt-2 text-xs">
              {data.paymentMix.map((p) => (
                <li key={p.method} className="flex justify-between">
                  <span className="capitalize text-ink-muted">{p.method.toLowerCase()}</span>
                  <span className="font-medium">{formatCurrency(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Categories" subtitle="Sales by category">
          <BiCategoryChart data={data.categories} />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Cashier performance" bodyClassName="p-0">
          {data.cashiers.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-muted">No cashier activity.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs uppercase text-ink-faint">
                <tr>
                  <th className="px-4 py-2 font-medium">Cashier</th>
                  <th className="px-4 py-2 text-right font-medium">Tickets</th>
                  <th className="px-4 py-2 text-right font-medium">Sales</th>
                  <th className="px-4 py-2 text-right font-medium">Profit</th>
                </tr>
              </thead>
              <tbody>
                {data.cashiers.map((c) => (
                  <tr key={c.name} className="border-t border-border">
                    <td className="px-4 py-2.5">{c.name}</td>
                    <td className="px-4 py-2.5 text-right">{c.tickets}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(c.sales)}</td>
                    <td className="px-4 py-2.5 text-right text-brand">{formatCurrency(c.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Product profitability" bodyClassName="p-0">
          {data.topProducts.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-muted">No product sales.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs uppercase text-ink-faint">
                <tr>
                  <th className="px-4 py-2 font-medium">Product</th>
                  <th className="px-4 py-2 text-right font-medium">Qty</th>
                  <th className="px-4 py-2 text-right font-medium">Sales</th>
                  <th className="px-4 py-2 text-right font-medium">Margin</th>
                </tr>
              </thead>
              <tbody>
                {data.topProducts.slice(0, 8).map((p) => (
                  <tr key={p.sku + p.name} className="border-t border-border">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{p.name}</p>
                      <p className="font-mono text-[11px] text-ink-faint">{p.sku}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right">{p.qty}</td>
                    <td className="px-4 py-2.5 text-right">{formatCurrency(p.sales)}</td>
                    <td className="px-4 py-2.5 text-right">{p.margin}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <Panel title="Branch comparison" subtitle={data.shortLabel} className="mt-4" bodyClassName="p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-xs uppercase text-ink-faint">
            <tr>
              <th className="px-4 py-2 font-medium">Branch</th>
              <th className="px-4 py-2 text-right font-medium">Tickets</th>
              <th className="px-4 py-2 text-right font-medium">Sales</th>
              <th className="px-4 py-2 text-right font-medium">Profit</th>
              <th className="px-4 py-2 text-right font-medium">Stock</th>
              <th className="px-4 py-2 text-right font-medium">Health</th>
            </tr>
          </thead>
          <tbody>
            {data.branches.map((b) => (
              <tr key={b.id} className="border-t border-border">
                <td className="px-4 py-2.5 font-medium">
                  {b.name}
                  {b.isDefault && (
                    <span className="ml-1 text-[10px] uppercase text-ink-faint">default</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">{b.saleCount}</td>
                <td className="px-4 py-2.5 text-right">{formatCurrency(b.sales)}</td>
                <td className="px-4 py-2.5 text-right">{formatCurrency(b.profit)}</td>
                <td className="px-4 py-2.5 text-right">
                  {b.isDefault ? formatCurrency(b.stock) : "Shared"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className="font-display text-lg font-semibold text-brand">{b.health}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
