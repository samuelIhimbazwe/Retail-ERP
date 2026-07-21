"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { downloadCsv, toCsv } from "@/lib/csv";
import { getTaxExportRows } from "@/lib/actions";

export function TaxExportMenu({
  period,
  shortLabel,
}: {
  period: string;
  shortLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const tag = shortLabel.replace(/\s+/g, "-").toLowerCase();

  function run(kind: "summary" | "register" | "daily") {
    startTransition(async () => {
      const data = await getTaxExportRows(period);
      if (kind === "summary") {
        const csv = toCsv(
          ["Field", "Value"],
          data.summary.map(([k, v]) => [k, v]),
        );
        downloadCsv(`rbiap-vat-summary-${tag}.csv`, csv);
      } else if (kind === "register") {
        const csv = toCsv(
          ["Ticket", "Date", "Time", "Customer", "Cashier", "Net", "VAT", "Total", "Taxable lines", "Exempt lines"],
          data.register.map((r) => [
            r.number,
            r.date,
            r.time,
            r.customer,
            r.cashier,
            r.net,
            r.tax,
            r.total,
            r.taxableLines,
            r.exemptLines,
          ]),
        );
        downloadCsv(`rbiap-vat-register-${tag}.csv`, csv);
      } else {
        const csv = toCsv(
          ["Date", "Tickets", "Net sales", "Output VAT"],
          data.daily.map((d) => [d.date, d.tickets, d.netSales, d.outputVat]),
        );
        downloadCsv(`rbiap-vat-daily-${tag}.csv`, csv);
      }
      setOpen(false);
    });
  }

  return (
    <div className="relative">
      <Button size="sm" onClick={() => setOpen((o) => !o)} disabled={pending}>
        <Download className="h-4 w-4" />
        {pending ? "Exporting…" : "Export VAT report"}
      </Button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-52 overflow-hidden rounded-xl border border-border bg-surface-raised shadow-[var(--shadow-lg)]">
          {[
            { label: "VAT summary", fn: () => run("summary") },
            { label: "Sales VAT register", fn: () => run("register") },
            { label: "Daily VAT totals", fn: () => run("daily") },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.fn}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-surface"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
