"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
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
  const { data: session } = useSession();
  const nav = useMemo(
    () => navigationForRole(session?.user?.role ?? "CASHIER", navigation),
    [session?.user?.role],
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[280px] bg-sidebar">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <div className="min-w-0">
                <p className="font-display text-lg font-semibold text-white">RBIAP</p>
              </div>
              <button type="button" onClick={() => setMobileOpen(false)} className="text-white/70">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="h-[calc(100%-64px)] overflow-y-auto px-2 py-3">
              {nav.map((group) => (
                <div key={group.title} className="mb-4">
                  <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                    {group.title}
                  </p>
                  <ul className="space-y-0.5">
                    {group.items.map((item) => {
                      const active = pathname === item.href;
                      const Icon = item.icon;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm",
                              active ? "bg-brand text-white" : "text-white/70 hover:bg-white/5",
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
        <main className="app-canvas flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
