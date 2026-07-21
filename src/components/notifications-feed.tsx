"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  Eye,
  EyeOff,
  ExternalLink,
  X,
} from "lucide-react";
import type { AppNotification } from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/kpi-card";
import { Button, Panel } from "@/components/ui/primitives";
import {
  clearAllNotificationPrefs,
  dismissNotifications,
  loadNotificationPrefs,
  markNotificationsRead,
  restoreNotifications,
  type NotificationPrefs,
} from "@/lib/notification-prefs";
import { cn } from "@/lib/utils";

const FILTERS = ["All", "Unread", "Critical", "Stock", "Approvals", "Tax", "Payments", "AI", "Cash"] as const;

const typeFilter: Partial<Record<(typeof FILTERS)[number], AppNotification["type"]>> = {
  Stock: "stock",
  Approvals: "approval",
  Tax: "tax",
  Payments: "payment",
  AI: "ai",
  Cash: "cash",
};

const badgeVariant: Record<AppNotification["type"], "warn" | "info" | "danger" | "brand" | "success" | "default"> = {
  stock: "warn",
  approval: "info",
  tax: "danger",
  payment: "brand",
  ai: "success",
  cash: "default",
};

const severityDot: Record<AppNotification["severity"], string> = {
  critical: "bg-danger",
  warn: "bg-warn",
  info: "bg-info",
};

function applyPrefs(items: AppNotification[], prefs: NotificationPrefs) {
  const read = new Set(prefs.read);
  const dismissed = new Set(prefs.dismissed);
  return items.map((n) => ({
    ...n,
    unread: n.unread && !read.has(n.id),
    dismissed: dismissed.has(n.id),
  }));
}

export function NotificationsFeed({ items }: { items: AppNotification[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [prefs, setPrefs] = useState<NotificationPrefs>({ read: [], dismissed: [] });
  const [showDismissed, setShowDismissed] = useState(false);

  useEffect(() => {
    const sync = () => setPrefs(loadNotificationPrefs());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("rbiap:notification-prefs", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("rbiap:notification-prefs", sync);
    };
  }, []);

  const enriched = useMemo(() => applyPrefs(items, prefs), [items, prefs]);

  const active = useMemo(
    () => enriched.filter((n) => (showDismissed ? n.dismissed : !n.dismissed)),
    [enriched, showDismissed],
  );

  const filtered = useMemo(() => {
    if (filter === "Unread") return active.filter((n) => n.unread);
    if (filter === "Critical") return active.filter((n) => n.severity === "critical");
    const t = typeFilter[filter];
    return t ? active.filter((n) => n.type === t) : active;
  }, [filter, active]);

  const unread = enriched.filter((n) => !n.dismissed && n.unread).length;
  const critical = enriched.filter((n) => !n.dismissed && n.severity === "critical").length;
  const dismissedCount = enriched.filter((n) => n.dismissed).length;
  const liveCount = enriched.filter((n) => !n.dismissed).length;

  function refresh() {
    setPrefs(loadNotificationPrefs());
  }

  function markAllRead() {
    markNotificationsRead(enriched.filter((n) => !n.dismissed).map((n) => n.id));
    refresh();
  }

  function dismissAllVisible() {
    dismissNotifications(filtered.map((n) => n.id));
    refresh();
  }

  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Live alerts" value={liveCount} icon={Bell} tone="brand" />
        <KpiCard label="Unread" value={unread} icon={Eye} tone={unread ? "warn" : "info"} />
        <KpiCard
          label="Critical"
          value={critical}
          icon={AlertTriangle}
          tone={critical ? "warn" : "info"}
        />
        <KpiCard label="Dismissed" value={dismissedCount} icon={EyeOff} tone="info" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-lg border px-3 py-1 text-xs font-medium transition-colors",
              filter === f
                ? "border-brand bg-brand text-white"
                : "border-border bg-surface-raised hover:border-brand",
            )}
          >
            {f}
          </button>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setShowDismissed((v) => !v)}
          >
            {showDismissed ? (
              <>
                <Eye className="h-3.5 w-3.5" /> Active
              </>
            ) : (
              <>
                <EyeOff className="h-3.5 w-3.5" /> Dismissed
              </>
            )}
          </Button>
          {!showDismissed && (
            <>
              <Button type="button" variant="secondary" size="sm" onClick={markAllRead} disabled={unread === 0}>
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={dismissAllVisible}
                disabled={filtered.length === 0}
              >
                Dismiss shown
              </Button>
            </>
          )}
          {showDismissed && dismissedCount > 0 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                clearAllNotificationPrefs();
                refresh();
              }}
            >
              Restore all
            </Button>
          )}
        </div>
      </div>

      <Panel
        title={showDismissed ? "Dismissed alerts" : "Live alert feed"}
        subtitle={
          showDismissed
            ? "Hidden until you restore them — underlying issues may still be active"
            : "Derived from stock, POs, debts, cash, and VAT"
        }
        bodyClassName="p-0"
      >
        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-ink-muted">
            {showDismissed ? "No dismissed alerts." : "No alerts in this view."}
          </p>
        ) : (
          <ul>
            {filtered.map((n) => (
              <li
                key={n.id}
                className={cn(
                  "border-b border-border last:border-0",
                  n.unread && "bg-brand-soft/30",
                )}
              >
                <div className="flex items-start gap-3 px-4 py-3">
                  <span
                    className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", severityDot[n.severity])}
                    title={n.severity}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={cn("text-sm", n.unread ? "font-semibold text-ink" : "text-ink-muted")}>
                        {n.title}
                      </p>
                      <Badge variant={badgeVariant[n.type]}>{n.type}</Badge>
                      {n.severity === "critical" && <Badge variant="danger">critical</Badge>}
                    </div>
                    {n.detail && <p className="mt-0.5 text-xs text-ink-muted">{n.detail}</p>}
                    <p className="mt-1 text-xs text-ink-faint">{n.time}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Link href={n.href}>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            markNotificationsRead([n.id]);
                            refresh();
                          }}
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> {n.actionLabel}
                        </Button>
                      </Link>
                      {showDismissed ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            restoreNotifications([n.id]);
                            refresh();
                          }}
                        >
                          Restore
                        </Button>
                      ) : (
                        <>
                          {n.unread && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                markNotificationsRead([n.id]);
                                refresh();
                              }}
                            >
                              Mark read
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              dismissNotifications([n.id]);
                              refresh();
                            }}
                          >
                            <X className="h-3.5 w-3.5" /> Dismiss
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
