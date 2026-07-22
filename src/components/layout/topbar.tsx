"use client";

import { LogOut, Menu, Settings, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { GlobalSearch } from "@/components/global-search";
import { NotificationsBell } from "@/components/notifications-bell";
import { cn } from "@/lib/utils";

const rushLinks = [
  { href: "/counter", label: "Counter" },
  { href: "/pos", label: "Sell" },
  { href: "/stock-check", label: "Stock" },
  { href: "/receive", label: "Receive" },
];

export function Topbar({ onMenu }: { onMenu?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  const name = session?.user?.name ?? "User";
  const role = session?.user?.role ?? "";
  const businessName = session?.user?.businessName;
  const firstName = name.split(" ")[0] ?? name;
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-[var(--topbar-height)] shrink-0 items-center gap-3 border-b border-border/80 bg-surface/90 px-3 backdrop-blur-md sm:gap-4 sm:px-5">
      <button
        type="button"
        className="rounded-full p-2 text-ink-muted hover:bg-surface-raised hover:text-ink lg:hidden"
        onClick={onMenu}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="min-w-0">
        <h1 className="truncate text-[17px] font-semibold tracking-tight text-ink sm:text-[19px]">
          Welcome, {firstName}
        </h1>
        <p className="hidden truncate text-[12px] text-ink-faint sm:block">
          {businessName ? `${businessName} · ` : ""}
          {role ? role.replaceAll("_", " ") : "Workspace"}
        </p>
      </div>

      <div className="ml-1 hidden items-center gap-1 lg:flex">
        <Link
          href="/counter"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition",
            pathname === "/counter"
              ? "bg-brand text-white shadow-[var(--shadow-sm)]"
              : "bg-surface-raised text-ink-muted hover:text-ink",
          )}
        >
          <Zap className="h-3 w-3" />
          Counter
        </Link>
        {rushLinks.slice(1).map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "rounded-full px-3 py-1.5 text-[12px] font-medium transition",
              pathname === l.href
                ? "bg-brand-soft font-semibold text-brand-deep"
                : "text-ink-muted hover:bg-surface-raised hover:text-ink",
            )}
          >
            {l.label}
          </Link>
        ))}
      </div>

      <div className="mx-auto min-w-0 w-full max-w-md flex-1 px-1">
        <GlobalSearch />
      </div>

      <div className="relative ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        <Link
          href="/settings"
          className="hidden h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-raised text-ink-muted shadow-[var(--shadow-sm)] transition hover:text-ink sm:flex"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </Link>

        <NotificationsBell />

        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="flex h-10 items-center gap-2 rounded-full border border-border bg-surface-raised py-0.5 pl-0.5 pr-1.5 shadow-[var(--shadow-sm)] hover:bg-white sm:pr-2.5"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">
            {initials}
          </div>
          <div className="hidden text-left leading-tight sm:block">
            <p className="max-w-[110px] truncate text-[12px] font-semibold text-ink">{name}</p>
          </div>
        </button>

        {menuOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-30 cursor-default"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            />
            <div
              role="menu"
              className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface-raised py-1.5 shadow-[var(--shadow-lg)]"
            >
              <div className="border-b border-border px-4 py-3">
                <p className="truncate text-[13px] font-semibold">{name}</p>
                <p className="truncate text-[11px] text-ink-faint">{session?.user?.email}</p>
              </div>
              <Link
                href="/settings"
                role="menuitem"
                className="block px-4 py-2.5 text-[13px] text-ink hover:bg-surface"
                onClick={() => setMenuOpen(false)}
              >
                Settings
              </Link>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] text-danger hover:bg-danger-soft"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
