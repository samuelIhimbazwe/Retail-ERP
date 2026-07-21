"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/kpi-card";
import { Panel, Button, Input } from "@/components/ui/primitives";
import { formatCurrency, cn } from "@/lib/utils";
import {
  Activity,
  Bot,
  Eraser,
  Send,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";

export type AiContext = {
  businessName: string;
  healthScore: number;
  healthFactors: { id: string; label: string; ok: boolean; detail: string }[];
  salesToday: number;
  salesChange: number;
  profitToday: number;
  tickets: number;
  avgTicket: number;
  cashBalance: number;
  bankBalance: number;
  liquid: number;
  inventoryValue: number;
  lowStockCount: number;
  outStockCount: number;
  lowStockNames: string[];
  customerDebts: number;
  supplierPayables: number;
  topDebtors: { id: string; name: string; balance: number }[];
  vatPayable: number;
  outputVat: number;
  taxPeriodLabel: string;
  reorderEst: number;
  reorderCount: number;
  reorderLines: { name: string; qty: number; cost: number; supplier: string }[];
  payrollDue: number;
  payrollMonth: string;
  loyaltyPoints: number;
  openPos: number;
  insights: {
    title: string;
    detail: string;
    confidence: number;
    type: string;
    href: string;
  }[];
  prompts: string[];
};

type ChatMessage = {
  role: "assistant" | "user";
  text: string;
  href?: string;
  hrefLabel?: string;
};

function answerQuestion(q: string, ctx: AiContext): ChatMessage {
  const lower = q.toLowerCase();

  if (lower.includes("health") || lower.includes("score")) {
    const weak = ctx.healthFactors.filter((f) => !f.ok).map((f) => f.label);
    return {
      role: "assistant",
      text: `Health score ${ctx.healthScore}/100. ${
        weak.length
          ? `Watch: ${weak.join(", ")}.`
          : "All tracked factors look OK."
      } Factors: ${ctx.healthFactors.map((f) => `${f.label} ${f.ok ? "✓" : "✗"} (${f.detail})`).join("; ")}.`,
      href: "/dashboard",
      hrefLabel: "Open dashboard",
    };
  }

  if (lower.includes("reorder") || lower.includes("stock") || lower.includes("procurement")) {
    if (ctx.reorderLines.length === 0) {
      return {
        role: "assistant",
        text: `Stock looks healthy — ${ctx.lowStockCount} low / ${ctx.outStockCount} out. Nothing urgent to reorder.`,
        href: "/inventory",
        hrefLabel: "Inventory",
      };
    }
    const lines = ctx.reorderLines
      .map((r) => `${r.name} × ${r.qty} via ${r.supplier} (~${formatCurrency(r.cost)})`)
      .join("; ");
    return {
      role: "assistant",
      text: `Reorder plan (${ctx.reorderCount} SKUs): ${lines}. Est. total ${formatCurrency(ctx.reorderEst)}.`,
      href: "/procurement",
      hrefLabel: "Procurement",
    };
  }

  if (lower.includes("profit") || lower.includes("margin")) {
    return {
      role: "assistant",
      text: `Gross profit today ${formatCurrency(ctx.profitToday)}. Sales ${formatCurrency(ctx.salesToday)} (${ctx.salesChange >= 0 ? "+" : ""}${ctx.salesChange}% vs prior). ${ctx.tickets} tickets · avg ${formatCurrency(ctx.avgTicket)}. Inventory at cost ${formatCurrency(ctx.inventoryValue)}.`,
      href: "/reports",
      hrefLabel: "Reports",
    };
  }

  if (lower.includes("vat") || lower.includes("tax")) {
    return {
      role: "assistant",
      text: `${ctx.taxPeriodLabel}: output VAT ${formatCurrency(ctx.outputVat)}. Payable on ledger ${formatCurrency(ctx.vatPayable)}. Export the VAT register from Tax when filing.`,
      href: "/tax",
      hrefLabel: "Tax module",
    };
  }

  if (
    lower.includes("cash") ||
    lower.includes("bank") ||
    lower.includes("liquid") ||
    lower.includes("money")
  ) {
    return {
      role: "assistant",
      text: `Cash + MoMo ${formatCurrency(ctx.cashBalance)}, bank ${formatCurrency(ctx.bankBalance)}, liquid ${formatCurrency(ctx.liquid)}. Transfer or cash-out in Banking.`,
      href: "/banking",
      hrefLabel: "Banking",
    };
  }

  if (
    lower.includes("owe") ||
    lower.includes("debt") ||
    lower.includes("receivable") ||
    lower.includes("ar") ||
    lower.includes("collect")
  ) {
    if (ctx.customerDebts <= 0) {
      return {
        role: "assistant",
        text: "No customer receivables on file right now.",
        href: "/customers",
        hrefLabel: "Customers",
      };
    }
    const tops = ctx.topDebtors
      .map((d) => `${d.name} ${formatCurrency(d.balance)}`)
      .join("; ");
    return {
      role: "assistant",
      text: `Accounts receivable ${formatCurrency(ctx.customerDebts)}.${tops ? ` Top: ${tops}.` : ""} Collect at Counter → Customer pay.`,
      href: "/quick-pay",
      hrefLabel: "Customer pay",
    };
  }

  if (lower.includes("payable") || lower.includes("supplier") || lower.includes("ap")) {
    return {
      role: "assistant",
      text: `Supplier payables ${formatCurrency(ctx.supplierPayables)}. ${ctx.openPos} open PO(s). Pay suppliers from Purchasing.`,
      href: "/purchasing",
      hrefLabel: "Purchasing",
    };
  }

  if (lower.includes("payroll") || lower.includes("salary") || lower.includes("wage")) {
    return {
      role: "assistant",
      text: `${ctx.payrollMonth}: estimated unpaid payroll ${formatCurrency(ctx.payrollDue)}. Run payroll from the Payroll module (posts to Salaries 5200).`,
      href: "/payroll",
      hrefLabel: "Payroll",
    };
  }

  if (lower.includes("loyalty") || lower.includes("points") || lower.includes("tier")) {
    return {
      role: "assistant",
      text: `${ctx.loyaltyPoints.toLocaleString()} loyalty points on file. Award/redeem in Loyalty; POS earns 1 pt per 1,000 RWF paid.`,
      href: "/loyalty",
      hrefLabel: "Loyalty",
    };
  }

  if (lower.includes("forecast") || lower.includes("weekend") || lower.includes("tomorrow")) {
    return {
      role: "assistant",
      text: `With sales today at ${formatCurrency(ctx.salesToday)} and ${ctx.tickets} tickets, expect weekend lift if stock of ${
        ctx.lowStockNames[0] ?? "key SKUs"
      } is restored. Liquid ${formatCurrency(ctx.liquid)}.`,
      href: "/bi",
      hrefLabel: "BI analytics",
    };
  }

  if (lower.includes("sale") || lower.includes("today") || lower.includes("ticket")) {
    return {
      role: "assistant",
      text: `Today: sales ${formatCurrency(ctx.salesToday)} (${ctx.salesChange >= 0 ? "+" : ""}${ctx.salesChange}%), profit ${formatCurrency(ctx.profitToday)}, ${ctx.tickets} tickets, avg ${formatCurrency(ctx.avgTicket)}.`,
      href: "/pos",
      hrefLabel: "Sell",
    };
  }

  return {
    role: "assistant",
    text: `I can brief you on health, sales, profit, stock/reorder, VAT, cash, debts, payroll, or loyalty. Try a chip below — or ask “who owes us?”.`,
  };
}

export function AiAssistant({ context }: { context: AiContext }) {
  const starter: ChatMessage = {
    role: "assistant",
    text: `Hi — ${context.businessName} health score ${context.healthScore}. Sales today ${formatCurrency(context.salesToday)} (${context.salesChange >= 0 ? "+" : ""}${context.salesChange}%). Ask about reorder, profit, VAT, cash, debts, or payroll.`,
  };

  const [messages, setMessages] = useState<ChatMessage[]>([starter]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }, answerQuestion(q, context)]);
  }

  function clearChat() {
    setMessages([
      {
        role: "assistant",
        text: "Chat cleared. Ask about health, reorder, profit, VAT, cash, debts, or payroll.",
      },
    ]);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            AI Business Assistant
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Rule-based insights from live sales, stock, cash, VAT, AR, and payroll — not a cloud LLM.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={clearChat}>
          <Eraser className="h-4 w-4" /> Clear chat
        </Button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Health score" value={context.healthScore} icon={Activity} tone="brand" />
        <KpiCard
          label="Sales today"
          value={context.salesToday}
          icon={TrendingUp}
          currency
          tone="accent"
          change={context.salesChange}
        />
        <KpiCard label="Liquid" value={context.liquid} icon={Wallet} currency tone="info" />
        <KpiCard
          label="Low / out SKUs"
          value={`${context.lowStockCount} / ${context.outStockCount}`}
          icon={Sparkles}
          tone={context.lowStockCount || context.outStockCount ? "warn" : "info"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Panel
          title="Chat"
          subtitle="Answers use your live database"
          className="flex h-[600px] flex-col xl:col-span-3"
          bodyClassName="flex flex-1 flex-col p-0"
        >
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}
              >
                {m.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-white">
                    <Bot className="h-4 w-4" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    m.role === "user"
                      ? "bg-brand text-white"
                      : "border border-border bg-surface text-ink",
                  )}
                >
                  <p>{m.text}</p>
                  {m.href && m.hrefLabel && (
                    <Link
                      href={m.href}
                      className="mt-2 inline-block text-xs font-medium text-brand hover:underline"
                    >
                      {m.hrefLabel} →
                    </Link>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="flex flex-wrap gap-2 border-t border-border px-3 py-2">
            {context.prompts.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-full border border-border bg-surface px-3 py-1 text-xs hover:border-brand"
              >
                {s}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2 border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <Input
              placeholder="Ask about sales, stock, tax, cash, debts…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <Button type="submit" size="md">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </Panel>

        <div className="space-y-4 xl:col-span-2">
          <Panel title="Snapshot">
            <dl className="space-y-2 text-sm">
              {[
                ["AR (customers)", formatCurrency(context.customerDebts)],
                ["AP (suppliers)", formatCurrency(context.supplierPayables)],
                ["VAT payable", formatCurrency(context.vatPayable)],
                ["Payroll due (est.)", formatCurrency(context.payrollDue)],
                ["Open POs", String(context.openPos)],
                ["Loyalty pts", context.loyaltyPoints.toLocaleString()],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <dt className="text-ink-muted">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Recommendations">
            <ul className="space-y-3">
              {context.insights.map((insight) => (
                <li key={insight.title} className="rounded-lg border border-border bg-surface p-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-brand" />
                    <p className="text-sm font-medium">{insight.title}</p>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{insight.detail}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <Badge variant="info">
                      {insight.confidence}% · {insight.type}
                    </Badge>
                    <Link href={insight.href}>
                      <Button size="sm" variant="secondary">
                        Act
                      </Button>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
