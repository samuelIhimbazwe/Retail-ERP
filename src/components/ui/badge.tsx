import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warn" | "danger" | "info" | "brand";

const variants: Record<BadgeVariant, string> = {
  default: "bg-surface-sunken text-ink-muted",
  success: "bg-success-soft text-success",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  brand: "bg-brand-soft text-brand-deep",
};

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function statusBadge(status: string): BadgeVariant {
  const s = status.toLowerCase();
  if (["active", "posted", "paid", "received", "clocked in"].some((x) => s.includes(x))) return "success";
  if (["low", "pending", "partial", "expiring"].some((x) => s.includes(x))) return "warn";
  if (["out", "overdue", "danger", "failed"].some((x) => s.includes(x))) return "danger";
  if (["vip", "approval"].some((x) => s.includes(x))) return "brand";
  return "info";
}
