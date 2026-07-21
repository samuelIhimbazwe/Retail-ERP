export const business = {
  name: "Kigali Fresh Market",
  tagline: "Retail Business Intelligence & Accounting",
  branch: "Kimironko Branch",
  currency: "RWF",
  fiscalYear: "FY 2026",
};

export const currentUser = {
  name: "Jean Baptiste",
  role: "Owner",
  email: "jean@kigalifresh.rw",
  initials: "JB",
};

export const kpiSummary = {
  salesToday: 2_845_000,
  salesChange: 12.4,
  profitToday: 612_400,
  profitChange: 8.1,
  expensesToday: 318_200,
  expensesChange: -3.2,
  cashBalance: 4_120_000,
  bankBalance: 18_650_000,
  inventoryValue: 42_800_000,
  lowStock: 14,
  expiringSoon: 7,
  customerDebts: 1_240_000,
  supplierPayables: 3_890_000,
  vatPayable: 892_000,
  healthScore: 84,
};

export const salesTrend = [
  { day: "Mon", sales: 1_820_000, profit: 410_000 },
  { day: "Tue", sales: 2_140_000, profit: 490_000 },
  { day: "Wed", sales: 1_960_000, profit: 445_000 },
  { day: "Thu", sales: 2_480_000, profit: 560_000 },
  { day: "Fri", sales: 3_120_000, profit: 720_000 },
  { day: "Sat", sales: 3_890_000, profit: 890_000 },
  { day: "Sun", sales: 2_845_000, profit: 612_000 },
];

export const monthlyRevenue = [
  { month: "Jan", revenue: 48_200_000, expenses: 31_400_000 },
  { month: "Feb", revenue: 45_800_000, expenses: 29_900_000 },
  { month: "Mar", revenue: 52_100_000, expenses: 33_200_000 },
  { month: "Apr", revenue: 49_600_000, expenses: 32_100_000 },
  { month: "May", revenue: 55_400_000, expenses: 34_800_000 },
  { month: "Jun", revenue: 58_900_000, expenses: 36_200_000 },
  { month: "Jul", revenue: 41_200_000, expenses: 24_800_000 },
];

export const products = [
  {
    id: "P-1001",
    name: "Rice 25kg Premium",
    category: "Staples",
    brand: "Mushrooms",
    sku: "RIC-25-PR",
    barcode: "6001234567890",
    cost: 28_000,
    sell: 34_500,
    wholesale: 31_000,
    stock: 86,
    minStock: 40,
    unit: "bag",
    tax: "VAT 18%",
    status: "Active" as const,
    batch: "B-2026-041",
    expiry: "2027-03-15",
  },
  {
    id: "P-1002",
    name: "Cooking Oil 5L",
    category: "Staples",
    brand: "Sunflower",
    sku: "OIL-5L-SF",
    barcode: "6001234567891",
    cost: 9_800,
    sell: 12_500,
    wholesale: 11_200,
    stock: 22,
    minStock: 30,
    unit: "bottle",
    tax: "VAT 18%",
    status: "Low Stock" as const,
    batch: "B-2026-038",
    expiry: "2026-11-20",
  },
  {
    id: "P-1003",
    name: "Sugar 1kg",
    category: "Staples",
    brand: "Kabuye",
    sku: "SUG-1KG",
    barcode: "6001234567892",
    cost: 1_100,
    sell: 1_400,
    wholesale: 1_250,
    stock: 340,
    minStock: 100,
    unit: "pack",
    tax: "VAT 18%",
    status: "Active" as const,
    batch: "B-2026-052",
    expiry: "2027-01-10",
  },
  {
    id: "P-1004",
    name: "Paracetamol 500mg",
    category: "Pharmacy",
    brand: "PharmaCare",
    sku: "MED-PAR-500",
    barcode: "6001234567893",
    cost: 450,
    sell: 800,
    wholesale: 600,
    stock: 18,
    minStock: 50,
    unit: "box",
    tax: "Exempt",
    status: "Low Stock" as const,
    batch: "B-2025-112",
    expiry: "2026-08-01",
  },
  {
    id: "P-1005",
    name: "Cement 50kg",
    category: "Hardware",
    brand: "Cimerwa",
    sku: "HW-CEM-50",
    barcode: "6001234567894",
    cost: 9_200,
    sell: 11_000,
    wholesale: 10_000,
    stock: 154,
    minStock: 80,
    unit: "bag",
    tax: "VAT 18%",
    status: "Active" as const,
    batch: "B-2026-019",
    expiry: "—",
  },
  {
    id: "P-1006",
    name: "Fresh Milk 1L",
    category: "Dairy",
    brand: "Inyange",
    sku: "DAI-MLK-1L",
    barcode: "6001234567895",
    cost: 950,
    sell: 1_300,
    wholesale: 1_100,
    stock: 64,
    minStock: 40,
    unit: "carton",
    tax: "VAT 18%",
    status: "Expiring" as const,
    batch: "B-2026-071",
    expiry: "2026-07-22",
  },
  {
    id: "P-1007",
    name: "Soap Bar Multipack",
    category: "Household",
    brand: "Savon",
    sku: "HH-SOAP-MP",
    barcode: "6001234567896",
    cost: 2_400,
    sell: 3_200,
    wholesale: 2_800,
    stock: 0,
    minStock: 25,
    unit: "pack",
    tax: "VAT 18%",
    status: "Out of Stock" as const,
    batch: "B-2026-028",
    expiry: "2028-02-01",
  },
  {
    id: "P-1008",
    name: "Maize Flour 10kg",
    category: "Staples",
    brand: "Sosoma",
    sku: "MAZ-10KG",
    barcode: "6001234567897",
    cost: 7_500,
    sell: 9_200,
    wholesale: 8_400,
    stock: 112,
    minStock: 50,
    unit: "bag",
    tax: "VAT 18%",
    status: "Active" as const,
    batch: "B-2026-044",
    expiry: "2026-12-30",
  },
];

