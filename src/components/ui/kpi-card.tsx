import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";

export function KpiCard({
  label,
  value,
  change,
  icon: Icon,
  tone = "brand",
  currency,
  className,
}: {
  label: string;
  value: string | number;
  change?: number;
  icon: LucideIcon;
  tone?: "brand" | "accent" | "info" | "warn";
  currency?: boolean;
  className?: string;
}) {
  const tones = {
    brand: "bg-brand-soft text-brand",
    accent: "bg-accent-soft text-accent",
    info: "bg-info-soft text-info",
    warn: "bg-warn-soft text-warn",
  };

  const display = typeof value === "number" && currency ? formatCurrency(value) : value;

  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-border/80 bg-surface-raised p-4 shadow-[var(--shadow)] sm:p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
            {label}
          </p>
          <p className="mt-2 truncate text-[24px] font-semibold leading-none tracking-tight text-ink">
            {display}
          </p>
          {change !== undefined && (
            <p
              className={cn(
                "mt-2 flex items-center gap-1 text-[12px] font-medium",
                change >= 0 ? "text-success" : "text-danger",
              )}
            >
              {change >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              {formatPercent(change)} vs yesterday
            </p>
          )}
        </div>
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
            tones[tone],
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
