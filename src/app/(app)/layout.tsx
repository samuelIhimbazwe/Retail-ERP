"use client";

import { useMemo, useState } from "react";
import { useAppSession } from "@/components/providers";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { navigation } from "@/lib/navigation";
import { navigationForRole } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useAppSession();
  const nav = useMemo(
    () => navigationForRole(session?.user?.role ?? "CASHIER", navigation),
    [session?.user?.role],
  );

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[var(--sidebar-width)] bg-sidebar shadow-[var(--shadow-lg)]">
            <div className="flex h-[var(--topbar-height)] items-center justify-between border-b border-border px-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand text-sm font-bold text-white">
                  R
                </div>
                <p className="text-[15px] font-semibold text-ink">RBIAP</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-full p-1.5 text-ink-faint hover:bg-surface-sunken"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="h-[calc(100%-var(--topbar-height))] overflow-y-auto px-3 py-3">
              {nav.map((group) => (
                <div key={group.title} className="mb-5">
                  <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                    {group.title}
                  </p>
                  <ul className="space-y-1">
                    {group.items.map((item) => {
                      const active = pathname === item.href;
                      const Icon = item.icon;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              "flex items-center gap-3 rounded-full px-3 py-2.5 text-[13px] font-medium",
                              active
                                ? "bg-brand text-white shadow-[var(--shadow-sm)]"
                                : "text-ink-muted hover:bg-sidebar-hover hover:text-ink",
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main className="app-canvas min-h-0 flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