export const stockMovements = [
  { id: "SM-4421", product: "Rice 25kg Premium", type: "Sale", qty: -2, warehouse: "Main Store", user: "Aline U.", time: "14:32" },
  { id: "SM-4420", product: "Cooking Oil 5L", type: "Sale", qty: -1, warehouse: "Main Store", user: "Aline U.", time: "14:28" },
  { id: "SM-4419", product: "Cement 50kg", type: "Transfer", qty: -20, warehouse: "Warehouse A → B", user: "Eric N.", time: "13:55" },
  { id: "SM-4418", product: "Sugar 1kg", type: "Purchase", qty: 200, warehouse: "Main Store", user: "Eric N.", time: "11:20" },
  { id: "SM-4417", product: "Fresh Milk 1L", type: "Adjustment", qty: -4, warehouse: "Cold Room", user: "Jean B.", time: "10:05" },
  { id: "SM-4416", product: "Paracetamol 500mg", type: "Return", qty: 3, warehouse: "Pharmacy Shelf", user: "Aline U.", time: "09:40" },
];

export const suppliers = [
  { id: "SUP-01", name: "East Africa Distributors", category: "Staples", balance: 1_450_000, rating: 4.6, leadDays: 3, orders: 48 },
  { id: "SUP-02", name: "PharmaLink Rwanda", category: "Pharmacy", balance: 620_000, rating: 4.8, leadDays: 2, orders: 31 },
  { id: "SUP-03", name: "BuildRight Supplies", category: "Hardware", balance: 980_000, rating: 4.2, leadDays: 5, orders: 22 },
  { id: "SUP-04", name: "Inyange Industries", category: "Dairy", balance: 840_000, rating: 4.9, leadDays: 1, orders: 67 },
];

export const purchaseOrders = [
  { id: "PO-2026-118", supplier: "East Africa Distributors", date: "2026-07-14", items: 12, total: 4_280_000, status: "Pending Approval" as const },
  { id: "PO-2026-117", supplier: "Inyange Industries", date: "2026-07-13", items: 6, total: 1_120_000, status: "Received" as const },
  { id: "PO-2026-116", supplier: "PharmaLink Rwanda", date: "2026-07-12", items: 18, total: 890_000, status: "Partial" as const },
  { id: "PO-2026-115", supplier: "BuildRight Supplies", date: "2026-07-10", items: 8, total: 2_450_000, status: "Paid" as const },
];

export const customers = [
  { id: "CUS-210", name: "Hotel des Mille Collines", type: "Credit", balance: 420_000, points: 1840, lastPurchase: "2026-07-15", segment: "VIP" },
  { id: "CUS-211", name: "Uwase Grace", type: "Walk-in", balance: 0, points: 320, lastPurchase: "2026-07-16", segment: "Regular" },
  { id: "CUS-212", name: "Kimisagara Hardware Co.", type: "Credit", balance: 680_000, points: 920, lastPurchase: "2026-07-14", segment: "Wholesale" },
  { id: "CUS-213", name: "Dr. Mukamana Clinic", type: "Credit", balance: 140_000, points: 560, lastPurchase: "2026-07-13", segment: "Pharmacy" },
  { id: "CUS-214", name: "Niyonsaba Eric", type: "Walk-in", balance: 0, points: 85, lastPurchase: "2026-07-16", segment: "New" },
];

export const chartOfAccounts = [
  { code: "1000", name: "Cash on Hand", type: "Asset", balance: 4_120_000 },
  { code: "1100", name: "Bank - BK Current", type: "Asset", balance: 18_650_000 },
  { code: "1200", name: "Accounts Receivable", type: "Asset", balance: 1_240_000 },
  { code: "1300", name: "Inventory Asset", type: "Asset", balance: 42_800_000 },
  { code: "2000", name: "Accounts Payable", type: "Liability", balance: 3_890_000 },
  { code: "2100", name: "VAT Payable", type: "Liability", balance: 892_000 },
  { code: "3000", name: "Owner Equity", type: "Equity", balance: 50_000_000 },
  { code: "4000", name: "Sales Revenue", type: "Revenue", balance: 58_900_000 },
  { code: "5000", name: "Cost of Goods Sold", type: "Expense", balance: 36_200_000 },
  { code: "5100", name: "Operating Expenses", type: "Expense", balance: 8_400_000 },
];

