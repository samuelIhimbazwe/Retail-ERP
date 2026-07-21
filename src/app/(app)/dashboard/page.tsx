import Link from "next/link";
import { getDashboardData } from "@/lib/actions";
import { REPORT_PERIODS, isReportPeriodId } from "@/lib/report-periods";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader, Panel } from "@/components/ui/primitives";
import { Badge, statusBadge } from "@/components/ui/badge";
import { formatCurrency, cn } from "@/lib/utils";
import {
  Banknote,
  Boxes,
  CircleDollarSign,
  ShoppingBag,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { DashboardChart } from "@/components/dashboard-chart";

const DASH_PERIODS = REPORT_PERIODS.filter((p) =>
  ["today", "yesterday", "this_week", "last_week", "this_month", "last_month", "ytd"].includes(
    p.id,
  ),
);

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const period =
    isReportPeriodId(params.period) &&
    DASH_PERIODS.some((p) => p.id === params.period)
      ? params.period
      : "today";
  const data = await getDashboardData(period);

  return (
    <div>
      <PageHeader
        title="Owner Dashboard"
        description={`${data.businessName}${data.branchName ? ` · ${data.branchName}` : ""} · ${data.periodLabel}`}
        actions={
          <>
            <Link
              href="/counter"
              className="inline-flex h-8 items-center gap-2 rounded-lg bg-brand px-3 text-xs font-medium text-white hover:bg-brand-deep"
            >
              Counter Mode
            </Link>
            <Link
              href="/pos"
              className="inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 text-xs font-medium hover:bg-surface-sunken"
            >
              Sell
            </Link>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap gap-1.5 rounded-[var(--radius)] border border-border bg-surface-raised p-1.5">
        {DASH_PERIODS.map((p) => {
          const active = p.id === data.period;
          return (
            <Link
              key={p.id}
              href={`/dashboard?period=${p.id}`}
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

      <div className="mb-4 grid gap-4 lg:grid-cols-5">
        <div className="flex items-center gap-3 rounded-[var(--radius)] border border-border bg-surface-raised p-4 lg:col-span-2">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand text-xl font-bold text-white shadow-[var(--shadow)]">
            {data.healthScore}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">Business health</p>
            <p className="text-xs text-ink-muted">
              Score from sales, stock, cash, receivables & profit for this view.
            </p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-1 xl:grid-cols-2">
          {data.healthFactors.map((f) => (
            <div
              key={f.id}
              className="flex items-start gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs"
            >
              {f.ok ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
              ) : (
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
              )}
              <div className="min-w-0">
                <p className="font-medium text-ink">
                  {f.label}{" "}
                  <span className="text-ink-faint">
                    ({f.delta > 0 ? `+${f.delta}` : f.delta})
                  </span>
                </p>
                <p className="truncate text-ink-muted">{f.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={`Sales · ${data.shortLabel}`}
          value={data.salesPeriod}
          change={data.salesChange}
          icon={ShoppingBag}
          currency
          tone="brand"
        />
        <KpiCard
          label={`Gross profit · ${data.shortLabel}`}
          value={data.profitPeriod}
          change={data.profitChange}
          icon={CircleDollarSign}
          currency
          tone="info"
        />
        <KpiCard label="Liquid (cash+bank+MoMo)" value={data.liquid} icon={Banknote} currency tone="accent" />
        <KpiCard label="Inventory value" value={data.inventoryValue} icon={Boxes} currency tone="warn" />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {[
          { l: "Tickets", v: String(data.tickets), href: `/reports?period=${data.period}` },
          { l: "Avg ticket", v: formatCurrency(data.avgTicket), href: "/pos" },
          { l: "VAT collected", v: formatCurrency(data.vatCollected), href: `/tax?period=${data.period}` },
        ].map((x) => (
          <Link
            key={x.l}
            href={x.href}
            className="rounded-[var(--radius)] border border-border bg-surface px-4 py-3 hover:border-brand/40"
          >
            <p className="text-xs text-ink-faint">{x.l}</p>
            <p className="mt-0.5 text-lg font-semibold">{x.v}</p>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel
          title={`Sales & profit · ${data.shortLabel}`}
          subtitle={`vs ${data.priorLabel}`}
          className="xl:col-span-2"
        >
          <DashboardChart data={data.salesTrend} />
        </Panel>

        <Panel
          title="Low stock"
          subtitle={`${data.lowStock.length} items · ${data.outStockCount} out`}
          actions={
            <Link href="/procurement" className="text-xs text-brand hover:underline">
              Reorder
            </Link>
          }
        >
          <ul className="space-y-2">
            {data.lowStock.length === 0 && (
              <li className="text-sm text-ink-muted">No low-stock alerts</li>
            )}
            {data.lowStock.slice(0, 6).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="text-xs text-ink-faint">
                    {p.stock} / min {p.minStock} {p.unit}
                  </p>
                </div>
                <Badge variant={statusBadge(p.status)}>{p.status}</Badge>
              </li>
            ))}
          </ul>
          <Link
            href="/inventory"
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
          >
            Inventory <ArrowRight className="h-3 w-3" />
          </Link>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Balances & obligations">
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between">
              <Link href="/purchasing" className="text-ink-muted hover:text-brand">
                Supplier payables
              </Link>
              <span className="font-semibold">{formatCurrency(data.supplierPayables)}</span>
            </li>
            <li className="flex justify-between">
              <Link href="/customers" className="text-ink-muted hover:text-brand">
                Customer debts
              </Link>
              <span className="font-semibold">{formatCurrency(data.customerDebts)}</span>
            </li>
            <li className="flex justify-between">
              <Link href="/tax" className="text-ink-muted hover:text-brand">
                VAT payable
              </Link>
              <span className="font-semibold">{formatCurrency(data.vatPayable)}</span>
            </li>
            <li className="flex justify-between border-t border-border pt-2">
              <Link href="/banking" className="text-ink-muted hover:text-brand">
                Bank
              </Link>
              <span className="font-semibold">{formatCurrency(data.bankBalance)}</span>
            </li>
            <li className="flex justify-between">
              <Link href="/purchasing" className="text-ink-muted hover:text-brand">
                Open POs
              </Link>
              <span className="font-semibold">{data.openPos}</span>
            </li>
          </ul>
          {data.topDebtors.length > 0 && (
            <div className="mt-3 border-t border-border pt-3">
              <p className="mb-2 text-xs font-medium text-ink-faint">Top debtors</p>
              <ul className="space-y-1.5 text-xs">
                {data.topDebtors.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/quick-pay?customer=${d.id}`}
                      className="flex justify-between gap-2 hover:text-brand"
                    >
                      <span className="truncate">{d.name}</span>
                      <span className="font-medium text-accent">{formatCurrency(d.balance)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        <Panel
          title="Recent sales"
          className="lg:col-span-2"
          actions={
            <Link
              href={`/reports?period=${data.period}`}
              className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
            >
              Reports <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          <ul className="space-y-2.5">
            {data.recentActivity.length === 0 && (
              <li className="flex items-center gap-2 text-sm text-ink-muted">
                <AlertTriangle className="h-4 w-4" /> No sales yet — open Counter → Sell
              </li>
            )}
            {data.recentActivity.map((n) => (
              <li key={n.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{n.title}</p>
                  <p className="text-xs text-ink-faint">
                    {n.customer} · {new Date(n.time).toLocaleString()}
                  </p>
                </div>
                <span className="shrink-0 font-semibold">{formatCurrency(n.total)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
