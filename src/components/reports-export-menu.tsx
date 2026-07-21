"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { downloadCsv, toCsv } from "@/lib/csv";
import { getInventoryExportRows, getSalesExportRows } from "@/lib/actions";

type ReportsExportData = {
  periodLabel: string;
  shortLabel: string;
  incomeStatement: { label: string; amount: number }[];
  trialBalance: { code: string; name: string; type: string; balance: number }[];
  topProducts: {
    name: string;
    sku: string;
    category: string;
    qty: number;
    sales: number;
    cogs: number;
    profit: number;
    margin: number;
  }[];
  categories: { category: string; qty: number; sales: number }[];
  cashiers: { name: string; tickets: number; sales: number; profit: number }[];
  paymentMix: { method: string; amount: number }[];
  salesRegister: {
    number: string;
    date: string;
    time: string;
    cashier: string;
    customer: string;
    method: string;
    items: number;
    subtotal: number;
    tax: number;
    total: number;
  }[];
  purchases: {
    number: string;
    supplier: string;
    date: string;
    status: string;
    lines: number;
    total: number;
  }[];
};

function slug(s: string) {
  return s.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-_]/g, "").toLowerCase() || "period";
}

export function ReportsExportMenu({
  period,
  data,
}: {
  period: string;
  data: ReportsExportData;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const tag = slug(data.shortLabel);

  function exportTrial() {
    const csv = toCsv(
      ["Code", "Account", "Type", "Balance"],
      data.trialBalance.map((a) => [a.code, a.name, a.type, a.balance]),
    );
    downloadCsv(`rbiap-trial-balance.csv`, csv);
    setOpen(false);
  }

  function exportPl() {
    const csv = toCsv(
      ["Line", "Amount", "Period"],
      data.incomeStatement.map((r) => [r.label, r.amount, data.periodLabel]),
    );
    downloadCsv(`rbiap-income-statement-${tag}.csv`, csv);
    setOpen(false);
  }

  function exportProducts() {
    const csv = toCsv(
      ["Product", "SKU", "Category", "Qty", "Sales", "COGS", "Profit", "Margin %"],
      data.topProducts.map((p) => [
        p.name,
        p.sku,
        p.category,
        p.qty,
        p.sales,
        p.cogs,
        p.profit,
        p.margin,
      ]),
    );
    downloadCsv(`rbiap-product-sales-${tag}.csv`, csv);
    setOpen(false);
  }

  function exportCategories() {
    const csv = toCsv(
      ["Category", "Qty", "Sales"],
      data.categories.map((c) => [c.category, c.qty, c.sales]),
    );
    downloadCsv(`rbiap-categories-${tag}.csv`, csv);
    setOpen(false);
  }

  function exportCashiers() {
    const csv = toCsv(
      ["Cashier", "Tickets", "Sales", "Profit"],
      data.cashiers.map((c) => [c.name, c.tickets, c.sales, c.profit]),
    );
    downloadCsv(`rbiap-cashiers-${tag}.csv`, csv);
    setOpen(false);
  }

  function exportPayments() {
    const csv = toCsv(
      ["Method", "Amount"],
      data.paymentMix.map((p) => [p.method, p.amount]),
    );
    downloadCsv(`rbiap-payment-mix-${tag}.csv`, csv);
    setOpen(false);
  }

  function exportRegister() {
    const csv = toCsv(
      ["Number", "Date", "Time", "Cashier", "Customer", "Method", "Items", "Subtotal", "Tax", "Total"],
      data.salesRegister.map((r) => [
        r.number,
        r.date,
        r.time,
        r.cashier,
        r.customer,
        r.method,
        r.items,
        r.subtotal,
        r.tax,
        r.total,
      ]),
    );
    downloadCsv(`rbiap-sales-register-${tag}.csv`, csv);
    setOpen(false);
  }

  function exportPurchases() {
    const csv = toCsv(
      ["PO", "Supplier", "Date", "Status", "Lines", "Total"],
      data.purchases.map((p) => [p.number, p.supplier, p.date, p.status, p.lines, p.total]),
    );
    downloadCsv(`rbiap-purchases-${tag}.csv`, csv);
    setOpen(false);
  }

  function exportSales() {
    startTransition(async () => {
      const rows = await getSalesExportRows(period);
      const csv = toCsv(
        ["Number", "Date", "Time", "Cashier", "Customer", "Method", "Subtotal", "Tax", "Total"],
        rows.map((r) => [
          r.number,
          r.date,
          r.time,
          r.cashier,
          r.customer,
          r.method,
          r.subtotal,
          r.tax,
          r.total,
        ]),
      );
      downloadCsv(`rbiap-sales-${tag}.csv`, csv);
      setOpen(false);
    });
  }

  function exportInventory() {
    startTransition(async () => {
      const rows = await getInventoryExportRows();
      const csv = toCsv(
        ["SKU", "Name", "Category", "Stock", "Min", "Unit", "Cost", "Sell", "Value", "Status"],
        rows.map((r) => [
          r.sku,
          r.name,
          r.category,
          r.stock,
          r.min,
          r.unit,
          r.cost,
          r.sell,
          r.value,
          r.status,
        ]),
      );
      downloadCsv("rbiap-inventory.csv", csv);
      setOpen(false);
    });
  }

  return (
    <div className="relative">
      <Button size="sm" onClick={() => setOpen((o) => !o)} disabled={pending}>
        <Download className="h-4 w-4" />
        {pending ? "Exporting…" : "Export CSV"}
      </Button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 max-h-80 w-56 overflow-y-auto rounded-xl border border-border bg-surface-raised shadow-[var(--shadow-lg)]">
          {[
            { label: "Income statement", fn: exportPl },
            { label: "Sales register", fn: exportRegister },
            { label: "Sales (full period)", fn: exportSales },
            { label: "Product profitability", fn: exportProducts },
            { label: "Categories", fn: exportCategories },
            { label: "Cashiers", fn: exportCashiers },
            { label: "Payment mix", fn: exportPayments },
            { label: "Purchases", fn: exportPurchases },
            { label: "Trial balance", fn: exportTrial },
            { label: "Inventory valuation", fn: exportInventory },
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
