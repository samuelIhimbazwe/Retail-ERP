"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppSession } from "@/components/providers";
import { navigation } from "@/lib/navigation";
import { navigationForRole } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { ChevronLeft, PanelLeftClose, PanelLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const COLLAPSE_KEY = "rbiap.sidebar.collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useAppSession();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const businessName = session?.user?.businessName ?? "Your business";
  const branchName = session?.user?.branchName ?? "No branch";

  const nav = useMemo(
    () => navigationForRole(session?.user?.role ?? "CASHIER", navigation),
    [session?.user?.role],
  );

  return (
    <aside
      className={cn(
        "relative flex h-full shrink-0 flex-col border-r border-border bg-sidebar text-ink transition-[width] duration-200",
        collapsed ? "w-[var(--sidebar-collapsed)]" : "w-[var(--sidebar-width)]",
      )}
    >
      <div
        className={cn(
          "flex h-[var(--topbar-height)] shrink-0 items-center gap-3 px-4",
          collapsed && "justify-center px-2",
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-brand text-sm font-bold tracking-tight text-white shadow-[var(--shadow-sm)]">
          R
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold leading-tight tracking-tight text-ink">
              RBIAP
            </p>
            <p className="truncate text-[11px] text-ink-faint">Retail ERP</p>
          </div>
        )}
        {!collapsed && (
          <button
            type="button"
            onClick={toggle}
            className="rounded-full p-1.5 text-ink-faint hover:bg-surface-sunken hover:text-ink"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 py-2">
        {nav.map((group) => (
          <div key={group.title} className="mb-5">
            {!collapsed && (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                {group.title}
              </p>
            )}
            {collapsed && <div className="mx-3 mb-2 border-t border-border" />}
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={item.label}
                      className={cn(
                        "flex items-center gap-3 rounded-full px-3 py-2.5 text-[13px] font-medium transition-colors",
                        collapsed && "justify-center px-2",
                        active
                          ? "bg-brand text-white shadow-[var(--shadow-sm)]"
                          : "text-ink-muted hover:bg-sidebar-hover hover:text-ink",
                      )}
                    >
                      <Icon className={cn("h-4 w-4 shrink-0", active ? "opacity-100" : "opacity-70")} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn("shrink-0 border-t border-border p-3", collapsed && "px-2")}>
        {!collapsed ? (
          <div className="rounded-2xl bg-brand-soft/70 px-3 py-2.5">
            <p className="truncate text-[12px] font-semibold leading-tight text-brand-deep">
              {businessName}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-ink-faint">{branchName}</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={toggle}
            className="mx-auto flex h-9 w-9 items-center justify-center rounded-full text-ink-faint hover:bg-surface-sunken hover:text-ink"
            aria-label="Expand sidebar"
            title="Expand"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        )}
        {!collapsed && (
          <button
            type="button"
            onClick={toggle}
            className="mt-2 flex w-full items-center justify-center gap-1 rounded-full py-1.5 text-[11px] text-ink-faint hover:bg-surface-sunken hover:text-ink-muted"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Collapse
          </button>
        )}
      </div>
    </aside>
  );
}