export const journalEntries = [
  { id: "JE-8841", date: "2026-07-16", desc: "POS Sales – Shift A", debit: 2_845_000, credit: 2_845_000, status: "Posted" },
  { id: "JE-8840", date: "2026-07-16", desc: "VAT Output on sales", debit: 433_983, credit: 433_983, status: "Posted" },
  { id: "JE-8839", date: "2026-07-15", desc: "Supplier payment – Inyange", debit: 1_120_000, credit: 1_120_000, status: "Posted" },
  { id: "JE-8838", date: "2026-07-15", desc: "Stock receipt – PO-117", debit: 980_000, credit: 980_000, status: "Posted" },
  { id: "JE-8837", date: "2026-07-14", desc: "Utility expense – EWSA", debit: 185_000, credit: 185_000, status: "Pending" },
];

export const aiInsights = [
  {
    title: "Reorder Cooking Oil 5L",
    detail: "Stock will hit zero in ~6 days at current velocity. Suggested PO: 80 bottles from East Africa Distributors (best unit cost).",
    confidence: 92,
    type: "procurement" as const,
  },
  {
    title: "Weekend sales surge expected",
    detail: "Saturday projections +18% vs last week. Ensure rice, oil, and milk are fully stocked before Friday close.",
    confidence: 87,
    type: "forecast" as const,
  },
  {
    title: "Margin risk on Cement",
    detail: "Supplier price rose 4.2% last invoice. Current retail margin is 16.4% — consider adjusting sell price to 11,400 RWF.",
    confidence: 81,
    type: "profit" as const,
  },
  {
    title: "Expiry alert – Pharmacy",
    detail: "Paracetamol batch B-2025-112 expires in 16 days with 18 boxes left. Promote or return to PharmaLink.",
    confidence: 95,
    type: "risk" as const,
  },
];

export const notifications = [
  { id: 1, title: "Low stock: Cooking Oil 5L", time: "12 min ago", type: "stock", unread: true },
  { id: 2, title: "PO-118 awaiting your approval", time: "45 min ago", type: "approval", unread: true },
  { id: 3, title: "VAT filing reminder – due Jul 31", time: "2 hrs ago", type: "tax", unread: true },
  { id: 4, title: "Customer debt overdue: Hotel des Mille Collines", time: "4 hrs ago", type: "payment", unread: false },
  { id: 5, title: "AI: Reorder recommendation ready", time: "Yesterday", type: "ai", unread: false },
  { id: 6, title: "Shift B closed – cash variance +2,400 RWF", time: "Yesterday", type: "cash", unread: false },
];

export const warehouses = [
  { id: "WH-A", name: "Main Store", utilization: 72, skus: 486, value: 28_400_000 },
  { id: "WH-B", name: "Warehouse B", utilization: 54, skus: 210, value: 9_800_000 },
  { id: "WH-C", name: "Cold Room", utilization: 81, skus: 64, value: 2_600_000 },
  { id: "WH-D", name: "Pharmacy Shelf", utilization: 45, skus: 128, value: 2_000_000 },
];

export const employees = [
  { id: "EMP-01", name: "Aline Uwase", role: "Cashier", dept: "Sales", shift: "A", status: "Clocked In" },
  { id: "EMP-02", name: "Eric Niyonshuti", role: "Storekeeper", dept: "Warehouse", shift: "Day", status: "Clocked In" },
  { id: "EMP-03", name: "Claire Mukamana", role: "Accountant", dept: "Finance", shift: "Day", status: "Clocked In" },
  { id: "EMP-04", name: "Patrick Habimana", role: "Manager", dept: "Operations", shift: "Day", status: "On Leave" },
];

export const branches = [
  { id: "BR-01", name: "Kimironko", sales: 58_900_000, profit: 12_400_000, stock: 42_800_000, health: 84 },
  { id: "BR-02", name: "Nyabugogo", sales: 44_200_000, profit: 8_900_000, stock: 31_200_000, health: 78 },
  { id: "BR-03", name: "Remera", sales: 39_800_000, profit: 7_650_000, stock: 27_400_000, health: 81 },
];

export const topProducts = [
  { name: "Rice 25kg", sales: 8_200_000 },
  { name: "Cooking Oil 5L", sales: 5_400_000 },
  { name: "Cement 50kg", sales: 4_800_000 },
  { name: "Maize Flour", sales: 3_900_000 },
  { name: "Sugar 1kg", sales: 3_100_000 },
];

export const reportsList = [
  "Income Statement (P&L)",
  "Balance Sheet",
  "Cash Flow Statement",
  "Trial Balance",
  "Sales Report",
  "Purchase Report",
  "Inventory Valuation",
  "Accounts Receivable",
  "Accounts Payable",
  "VAT Report",
  "Branch Performance",
  "Product Profitability",
];
