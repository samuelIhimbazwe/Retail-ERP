"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { getNotifications, type AppNotification } from "@/lib/actions";
import {
  loadNotificationPrefs,
  markNotificationsRead,
  type NotificationPrefs,
} from "@/lib/notification-prefs";
import { cn } from "@/lib/utils";

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [prefs, setPrefs] = useState<NotificationPrefs>({ read: [], dismissed: [] });
  const [pending, startTransition] = useTransition();

  function loadPrefs() {
    setPrefs(loadNotificationPrefs());
  }

  function load() {
    startTransition(async () => {
      try {
        const data = await getNotifications();
        setItems(data);
      } catch {
        setItems([]);
      }
      loadPrefs();
    });
  }

  useEffect(() => {
    load();
    const sync = () => loadPrefs();
    window.addEventListener("storage", sync);
    window.addEventListener("rbiap:notification-prefs", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("rbiap:notification-prefs", sync);
    };
  }, []);

  const visible = useMemo(() => {
    const dismissed = new Set(prefs.dismissed);
    const read = new Set(prefs.read);
    return items
      .filter((n) => !dismissed.has(n.id))
      .map((n) => ({ ...n, unread: n.unread && !read.has(n.id) }));
  }, [items, prefs]);

  const unread = visible.filter((n) => n.unread).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        className="relative rounded-lg p-2 text-ink-muted hover:bg-surface-sunken"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-surface-raised shadow-[var(--shadow-lg)]">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-sm font-semibold">
              Notifications{pending ? "…" : ""}
            </p>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
                  onClick={() => {
                    markNotificationsRead(visible.map((n) => n.id));
                    loadPrefs();
                  }}
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Read all
                </button>
              )}
              <Link
                href="/notifications"
                className="text-xs text-brand hover:underline"
                onClick={() => setOpen(false)}
              >
                View all
              </Link>
            </div>
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {visible.length === 0 && (
              <li className="px-3 py-6 text-center text-xs text-ink-muted">
                {pending ? "Loading…" : "No alerts right now"}
              </li>
            )}
            {visible.slice(0, 6).map((n) => (
              <li key={n.id} className="border-b border-border last:border-0 hover:bg-surface">
                <Link
                  href={n.href}
                  className="block px-3 py-2.5"
                  onClick={() => {
                    markNotificationsRead([n.id]);
                    setOpen(false);
                  }}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                        n.severity === "critical"
                          ? "bg-danger"
                          : n.severity === "warn"
                            ? "bg-warn"
                            : "bg-info",
                      )}
                    />
                    <div className="min-w-0">
                      <p className={cn("text-sm", n.unread ? "font-medium text-ink" : "text-ink-muted")}>
                        {n.title}
                      </p>
                      <p className="text-xs text-ink-faint">{n.time}</p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
