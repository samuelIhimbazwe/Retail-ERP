import Link from "next/link";
import { getTaxData } from "@/lib/actions";
import { REPORT_PERIODS, isReportPeriodId } from "@/lib/report-periods";
import { PageHeader, Panel } from "@/components/ui/primitives";
import { formatCurrency, cn } from "@/lib/utils";
import { TaxExportMenu } from "@/components/tax-export-menu";

export default async function TaxPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const period = isReportPeriodId(params.period) ? params.period : "this_month";
  const data = await getTaxData(period);
  const ratePct = data.catalog.ratePct;

  return (
    <div>
      <PageHeader
        title="Tax Management"
        description={`Output VAT and taxable sales for ${data.periodLabel}. Ledger payable is cumulative.`}
        actions={<TaxExportMenu period={data.period} shortLabel={data.shortLabel} />}
      />

      <div className="mb-5 flex flex-wrap gap-1.5 rounded-[var(--radius)] border border-border bg-surface-raised p-1.5">
        {REPORT_PERIODS.map((p) => {
          const active = p.id === data.period;
          return (
            <Link
              key={p.id}
              href={`/tax?period=${p.id}`}
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { l: "Output VAT", v: formatCurrency(data.outputVat), h: data.shortLabel },
          { l: "Taxable net sales", v: formatCurrency(data.taxableNet), h: `Eff. ${data.effectiveRate}%` },
          { l: "VAT payable (ledger)", v: formatCurrency(data.ledgerPayable), h: "Account 2100" },
          { l: "Tickets", v: String(data.salesCount), h: `Gross ${formatCurrency(data.grossSales)}` },
        ].map((x) => (
          <div key={x.l} className="rounded-[var(--radius)] border border-border bg-surface-raised p-4">
            <p className="text-xs uppercase tracking-wide text-ink-faint">{x.l}</p>
            <p className="mt-1 font-display text-xl font-semibold">{x.v}</p>
            <p className="mt-0.5 text-xs text-ink-muted">{x.h}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { l: "Net sales (ex VAT)", v: formatCurrency(data.netSales) },
          { l: "Exempt net", v: formatCurrency(data.exemptNet) },
          { l: "Zero-rated net", v: formatCurrency(data.zeroRatedNet) },
          { l: "Input VAT (ledger)", v: formatCurrency(data.inputVat) },
        ].map((x) => (
          <div key={x.l} className="rounded-[var(--radius)] border border-border bg-surface px-4 py-3">
            <p className="text-xs text-ink-faint">{x.l}</p>
            <p className="mt-0.5 text-lg font-semibold">{x.v}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Tax categories (catalog)" subtitle="Product tax setup">
          <ul className="space-y-2 text-sm">
            {[
              ["Standard VAT", `${ratePct}%`, `${data.catalog.standard} SKUs`],
              ["Zero-rated", "0%", `${data.catalog.zeroRated} SKUs`],
              ["Exempt", "—", `${data.catalog.exempt} SKUs`],
            ].map(([n, r, c]) => (
              <li key={n} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span>
                  {n}
                  <span className="ml-2 text-xs text-ink-faint">{c}</span>
                </span>
                <span className="font-medium text-brand">{r}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-faint">
            Change rates on Products ·{" "}
            <Link href="/products" className="text-brand hover:underline">
              Open catalog
            </Link>
          </p>
        </Panel>

        <Panel title="Compliance" subtitle="Filing">
          <div className="rounded-xl border border-warn/30 bg-warn-soft/50 p-4">
            <p className="text-sm font-semibold text-warn">VAT filing reminder</p>
            <p className="mt-1 text-xs text-ink-muted">{data.filingHint}</p>
            <p className="mt-2 text-xs text-ink-muted">
              Period output VAT <strong>{formatCurrency(data.outputVat)}</strong> · Ledger payable{" "}
              <strong>{formatCurrency(data.ledgerPayable)}</strong>
              {data.discounts > 0 ? ` · Discounts ${formatCurrency(data.discounts)}` : ""}
            </p>
          </div>
          <p className="mt-3 text-xs text-ink-faint">
            Journals ·{" "}
            <Link href="/accounting" className="text-brand hover:underline">
              Accounting
            </Link>{" "}
            ·{" "}
            <Link href={`/reports?period=${data.period}`} className="text-brand hover:underline">
              Full reports
            </Link>
          </p>
        </Panel>
      </div>

      <Panel title="Daily VAT" subtitle={data.shortLabel} className="mt-4" bodyClassName="p-0">
        {data.daily.every((d) => d.tickets === 0) ? (
          <p className="px-4 py-8 text-center text-sm text-ink-muted">No taxable activity in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-surface text-xs uppercase text-ink-faint">
                <tr>
                  <th className="px-4 py-2 font-medium">Day</th>
                  <th className="px-4 py-2 text-right font-medium">Tickets</th>
                  <th className="px-4 py-2 text-right font-medium">Net sales</th>
                  <th className="px-4 py-2 text-right font-medium">Output VAT</th>
                </tr>
              </thead>
              <tbody>
                {data.daily
                  .filter((d) => d.tickets > 0)
                  .map((d) => (
                    <tr key={d.date} className="border-t border-border">
                      <td className="px-4 py-2.5">{d.label}</td>
                      <td className="px-4 py-2.5 text-right">{d.tickets}</td>
                      <td className="px-4 py-2.5 text-right">{formatCurrency(d.netSales)}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(d.outputVat)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="VAT sales register"
        subtitle={`${data.register.length} of ${data.salesCount} tickets`}
        className="mt-4"
        bodyClassName="p-0"
      >
        {data.register.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-muted">No sales in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-surface text-xs uppercase text-ink-faint">
                <tr>
                  <th className="px-4 py-2 font-medium">Ticket</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Customer</th>
                  <th className="px-4 py-2 text-right font-medium">Net</th>
                  <th className="px-4 py-2 text-right font-medium">VAT</th>
                  <th className="px-4 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.register.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-4 py-2.5 font-mono text-xs">{s.number}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-ink-muted">
                      {s.date} {s.time}
                    </td>
                    <td className="px-4 py-2.5">
                      {s.customer}
                      <p className="text-[11px] text-ink-faint">{s.cashier}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right">{formatCurrency(s.net)}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(s.tax)}</td>
                    <td className="px-4 py-2.5 text-right">{formatCurrency(s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
