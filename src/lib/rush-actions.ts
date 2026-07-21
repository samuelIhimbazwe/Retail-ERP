export const rushActions = [
  {
    id: "sell",
    href: "/pos",
    title: "Sell",
    subtitle: "Take payment · under 1 min",
    hint: "Customer at counter",
    tone: "brand" as const,
  },
  {
    id: "stock",
    href: "/stock-check",
    title: "Stock check",
    subtitle: "“Do you have it?” · seconds",
    hint: "Answer without leaving the queue",
    tone: "info" as const,
  },
  {
    id: "receive",
    href: "/receive",
    title: "Receive goods",
    subtitle: "Supplier delivered · under 1 min",
    hint: "Stock up + supplier balance",
    tone: "accent" as const,
  },
  {
    id: "pay",
    href: "/quick-pay",
    title: "Customer pay",
    subtitle: "Collect debt · under 1 min",
    hint: "Credit customer settles",
    tone: "warn" as const,
  },
] as const;
