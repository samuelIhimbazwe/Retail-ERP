"use client";

import { Menu, Zap } from "lucide-react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { GlobalSearch } from "@/components/global-search";
import { NotificationsBell } from "@/components/notifications-bell";

const rushLinks = [
  { href: "/counter", label: "Counter" },
  { href: "/pos", label: "Sell" },
  { href: "/stock-check", label: "Stock" },
  { href: "/receive", label: "Receive" },
];

export function Topbar({ onMenu }: { onMenu?: () => void }) {
  const { data: session } = useSession();

  const name = session?.user?.name ?? "User";
  const role = session?.user?.role ?? "";
  const businessName = session?.user?.businessName;
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-surface-raised/90 px-3 backdrop-blur-md sm:gap-3 sm:px-4">
      <button
        type="button"
        className="rounded-lg p-2 text-ink-muted hover:bg-surface-sunken lg:hidden"
        onClick={onMenu}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <Link
        href="/counter"
        className="hidden items-center gap-1.5 rounded-lg bg-brand px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-deep sm:inline-flex"
      >
        <Zap className="h-3.5 w-3.5" />
        Counter
      </Link>

      <nav className="hidden items-center gap-1 md:flex">
        {rushLinks.slice(1).map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:bg-surface-sunken hover:text-ink"
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <div className="mx-1 min-w-0 flex-1 sm:mx-2 md:max-w-md lg:max-w-lg">
        <GlobalSearch />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {businessName && (
          <p
            className="hidden max-w-[140px] truncate text-xs font-medium text-ink-muted xl:block"
            title={businessName}
          >
            {businessName}
          </p>
        )}

        <NotificationsBell />

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 rounded-lg border border-border py-1 pl-1 pr-2.5 hover:bg-surface-sunken"
          title="Sign out"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-[11px] font-bold text-white">
            {initials}
          </div>
          <div className="hidden text-left leading-tight sm:block">
            <p className="text-xs font-semibold text-ink">{name}</p>
            <p className="text-[10px] text-ink-faint">{role}</p>
          </div>
        </button>
      </div>
    </header>
  );
}
