"use client";

import { formatCurrency } from "@/lib/utils";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function ReportsChart({
  data,
}: {
  data: { label: string; revenue: number; expenses: number; tickets?: number }[];
}) {
  const chartData =
    data.length > 24
      ? data.filter((d) => d.revenue > 0 || d.expenses > 0 || (d.tickets ?? 0) > 0)
      : data;

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData.length ? chartData : data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e3e9e7" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8a9895" }} interval="preserveStartEnd" />
          <YAxis
            tick={{ fontSize: 11, fill: "#8a9895" }}
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
          <Legend />
          <Bar dataKey="revenue" name="Revenue" fill="#0f3d3a" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expenses" name="COGS" fill="#c4a35a" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
