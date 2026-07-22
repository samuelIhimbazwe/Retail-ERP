import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-ink sm:text-[24px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-2xl text-[13px] text-ink-muted">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[var(--radius-lg)] border border-border/80 bg-surface-raised shadow-[var(--shadow)]",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex min-h-12 items-center justify-between gap-3 border-b border-border/70 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="truncate text-[14px] font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="truncate text-[12px] text-ink-faint">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </header>
      )}
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "accent";
  size?: "sm" | "md" | "lg";
}) {
  const variants = {
    primary: "bg-brand text-white hover:bg-brand-deep shadow-[var(--shadow-sm)]",
    secondary:
      "border border-border bg-surface-raised text-ink hover:bg-surface shadow-[var(--shadow-sm)]",
    ghost: "text-ink-muted hover:bg-surface-sunken hover:text-ink",
    danger: "bg-danger text-white hover:brightness-95",
    accent: "bg-accent text-white hover:brightness-95",
  };
  const sizes = {
    sm: "h-8 px-3 text-[12px]",
    md: "h-10 px-4 text-[13px]",
    lg: "h-11 px-5 text-[14px]",
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-2xl border border-border bg-surface-sunken/60 px-3.5 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-brand focus:bg-surface-raised focus:ring-4 focus:ring-brand/10",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 rounded-2xl border border-border bg-surface-sunken/60 px-3.5 text-[13px] text-ink outline-none focus:border-brand focus:bg-surface-raised focus:ring-4 focus:ring-brand/10",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

/** ERP-style filter / action toolbar strip */
export function ControlPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border border-border/80 bg-surface-raised px-4 py-3 shadow-[var(--shadow-sm)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
