"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { navigation } from "@/lib/navigation";
import { navigationForRole } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);

  const businessName = session?.user?.businessName ?? "Your business";
  const branchName = session?.user?.branchName ?? "No branch";
  const initials = (session?.user?.name ?? "U")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const nav = useMemo(
    () => navigationForRole(session?.user?.role ?? "CASHIER", navigation),
    [session?.user?.role],
  );

  return (
    <aside
      className={cn(
        "relative flex h-full shrink-0 flex-col bg-sidebar text-white transition-all duration-300",
        collapsed ? "w-[72px]" : "w-[260px]",
      )}
    >
      <div className={cn("flex items-center gap-3 border-b border-white/10 px-4 py-4", collapsed && "justify-center px-2")}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand font-display text-sm font-bold">
          R
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate font-display text-base font-semibold tracking-tight">RBIAP</p>
            <p className="truncate text-[10px] uppercase tracking-wider text-white/45">Business OS</p>
          </div>
        )}
      </div>

      <nav className="sidebar-scroll flex-1 overflow-y-auto px-2 py-3">
        {nav.map((group) => (
          <div key={group.title} className="mb-4">
            {!collapsed && (
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                {group.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={item.label}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                        collapsed && "justify-center px-2",
                        active
                          ? "bg-brand text-white"
                          : "text-white/70 hover:bg-sidebar-hover hover:text-white",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn("border-t border-white/10 p-3", collapsed && "px-2")}>
        {!collapsed ? (
          <div className="rounded-lg bg-white/5 px-3 py-2.5">
            <p className="truncate text-xs font-medium">{businessName}</p>
            <p className="truncate text-[10px] text-white/45">{branchName}</p>
          </div>
        ) : (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-brand text-[10px] font-bold">
            {initials}
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-xs text-white/50 hover:bg-white/5 hover:text-white"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /> Collapse</>}
        </button>
      </div>
    </aside>
  );
}
