import Link from "next/link";
import { getBranchesData } from "@/lib/actions";
import { REPORT_PERIODS, isReportPeriodId } from "@/lib/report-periods";
import { BranchesClient } from "@/components/branches-client";
import { cn } from "@/lib/utils";

export default async function BranchesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const period = isReportPeriodId(params.period) ? params.period : "this_month";
  const data = await getBranchesData(period);

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-1.5 rounded-[var(--radius)] border border-border bg-surface-raised p-1.5">
        {REPORT_PERIODS.map((p) => {
          const active = p.id === data.period;
          return (
            <Link
              key={p.id}
              href={`/branches?period=${p.id}`}
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

      <BranchesClient
        data={{
          branches: data.branches,
          periodLabel: data.periodLabel,
          shortLabel: data.shortLabel,
          groupSales: data.groupSales,
          groupProfit: data.groupProfit,
          groupStock: data.groupStock,
          groupTickets: data.groupTickets,
          lowStock: data.lowStock,
        }}
      />
    </div>
  );
}
