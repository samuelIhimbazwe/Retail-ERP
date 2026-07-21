"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { globalSearch, type GlobalSearchHit } from "@/lib/actions";
import { allModules } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import {
  Building2,
  FileText,
  Package,
  Receipt,
  Search,
  ShoppingCart,
  Truck,
  UserRound,
  Users,
} from "lucide-react";

const CATEGORY_ICON: Record<GlobalSearchHit["category"], typeof Search> = {
  Pages: FileText,
  Products: Package,
  Customers: Users,
  Suppliers: Truck,
  "Purchase orders": ShoppingCart,
  Sales: Receipt,
  Users: UserRound,
};

const SUGGESTIONS: GlobalSearchHit[] = allModules.slice(0, 8).map((m) => ({
  id: `suggest-${m.href}`,
  category: "Pages",
  title: m.label,
  subtitle: m.href,
  href: m.href,
}));

function flattenGrouped(hits: GlobalSearchHit[]) {
  const order: GlobalSearchHit["category"][] = [
    "Pages",
    "Products",
    "Customers",
    "Suppliers",
    "Purchase orders",
    "Sales",
    "Users",
  ];
  const grouped = new Map<GlobalSearchHit["category"], GlobalSearchHit[]>();
  for (const h of hits) {
    const list = grouped.get(h.category) ?? [];
    list.push(h);
    grouped.set(h.category, list);
  }
  return order.flatMap((cat) => grouped.get(cat) ?? []);
}

export function GlobalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GlobalSearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [pending, startTransition] = useTransition();

  const results = useMemo(() => {
    if (!query.trim()) return SUGGESTIONS;
    return flattenGrouped(hits);
  }, [query, hits]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isPalette = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isPalette) {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHits([]);
    setActive(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setHits([]);
      setActive(0);
      return;
    }
    const handle = window.setTimeout(() => {
      startTransition(async () => {
        try {
          const data = await globalSearch(q);
          setHits(data);
          setActive(0);
        } catch {
          setHits([]);
        }
      });
    }, 180);
    return () => window.clearTimeout(handle);
  }, [query, open]);

  function go(hit: GlobalSearchHit) {
    setOpen(false);
    router.push(hit.href);
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active]);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-left text-ink-muted hover:border-border-strong hover:bg-surface-sunken sm:min-w-[200px] lg:min-w-[260px]"
        aria-label="Open global search"
      >
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden flex-1 truncate text-xs sm:inline">Search products, customers…</span>
        <kbd className="hidden rounded border border-border bg-surface-raised px-1.5 py-0.5 text-[10px] font-medium text-ink-faint md:inline">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-3 pt-[12vh] sm:pt-[15vh]">
          <button
            type="button"
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            aria-label="Close search"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Global search"
            className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-[var(--shadow-lg)]"
          >
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="h-4 w-4 shrink-0 text-ink-faint" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKey}
                placeholder="Search pages, products, customers, POs…"
                className="h-12 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
                autoComplete="off"
                spellCheck={false}
              />
              {pending && <span className="text-[10px] text-ink-faint">Searching…</span>}
              <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-ink-faint">
                Esc
              </kbd>
            </div>

            <div className="max-h-[min(60vh,420px)] overflow-y-auto py-2">
              {results.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-ink-muted">
                  {query.trim() ? "No matches" : "Type to search the business"}
                </p>
              ) : (
                <>
                  {!query.trim() && (
                    <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                      Jump to
                    </p>
                  )}
                  {results.map((hit, i) => {
                    const Icon = CATEGORY_ICON[hit.category] ?? Building2;
                    const showHeading =
                      query.trim() &&
                      (i === 0 || results[i - 1]?.category !== hit.category);
                    return (
                      <div key={hit.id}>
                        {showHeading && (
                          <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                            {hit.category}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => go(hit)}
                          onMouseEnter={() => setActive(i)}
                          className={cn(
                            "flex w-full items-center gap-3 px-4 py-2.5 text-left",
                            i === active ? "bg-brand-soft/70" : "hover:bg-surface",
                          )}
                        >
                          <div
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                              i === active ? "bg-brand text-white" : "bg-surface-sunken text-ink-muted",
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-ink">{hit.title}</p>
                            <p className="truncate text-xs text-ink-faint">{hit.subtitle}</p>
                          </div>
                          <span className="hidden shrink-0 text-[10px] text-ink-faint sm:inline">
                            {hit.category}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[10px] text-ink-faint">
              <span>↑↓ navigate</span>
              <span>↵ open</span>
              <span className="ml-auto">Ctrl / ⌘ K</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
