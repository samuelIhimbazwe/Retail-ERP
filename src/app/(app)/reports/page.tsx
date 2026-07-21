import Link from "next/link";
import { getReportsData } from "@/lib/actions";
import { REPORT_PERIODS, isReportPeriodId } from "@/lib/report-periods";
import { PageHeader, Panel } from "@/components/ui/primitives";
import { formatCurrency, cn } from "@/lib/utils";
import { ReportsChart } from "@/components/reports-chart";
import { ReportsExportMenu } from "@/components/reports-export-menu";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const period = isReportPeriodId(params.period) ? params.period : "this_month";
  const data = await getReportsData(period);
  const k = data.kpis;
  const bs = data.balanceSheet;

  return (
    <div>
      <PageHeader
        title="Financial Reporting"
        description={`Detailed P&L, sales, purchases, AR/AP, inventory, and trial balance for ${data.periodLabel}.`}
        actions={
          <ReportsExportMenu
            period={data.period}
            data={{
              periodLabel: data.periodLabel,
              shortLabel: data.shortLabel,
              incomeStatement: data.incomeStatement,
              trialBalance: data.trialBalance,
              topProducts: data.topProducts,
              categories: data.categories,
              cashiers: data.cashiers,
              paymentMix: data.paymentMix,
              salesRegister: data.salesRegister,
              purchases: data.purchases,
            }}
          />
        }
      />

      <div className="mb-5 flex flex-wrap gap-1.5 rounded-[var(--radius)] border border-border bg-surface-raised p-1.5">
        {REPORT_PERIODS.map((p) => {
          const active = p.id === data.period;
          return (
            <Link
              key={p.id}
              href={`/reports?period=${p.id}`}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-brand text-white"
                  : "text-ink-muted hover:bg-surface hover:text-ink",
              )}
            >
              {p.label}
            </Link>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { l: "Gross sales", v: formatCurrency(k.grossSales), h: `${k.tickets} tickets` },
          { l: "Net revenue", v: formatCurrency(k.revenue), h: `VAT ${formatCurrency(k.vatCollected)}` },
          { l: "Gross profit", v: formatCurrency(k.profit), h: `${k.marginPct}% margin` },
          { l: "Avg ticket", v: formatCurrency(k.avgTicket), h: `${k.unitsSold} units sold` },
        ].map((x) => (
          <div key={x.l} className="rounded-[var(--radius)] border border-border bg-surface-raised p-4">
            <p className="text-xs uppercase tracking-wide text-ink-faint">{x.l}</p>
            <p className="mt-1 font-display text-2xl font-semibold">{x.v}</p>
            <p className="mt-0.5 text-xs text-ink-muted">{x.h}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { l: "COGS", v: formatCurrency(k.cogs) },
          { l: "Discounts", v: formatCurrency(k.discounts) },
          { l: "Purchases", v: formatCurrency(k.purchasesTotal) },
          { l: "Inventory value", v: formatCurrency(data.inventory.value) },
        ].map((x) => (
          <div key={x.l} className="rounded-[var(--radius)] border border-border bg-surface px-4 py-3">
            <p className="text-xs text-ink-faint">{x.l}</p>
            <p className="mt-0.5 text-lg font-semibold">{x.v}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Panel
          title={`Sales & COGS trend (${data.trendMode})`}
          subtitle={data.periodLabel}
          className="xl:col-span-3"
        >
          <ReportsChart data={data.trend} />
        </Panel>

        <Panel title="Payment mix" className="xl:col-span-2" bodyClassName="p-0">
          {data.paymentMix.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-muted">No payments in this period.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs uppercase text-ink-faint">
                <tr>
                  <th className="px-4 py-2 font-medium">Method</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                  <th className="px-4 py-2 text-right font-medium">Share</th>
                </tr>
              </thead>
              <tbody>
                {data.paymentMix.map((p) => {
                  const share =
                    k.grossSales > 0 ? Math.round((p.amount / k.grossSales) * 1000) / 10 : 0;
                  return (
                    <tr key={p.method} className="border-t border-border">
                      <td className="px-4 py-2 capitalize">{p.method.toLowerCase()}</td>
                      <td className="px-4 py-2 text-right font-medium">{formatCurrency(p.amount)}</td>
                      <td className="px-4 py-2 text-right text-ink-muted">{share}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Income statement" subtitle={data.shortLabel} bodyClassName="p-0">
          <table className="w-full text-left text-sm">
            <tbody>
              {data.incomeStatement.map((row) => (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <td
                    className={cn(
                      "px-4 py-2.5",
                      row.label === "Gross profit" || row.label === "Net sales revenue"
                        ? "font-semibold"
                        : "",
                    )}
                  >
                    {row.label}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2.5 text-right font-medium",
                      row.amount < 0 ? "text-accent" : row.label === "Gross profit" ? "text-brand" : "",
                    )}
                  >
                    {formatCurrency(row.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Balance sheet snapshot" subtitle="As of now" bodyClassName="p-0">
          <table className="w-full text-left text-sm">
            <tbody>
              {[
                { l: "Cash", v: bs.cash },
                { l: "Bank", v: bs.bank },
                { l: "Mobile money", v: bs.momo },
                { l: "Inventory", v: bs.inventoryValue },
                { l: "Accounts receivable", v: bs.ar },
                { l: "Total assets", v: bs.assets },
                { l: "Accounts payable", v: bs.ap },
                { l: "VAT payable", v: bs.vatPayable },
                { l: "Total liabilities", v: bs.liabilities },
                { l: "Equity", v: bs.equity },
              ].map((row) => (
                <tr key={row.l} className="border-b border-border last:border-0">
                  <td
                    className={cn(
                      "px-4 py-2.5",
                      row.l.startsWith("Total") || row.l === "Equity" ? "font-semibold" : "",
                    )}
                  >
                    {row.l}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(row.v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-border px-4 py-2 text-xs text-ink-faint">
            Point-in-time balances ·{" "}
            <Link href="/tax" className="text-brand hover:underline">
              VAT workspace
            </Link>{" "}
            ·{" "}
            <Link href="/accounting" className="text-brand hover:underline">
              Journals
            </Link>
          </p>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Cashier performance" subtitle={data.shortLabel} bodyClassName="p-0">
          {data.cashiers.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-muted">No cashier activity in this period.</p>
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
                    <td className="px-4 py-2">{c.name}</td>
                    <td className="px-4 py-2 text-right">{c.tickets}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatCurrency(c.sales)}</td>
                    <td className="px-4 py-2 text-right text-brand">{formatCurrency(c.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Category performance" subtitle={data.shortLabel} bodyClassName="p-0">
          {data.categories.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-muted">No category sales in this period.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs uppercase text-ink-faint">
                <tr>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 text-right font-medium">Qty</th>
                  <th className="px-4 py-2 text-right font-medium">Sales</th>
                </tr>
              </thead>
              <tbody>
                {data.categories.map((c) => (
                  <tr key={c.category} className="border-t border-border">
                    <td className="px-4 py-2">{c.category}</td>
                    <td className="px-4 py-2 text-right">{c.qty}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatCurrency(c.sales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Product profitability" subtitle={`Top sellers · ${data.shortLabel}`} bodyClassName="p-0">
          {data.topProducts.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-muted">
              No product sales in this period — run POS or pick another range.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-surface text-xs uppercase text-ink-faint">
                  <tr>
                    <th className="px-4 py-2 font-medium">Product</th>
                    <th className="px-4 py-2 font-medium">SKU</th>
                    <th className="px-4 py-2 font-medium">Category</th>
                    <th className="px-4 py-2 text-right font-medium">Qty</th>
                    <th className="px-4 py-2 text-right font-medium">Sales</th>
                    <th className="px-4 py-2 text-right font-medium">COGS</th>
                    <th className="px-4 py-2 text-right font-medium">Profit</th>
                    <th className="px-4 py-2 text-right font-medium">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topProducts.map((p) => (
                    <tr key={p.sku + p.name} className="border-t border-border">
                      <td className="px-4 py-2">{p.name}</td>
                      <td className="px-4 py-2 font-mono text-xs text-ink-muted">{p.sku}</td>
                      <td className="px-4 py-2 text-ink-muted">{p.category}</td>
                      <td className="px-4 py-2 text-right">{p.qty}</td>
                      <td className="px-4 py-2 text-right font-medium">{formatCurrency(p.sales)}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(p.cogs)}</td>
                      <td className="px-4 py-2 text-right text-brand">{formatCurrency(p.profit)}</td>
                      <td className="px-4 py-2 text-right">{p.margin}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-4">
        <Panel
          title="Sales register"
          subtitle={`${data.salesRegister.length} of ${k.tickets} tickets shown`}
          bodyClassName="p-0"
        >
          {data.salesRegister.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-muted">No sales in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-surface text-xs uppercase text-ink-faint">
                  <tr>
                    <th className="px-4 py-2 font-medium">Ticket</th>
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Cashier</th>
                    <th className="px-4 py-2 font-medium">Customer</th>
                    <th className="px-4 py-2 font-medium">Method</th>
                    <th className="px-4 py-2 text-right font-medium">Items</th>
                    <th className="px-4 py-2 text-right font-medium">Tax</th>
                    <th className="px-4 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.salesRegister.map((s) => (
                    <tr key={s.id} className="border-t border-border">
                      <td className="px-4 py-2 font-mono text-xs">{s.number}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {s.date} {s.time}
                      </td>
                      <td className="px-4 py-2">{s.cashier}</td>
                      <td className="px-4 py-2">{s.customer}</td>
                      <td className="px-4 py-2 capitalize">{s.method.toLowerCase()}</td>
                      <td className="px-4 py-2 text-right">{s.items}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(s.tax)}</td>
                      <td className="px-4 py-2 text-right font-medium">{formatCurrency(s.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Purchases" subtitle={data.shortLabel} bodyClassName="p-0">
          {data.purchases.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-muted">No purchase orders in this period.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs uppercase text-ink-faint">
                <tr>
                  <th className="px-4 py-2 font-medium">PO</th>
                  <th className="px-4 py-2 font-medium">Supplier</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.purchases.map((po) => (
                  <tr key={po.number} className="border-t border-border">
                    <td className="px-4 py-2 font-mono text-xs">{po.number}</td>
                    <td className="px-4 py-2">{po.supplier}</td>
                    <td className="px-4 py-2 capitalize text-ink-muted">{po.status.toLowerCase()}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatCurrency(po.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Inventory alerts" subtitle="Current stock" bodyClassName="p-0">
          <div className="grid grid-cols-3 gap-2 border-b border-border px-4 py-3 text-center">
            <div>
              <p className="text-xs text-ink-faint">SKUs</p>
              <p className="font-semibold">{data.inventory.skuCount}</p>
            </div>
            <div>
              <p className="text-xs text-ink-faint">Low stock</p>
              <p className="font-semibold text-accent">{data.inventory.lowStock}</p>
            </div>
            <div>
              <p className="text-xs text-ink-faint">Out of stock</p>
              <p className="font-semibold text-danger">{data.inventory.outOfStock}</p>
            </div>
          </div>
          {data.inventory.lowStockItems.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-muted">All SKUs above minimum.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs uppercase text-ink-faint">
                <tr>
                  <th className="px-4 py-2 font-medium">Product</th>
                  <th className="px-4 py-2 text-right font-medium">Stock</th>
                  <th className="px-4 py-2 text-right font-medium">Min</th>
                </tr>
              </thead>
              <tbody>
                {data.inventory.lowStockItems.map((p) => (
                  <tr key={p.sku} className="border-t border-border">
                    <td className="px-4 py-2">
                      <Link
                        href={`/inventory?product=${p.id}`}
                        className="block font-medium hover:text-brand hover:underline"
                      >
                        {p.name}
                      </Link>
                      <span className="font-mono text-xs text-ink-faint">{p.sku}</span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {p.stock} {p.unit}
                    </td>
                    <td className="px-4 py-2 text-right text-ink-muted">{p.min}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Accounts receivable" subtitle="Open customer balances" bodyClassName="p-0">
          {data.debtors.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-muted">No outstanding receivables.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs uppercase text-ink-faint">
                <tr>
                  <th className="px-4 py-2 font-medium">Customer</th>
                  <th className="px-4 py-2 font-medium">Segment</th>
                  <th className="px-4 py-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.debtors.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-4 py-2">
                      <Link href={`/quick-pay?customer=${c.id}`} className="font-medium hover:text-brand hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 capitalize text-ink-muted">{c.segment.toLowerCase()}</td>
                    <td className="px-4 py-2 text-right font-medium">
                      <Link href={`/quick-pay?customer=${c.id}`} className="hover:text-brand">
                        {formatCurrency(c.balance)}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Accounts payable" subtitle="Open supplier balances" bodyClassName="p-0">
          {data.creditors.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-muted">No outstanding payables.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs uppercase text-ink-faint">
                <tr>
                  <th className="px-4 py-2 font-medium">Supplier</th>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.creditors.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-4 py-2">
                      <Link href={`/purchasing?pay=${s.id}`} className="font-medium hover:text-brand hover:underline">
                        {s.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-ink-muted">{s.category}</td>
                    <td className="px-4 py-2 text-right font-medium">
                      <Link href={`/purchasing?pay=${s.id}`} className="hover:text-brand">
                        {formatCurrency(s.balance)}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Trial balance" subtitle="Chart of accounts" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-surface text-xs uppercase text-ink-faint">
                <tr>
                  <th className="px-4 py-2 font-medium">Code</th>
                  <th className="px-4 py-2 font-medium">Account</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.trialBalance.map((a) => (
                  <tr key={a.code} className="border-t border-border">
                    <td className="px-4 py-2 font-mono text-xs">{a.code}</td>
                    <td className="px-4 py-2">{a.name}</td>
                    <td className="px-4 py-2 capitalize text-ink-muted">{a.type.toLowerCase()}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatCurrency(a.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
