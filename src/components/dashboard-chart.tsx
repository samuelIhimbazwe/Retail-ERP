"use client";

import { formatCurrency } from "@/lib/utils";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function DashboardChart({
  data,
}: {
  data: { day: string; sales: number; profit: number }[];
}) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="salesFillLive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0b6e4f" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#0b6e4f" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#d4dde3" />
          <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#7a92a4" }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: "#7a92a4" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${(Number(v) / 1e3).toFixed(0)}k`}
          />
          <Tooltip
            formatter={(value) => formatCurrency(Number(value))}
            contentStyle={{ borderRadius: 8, border: "1px solid #d4dde3", fontSize: 12 }}
          />
          <Area
            type="monotone"
            dataKey="sales"
            stroke="#0b6e4f"
            fill="url(#salesFillLive)"
            strokeWidth={2}
            name="Sales"
          />
          <Area
            type="monotone"
            dataKey="profit"
            stroke="#c45c26"
            fill="transparent"
            strokeWidth={2}
            name="Profit"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
