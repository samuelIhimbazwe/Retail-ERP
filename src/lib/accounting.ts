import { AccountType, type Prisma, type PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient | PrismaClient;

const COA = [
  { code: "1000", name: "Cash on Hand", type: AccountType.ASSET },
  { code: "1100", name: "Bank", type: AccountType.ASSET },
  { code: "1200", name: "Mobile Money", type: AccountType.ASSET },
  { code: "1300", name: "Accounts Receivable", type: AccountType.ASSET },
  { code: "1400", name: "Inventory Asset", type: AccountType.ASSET },
  { code: "2000", name: "Accounts Payable", type: AccountType.LIABILITY },
  { code: "2100", name: "VAT Payable", type: AccountType.LIABILITY },
  { code: "2200", name: "VAT Receivable (Input)", type: AccountType.ASSET },
  { code: "3000", name: "Owner Equity", type: AccountType.EQUITY },
  { code: "3100", name: "Owner Draw", type: AccountType.EQUITY },
  { code: "4000", name: "Sales Revenue", type: AccountType.REVENUE },
  { code: "5000", name: "Cost of Goods Sold", type: AccountType.EXPENSE },
  { code: "5100", name: "Operating Expenses", type: AccountType.EXPENSE },
  { code: "5150", name: "Loyalty & Rewards", type: AccountType.EXPENSE },
  { code: "5200", name: "Salaries & Wages", type: AccountType.EXPENSE },
] as const;

export async function ensureChartOfAccounts(tx: Tx, businessId: string) {
  const business = await tx.business.findUnique({
    where: { id: businessId },
    select: { id: true },
  });
  if (!business) {
    throw new Error("Business not found — sign out and sign in again after a DB reset");
  }

  const existing = await tx.account.findMany({ where: { businessId } });
  const have = new Set(existing.map((a) => a.code));
  const missing = COA.filter((a) => !have.has(a.code));
  if (missing.length > 0) {
    await tx.account.createMany({
      data: missing.map((a) => ({
        businessId,
        code: a.code,
        name: a.name,
        type: a.type,
        balance: 0,
      })),
    });
  }
  return tx.account.findMany({ where: { businessId }, orderBy: { code: "asc" } });
}

function byCode(accounts: { id: string; code: string; type: AccountType }[]) {
  return new Map(accounts.map((a) => [a.code, a]));
}

/** Debit-normal accounts: ASSET, EXPENSE. Credit-normal: LIABILITY, EQUITY, REVENUE */
function applyBalance(
  type: AccountType,
  debit: number,
  credit: number,
) {
  if (type === AccountType.ASSET || type === AccountType.EXPENSE) {
    return debit - credit;
  }
  return credit - debit;
}

export async function postJournal(
  tx: Tx,
  params: {
    businessId: string;
    description: string;
    refType?: string;
    refId?: string;
    lines: { code: string; debit?: number; credit?: number }[];
  },
) {
  const accounts = await ensureChartOfAccounts(tx, params.businessId);
  const map = byCode(accounts);

  const resolved = params.lines.map((l) => {
    const account = map.get(l.code);
    if (!account) throw new Error(`Account ${l.code} missing`);
    const debit = l.debit ?? 0;
    const credit = l.credit ?? 0;
    if (debit < 0 || credit < 0) throw new Error("Negative journal amounts");
    if (debit > 0 && credit > 0) throw new Error("Line cannot have both debit and credit");
    return { account, debit, credit };
  });

  const debitSum = resolved.reduce((s, l) => s + l.debit, 0);
  const creditSum = resolved.reduce((s, l) => s + l.credit, 0);
  if (debitSum !== creditSum) {
    throw new Error(`Unbalanced journal: debit ${debitSum} ≠ credit ${creditSum}`);
  }
  if (debitSum === 0) return null;

  const count = await tx.journalEntry.count({ where: { businessId: params.businessId } });
  const number = `JE-${String(count + 1).padStart(5, "0")}`;

  const journal = await tx.journalEntry.create({
    data: {
      businessId: params.businessId,
      number,
      description: params.description,
      refType: params.refType,
      refId: params.refId,
      lines: {
        create: resolved.map((l) => ({
          accountId: l.account.id,
          debit: l.debit,
          credit: l.credit,
        })),
      },
    },
  });

  for (const l of resolved) {
    const delta = applyBalance(l.account.type, l.debit, l.credit);
    await tx.account.update({
      where: { id: l.account.id },
      data: { balance: { increment: delta } },
    });
  }

  return journal;
}

export async function postSaleJournal(
  tx: Tx,
  params: {
    businessId: string;
    saleId: string;
    saleNumber: string;
    total: number;
    taxAmt: number;
    cogs: number;
    payments: { method: string; amount: number }[];
  },
) {
  const revenue = params.total - params.taxAmt;
  const lines: { code: string; debit?: number; credit?: number }[] = [];

  for (const p of params.payments) {
    if (p.amount <= 0) continue;
    const code =
      p.method === "CASH"
        ? "1000"
        : p.method === "CARD"
          ? "1100"
          : p.method === "MOMO"
            ? "1200"
            : p.method === "CREDIT"
              ? "1300"
              : "1000";
    lines.push({ code, debit: p.amount });
  }

  if (revenue > 0) lines.push({ code: "4000", credit: revenue });
  if (params.taxAmt > 0) lines.push({ code: "2100", credit: params.taxAmt });

  await postJournal(tx, {
    businessId: params.businessId,
    description: `POS Sale ${params.saleNumber}`,
    refType: "Sale",
    refId: params.saleId,
    lines,
  });

  if (params.cogs > 0) {
    await postJournal(tx, {
      businessId: params.businessId,
      description: `COGS ${params.saleNumber}`,
      refType: "Sale",
      refId: params.saleId,
      lines: [
        { code: "5000", debit: params.cogs },
        { code: "1400", credit: params.cogs },
      ],
    });
  }
}

export async function postReceiveJournal(
  tx: Tx,
  params: {
    businessId: string;
    poId: string;
    poNumber: string;
    inventoryCost: number;
  },
) {
  if (params.inventoryCost <= 0) return null;
  return postJournal(tx, {
    businessId: params.businessId,
    description: `Stock receive ${params.poNumber}`,
    refType: "PurchaseOrder",
    refId: params.poId,
    lines: [
      { code: "1400", debit: params.inventoryCost },
      { code: "2000", credit: params.inventoryCost },
    ],
  });
}

export async function postCustomerPaymentJournal(
  tx: Tx,
  params: {
    businessId: string;
    customerId: string;
    customerName: string;
    amount: number;
    method?: string;
  },
) {
  if (params.amount <= 0) return null;
  const asset =
    params.method === "MOMO" ? "1200" : params.method === "CARD" ? "1100" : "1000";
  return postJournal(tx, {
    businessId: params.businessId,
    description: `Customer payment — ${params.customerName}`,
    refType: "CustomerPayment",
    refId: params.customerId,
    lines: [
      { code: asset, debit: params.amount },
      { code: "1300", credit: params.amount },
    ],
  });
}

export async function postSupplierPaymentJournal(
  tx: Tx,
  params: {
    businessId: string;
    supplierId: string;
    supplierName: string;
    amount: number;
    method?: string;
  },
) {
  if (params.amount <= 0) return null;
  const asset =
    params.method === "MOMO" ? "1200" : params.method === "CARD" ? "1100" : "1000";
  return postJournal(tx, {
    businessId: params.businessId,
    description: `Supplier payment — ${params.supplierName}`,
    refType: "SupplierPayment",
    refId: params.supplierId,
    lines: [
      { code: "2000", debit: params.amount },
      { code: asset, credit: params.amount },
    ],
  });
}

const LIQUID = new Set(["1000", "1100", "1200"]);

export async function postTransferJournal(
  tx: Tx,
  params: {
    businessId: string;
    fromCode: string;
    toCode: string;
    amount: number;
    note?: string;
  },
) {
  if (params.amount <= 0) return null;
  if (!LIQUID.has(params.fromCode) || !LIQUID.has(params.toCode)) {
    throw new Error("Transfer only between Cash, Bank, and Mobile Money");
  }
  if (params.fromCode === params.toCode) {
    throw new Error("Choose two different accounts");
  }
  const labels: Record<string, string> = {
    "1000": "Cash",
    "1100": "Bank",
    "1200": "MoMo",
  };
  return postJournal(tx, {
    businessId: params.businessId,
    description:
      params.note?.trim() ||
      `Transfer ${labels[params.fromCode]} → ${labels[params.toCode]}`,
    refType: "Transfer",
    lines: [
      { code: params.toCode, debit: params.amount },
      { code: params.fromCode, credit: params.amount },
    ],
  });
}

export async function postCashOutJournal(
  tx: Tx,
  params: {
    businessId: string;
    fromCode: string;
    amount: number;
    category: string;
    note?: string;
  },
) {
  if (params.amount <= 0) return null;
  if (!LIQUID.has(params.fromCode)) {
    throw new Error("Pay from Cash, Bank, or Mobile Money");
  }
  const expenseCode = params.category === "Owner draw" ? "3100" : "5100";
  const labels: Record<string, string> = {
    "1000": "Cash",
    "1100": "Bank",
    "1200": "MoMo",
  };
  return postJournal(tx, {
    businessId: params.businessId,
    description:
      params.note?.trim() ||
      `${params.category} from ${labels[params.fromCode]}`,
    refType: "CashOut",
    lines: [
      { code: expenseCode, debit: params.amount },
      { code: params.fromCode, credit: params.amount },
    ],
  });
}

export async function postPayrollJournal(
  tx: Tx,
  params: {
    businessId: string;
    fromCode: string;
    amount: number;
    periodLabel: string;
    staffCount: number;
    note?: string;
  },
) {
  if (params.amount <= 0) return null;
  if (!LIQUID.has(params.fromCode)) {
    throw new Error("Pay payroll from Cash, Bank, or Mobile Money");
  }
  const labels: Record<string, string> = {
    "1000": "Cash",
    "1100": "Bank",
    "1200": "MoMo",
  };
  return postJournal(tx, {
    businessId: params.businessId,
    description:
      params.note?.trim() ||
      `Payroll ${params.periodLabel} · ${params.staffCount} staff from ${labels[params.fromCode]}`,
    refType: "Payroll",
    lines: [
      { code: "5200", debit: params.amount },
      { code: params.fromCode, credit: params.amount },
    ],
  });
}

/** Redeem loyalty points → store credit on customer AR (expense + reduce/credit AR). */
export async function postLoyaltyRedeemJournal(
  tx: Tx,
  params: {
    businessId: string;
    customerId: string;
    customerName: string;
    amount: number;
    points: number;
  },
) {
  if (params.amount <= 0) return null;
  return postJournal(tx, {
    businessId: params.businessId,
    description: `Loyalty redeem ${params.points} pts → ${params.customerName}`,
    refType: "LoyaltyRedeem",
    refId: params.customerId,
    lines: [
      { code: "5150", debit: params.amount },
      { code: "1300", credit: params.amount },
    ],
  });
}
