"use client";

import Link from "next/link";
import { rushActions } from "@/lib/rush-actions";
import { cn } from "@/lib/utils";
import { Clock, Phone } from "lucide-react";

const tones = {
  brand: "bg-brand text-white hover:bg-brand-deep active:scale-[0.98]",
  info: "bg-info text-white hover:bg-[#155a74] active:scale-[0.98]",
  accent: "bg-accent text-white hover:bg-[#a34a1c] active:scale-[0.98]",
  warn: "bg-warn text-white hover:bg-[#92400e] active:scale-[0.98]",
};

export function CounterClient({ businessName }: { businessName: string }) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-4xl flex-col justify-center">
      <div className="mb-6 text-center sm:mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-faint">Counter mode</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          What do you need?
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          {businessName} · Big taps · Under 1 minute · Usable on a call
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-xs text-ink-faint">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Rush actions only
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" /> One hand OK
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        {rushActions.map((a, i) => (
          <Link
            key={a.id}
            href={a.href}
            className={cn(
              "flex min-h-[140px] flex-col justify-between rounded-2xl p-5 shadow-[var(--shadow)] transition sm:min-h-[160px] sm:p-6",
              tones[a.tone],
            )}
          >
            <div className="flex items-start justify-between">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
                {i + 1}
              </span>
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide">
                ≤ 1 min
              </span>
            </div>
            <div>
              <p className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{a.title}</p>
              <p className="mt-1 text-sm text-white/85">{a.subtitle}</p>
              <p className="mt-2 text-xs text-white/65">{a.hint}</p>
            </div>
          </Link>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-ink-faint">
        Quiet-time tools (reports, accounting, settings) stay in the sidebar — not during the queue.
      </p>
    </div>
  );
}
