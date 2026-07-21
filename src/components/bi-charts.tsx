"use client";

import { formatCurrency } from "@/lib/utils";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PIE_COLORS = ["#0b6e4f", "#1a6b8a", "#c45c26", "#b45309", "#64748b", "#0f766e"];

export function BiRevenueChart({
  data,
}: {
  data: { label: string; revenue: number; expenses: number }[];
}) {
  const chartData = data.length > 24 ? data.filter((d) => d.revenue > 0 || d.expenses > 0) : data;

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData.length ? chartData : data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d4dde3" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#7a92a4" }} interval="preserveStartEnd" />
          <YAxis
            tick={{ fontSize: 11, fill: "#7a92a4" }}
            tickFormatter={(v) =>
              Number(v) >= 1_000_000
                ? `${(Number(v) / 1e6).toFixed(1)}M`
                : `${(Number(v) / 1e3).toFixed(0)}k`
            }
          />
          <Tooltip
            formatter={(v) => formatCurrency(Number(v))}
            contentStyle={{ borderRadius: 8, fontSize: 12 }}
          />
          <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#0b6e4f" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="expenses" name="COGS" stroke="#c45c26" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BiProductsChart({ data }: { data: { name: string; sales: number }[] }) {
  if (data.length === 0) {
    return (
      <p className="flex h-64 items-center justify-center text-sm text-ink-muted">
        No product sales yet — sell at POS to populate.
      </p>
    );
  }

  const rows = data.slice(0, 8).map((p) => ({
    ...p,
    name: p.name.length > 18 ? `${p.name.slice(0, 16)}…` : p.name,
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d4dde3" />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: "#7a92a4" }}
            tickFormatter={(v) => `${(Number(v) / 1e3).toFixed(0)}k`}
          />
          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: "#4a6274" }} />
          <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
          <Bar dataKey="sales" fill="#1a6b8a" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BiPaymentChart({ data }: { data: { method: string; amount: number }[] }) {
  if (data.length === 0) {
    return (
      <p className="flex h-56 items-center justify-center text-sm text-ink-muted">No payments in period.</p>
    );
  }

  const rows = data.map((d) => ({
    name: d.method.charAt(0) + d.method.slice(1).toLowerCase(),
    value: d.amount,
  }));

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={rows} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2}>
            {rows.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BiCategoryChart({ data }: { data: { category: string; sales: number }[] }) {
  if (data.length === 0) {
    return (
      <p className="flex h-56 items-center justify-center text-sm text-ink-muted">No category sales.</p>
    );
  }

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.slice(0, 8)}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d4dde3" />
          <XAxis dataKey="category" tick={{ fontSize: 10, fill: "#7a92a4" }} interval={0} angle={-20} textAnchor="end" height={50} />
          <YAxis
            tick={{ fontSize: 11, fill: "#7a92a4" }}
            tickFormatter={(v) => `${(Number(v) / 1e3).toFixed(0)}k`}
          />
          <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
          <Bar dataKey="sales" fill="#0b6e4f" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
