import { revalidatePath } from "@/lib/revalidate";
import { PaymentMethod, ProductStatus, StockMovementType } from "@prisma/client";
import { z } from "zod";
import { requireSession } from "@/auth";
import { prisma } from "@/lib/db";
import { computeProductStatus, toCatalogProduct } from "@/lib/product-utils";
import { postCustomerPaymentJournal,
  postCashOutJournal,
  postJournal,
  postLoyaltyRedeemJournal,
  postPayrollJournal,
  postReceiveJournal,
  postSaleJournal,
  postSupplierPaymentJournal,
  postTransferJournal,
  ensureChartOfAccounts,
} from "@/lib/accounting";
import { formatCurrency } from "@/lib/utils";
import { isReportPeriodId, resolveReportRange } from "@/lib/report-periods";

export async function getProducts(
  query?: string,
  opts?: { includeInactive?: boolean },
) {
  const session = await requireSession();
  const q = query?.trim();

  const products = await prisma.product.findMany({
    where: {
      businessId: session.user.businessId,
      ...(opts?.includeInactive ? {} : { status: { not: ProductStatus.INACTIVE } }),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { sku: { contains: q } },
              { barcode: { contains: q } },
              { category: { contains: q } },
              { brand: { contains: q } },
              { size: { contains: q } },
              { color: { contains: q } },
              { style: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: [{ category: "asc" }, { name: "asc" }, { size: "asc" }],
  });

  return products.map(toCatalogProduct);
}

export async function getCustomers() {
  const session = await requireSession();
  return prisma.customer.findMany({
    where: { businessId: session.user.businessId, isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function getOpenPurchaseOrders() {
  const session = await requireSession();
  return prisma.purchaseOrder.findMany({
    where: {
      businessId: session.user.businessId,
      status: { in: ["ORDERED", "PARTIAL", "PENDING_APPROVAL"] },
    },
    include: {
      supplier: true,
      lines: { include: { product: true } },
    },
    orderBy: { orderDate: "desc" },
  });
}

export async function getStockMovements(limit = 50) {
  const session = await requireSession();
  return prisma.stockMovement.findMany({
    where: { businessId: session.user.businessId },
    include: {
      product: { select: { id: true, name: true, sku: true, unit: true } },
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 200),
  });
}

export async function getSessionBusiness() {
  const session = await requireSession();
  return {
    user: session.user,
    businessName: session.user.businessName,
    branchName: session.user.branchName,
  };
}

const saleItemSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().int().positive(),
});

const paymentPartSchema = z.object({
  method: z.enum(["CASH", "CARD", "MOMO", "CREDIT"]),
  amount: z.number().int().positive(),
});

const createSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1),
  /** Single method OR multiple parts that sum to total */
  payments: z.array(paymentPartSchema).min(1).max(3),
  customerId: z.string().optional().nullable(),
  discountPct: z.number().min(0).max(50).optional().default(0),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;

export async function createSale(input: CreateSaleInput) {
  const session = await requireSession();
  const data = createSaleSchema.parse(input);

  try {
    const sale = await prisma.$transaction(async (tx) => {
      const productIds = data.items.map((i) => i.productId);
      const products = await tx.product.findMany({
        where: {
          id: { in: productIds },
          businessId: session.user.businessId,
        },
      });

      if (products.length !== productIds.length) {
        throw new Error("One or more products were not found");
      }

      const byId = new Map(products.map((p) => [p.id, p]));
      let subtotal = 0;
      let taxAmt = 0;
      let cogs = 0;

      const lineData: {
        productId: string;
        qty: number;
        unitPrice: number;
        lineTotal: number;
        taxAmt: number;
      }[] = [];

      for (const item of data.items) {
        const product = byId.get(item.productId)!;
        if (product.stockQty < item.qty) {
          throw new Error(`Insufficient stock for ${product.name}`);
        }

        const lineTotal = product.sellPrice * item.qty;
        const lineTax = product.taxExempt
          ? 0
          : Math.round(lineTotal - lineTotal / (1 + product.taxRate));
        subtotal += lineTotal;
        taxAmt += lineTax;
        cogs += product.costPrice * item.qty;

        lineData.push({
          productId: product.id,
          qty: item.qty,
          unitPrice: product.sellPrice,
          lineTotal,
          taxAmt: lineTax,
        });
      }

      const discountAmt = Math.round(subtotal * ((data.discountPct ?? 0) / 100));
      const total = subtotal - discountAmt;
      const finalTax = discountAmt > 0 ? Math.round(taxAmt * (total / subtotal)) : taxAmt;

      const paySum = data.payments.reduce((s, p) => s + p.amount, 0);
      if (paySum !== total) {
        throw new Error(
          `Payments (${paySum.toLocaleString()} RWF) must equal total (${total.toLocaleString()} RWF)`,
        );
      }

      const creditParts = data.payments.filter((p) => p.method === "CREDIT");
      if (creditParts.length && !data.customerId) {
        throw new Error("Select a credit customer for credit payment");
      }

      const primaryMethod =
        data.payments.length === 1
          ? (data.payments[0].method as PaymentMethod)
          : PaymentMethod.SPLIT;

      const count = await tx.sale.count({
        where: { businessId: session.user.businessId },
      });
      const number = `S-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(count + 1).padStart(4, "0")}`;

      const created = await tx.sale.create({
        data: {
          businessId: session.user.businessId,
          branchId: session.user.branchId,
          userId: session.user.id,
          customerId: data.customerId || null,
          number,
          paymentMethod: primaryMethod,
          subtotal,
          discountAmt,
          taxAmt: finalTax,
          total,
          lines: { create: lineData },
          payments: {
            create: data.payments.map((p) => ({
              method: p.method as PaymentMethod,
              amount: p.amount,
            })),
          },
        },
        include: { lines: true, payments: true },
      });

      for (const item of data.items) {
        const product = byId.get(item.productId)!;
        const newQty = product.stockQty - item.qty;
        await tx.product.update({
          where: { id: product.id },
          data: {
            stockQty: newQty,
            status: computeProductStatus(newQty, product.minStock),
          },
        });

        await tx.stockMovement.create({
          data: {
            businessId: session.user.businessId,
            branchId: session.user.branchId,
            productId: product.id,
            userId: session.user.id,
            type: StockMovementType.SALE,
            qty: -item.qty,
            note: `Sale ${number}`,
            refType: "Sale",
            refId: created.id,
          },
        });
      }

      const creditTotal = creditParts.reduce((s, p) => s + p.amount, 0);
      if (creditTotal > 0 && data.customerId) {
        await tx.customer.update({
          where: { id: data.customerId },
          data: { balance: { increment: creditTotal } },
        });
      }

      // Loyalty: 1 point per 1,000 RWF paid (excludes credit)
      if (data.customerId) {
        const paidAmt = data.payments
          .filter((p) => p.method !== "CREDIT")
          .reduce((s, p) => s + p.amount, 0);
        const earned = Math.floor(paidAmt / 1000);
        if (earned > 0) {
          await tx.customer.update({
            where: { id: data.customerId },
            data: { points: { increment: earned } },
          });
        }
      }

      await postSaleJournal(tx, {
        businessId: session.user.businessId,
        saleId: created.id,
        saleNumber: number,
        total,
        taxAmt: finalTax,
        cogs,
        payments: data.payments,
      });

      return created;
    });

    revalidatePath("/pos");
    revalidatePath("/products");
    revalidatePath("/inventory");
    revalidatePath("/stock-check");
    revalidatePath("/counter");
    revalidatePath("/dashboard");
    revalidatePath("/accounting");
    revalidatePath("/tax");
    revalidatePath("/banking");
    revalidatePath("/customers");
    revalidatePath("/quick-pay");
    revalidatePath("/loyalty");
    revalidatePath("/reports");

    const customerName =
      sale.customerId != null
        ? (
            await prisma.customer.findFirst({
              where: { id: sale.customerId, businessId: session.user.businessId },
              select: { name: true },
            })
          )?.name ?? null
        : null;

    return {
      ok: true as const,
      saleId: sale.id,
      number: sale.number,
      total: sale.total,
      subtotal: sale.subtotal,
      discountAmt: sale.discountAmt,
      taxAmt: sale.taxAmt,
      payments: sale.payments.map((p) => ({ method: p.method, amount: p.amount })),
      customerName,
      createdAt: sale.createdAt.toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sale failed";
    return { ok: false as const, error: message };
  }
}

const receiveLineSchema = z.object({
  lineId: z.string().min(1),
  /** Good units to put into stock (as ordered product, or receiveAsProductId) */
  qtyGood: z.number().int().min(0),
  /** Damaged / refused — not stocked */
  qtyRejected: z.number().int().min(0).default(0),
  rejectReason: z.string().optional().nullable(),
  /** If wrong size/SKU arrived, stock this product instead */
  receiveAsProductId: z.string().optional().nullable(),
});

const receiveSchema = z.object({
  purchaseOrderId: z.string().min(1),
  lines: z.array(receiveLineSchema).min(1),
});

export type ReceivePurchaseOrderInput = z.infer<typeof receiveSchema>;

export async function receivePurchaseOrder(input: ReceivePurchaseOrderInput | string) {
  const session = await requireSession();

  // Backward-compatible: full receive by id
  const data =
    typeof input === "string"
      ? null
      : receiveSchema.parse(input);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const purchaseOrderId = typeof input === "string" ? input : data!.purchaseOrderId;

      const po = await tx.purchaseOrder.findFirst({
        where: {
          id: purchaseOrderId,
          businessId: session.user.businessId,
        },
        include: { lines: { include: { product: true } }, supplier: true },
      });

      if (!po) throw new Error("Purchase order not found");
      if (po.status === "RECEIVED") throw new Error("Already received");
      if (po.status === "CANCELLED") throw new Error("Purchase order cancelled");

      const lineInputs =
        data?.lines ??
        po.lines.map((l) => ({
          lineId: l.id,
          qtyGood: l.qtyOrdered - l.qtyReceived,
          qtyRejected: 0,
          rejectReason: null as string | null,
          receiveAsProductId: null as string | null,
        }));

      let addedCost = 0;

      for (const lineIn of lineInputs) {
        const line = po.lines.find((l) => l.id === lineIn.lineId);
        if (!line) throw new Error("PO line not found");

        const remaining = line.qtyOrdered - line.qtyReceived;
        const qtyGood = lineIn.qtyGood;
        const qtyRejected = lineIn.qtyRejected ?? 0;

        if (qtyGood + qtyRejected > remaining) {
          throw new Error(
            `Too many units for ${line.product.name}: remaining ${remaining}, got ${qtyGood + qtyRejected}`,
          );
        }

        if (qtyGood <= 0 && qtyRejected <= 0) continue;

        const stockProductId = lineIn.receiveAsProductId || line.productId;
        const stockProduct = await tx.product.findFirst({
          where: { id: stockProductId, businessId: session.user.businessId },
        });
        if (!stockProduct) throw new Error("Receive-as product not found");

        if (qtyGood > 0) {
          const newQty = stockProduct.stockQty + qtyGood;
          await tx.product.update({
            where: { id: stockProduct.id },
            data: {
              stockQty: newQty,
              costPrice: line.unitCost,
              status: computeProductStatus(newQty, stockProduct.minStock),
            },
          });

          await tx.stockMovement.create({
            data: {
              businessId: session.user.businessId,
              branchId: session.user.branchId,
              productId: stockProduct.id,
              userId: session.user.id,
              type: StockMovementType.RECEIVE,
              qty: qtyGood,
              note:
                stockProductId !== line.productId
                  ? `Received ${po.number} as ${stockProduct.name} (ordered ${line.product.name})`
                  : `Received ${po.number}`,
              refType: "PurchaseOrder",
              refId: po.id,
            },
          });

          addedCost += qtyGood * line.unitCost;
        }

        if (qtyRejected > 0) {
          await tx.stockMovement.create({
            data: {
              businessId: session.user.businessId,
              branchId: session.user.branchId,
              productId: line.productId,
              userId: session.user.id,
              type: StockMovementType.RETURN,
              qty: 0,
              note: `Rejected ${qtyRejected} on ${po.number}: ${lineIn.rejectReason || "quality/wrong item"}`,
              refType: "PurchaseOrder",
              refId: po.id,
            },
          });
        }

        // Rejected counts toward closing the ordered line (supplier short/wrong)
        await tx.purchaseOrderLine.update({
          where: { id: line.id },
          data: {
            qtyReceived: line.qtyReceived + qtyGood + qtyRejected,
            qtyRejected: line.qtyRejected + qtyRejected,
            rejectReason: lineIn.rejectReason || line.rejectReason,
          },
        });
      }

      const refreshed = await tx.purchaseOrderLine.findMany({
        where: { purchaseOrderId: po.id },
      });
      const allDone = refreshed.every((l) => l.qtyReceived >= l.qtyOrdered);
      const anyReceived = refreshed.some((l) => l.qtyReceived > 0);

      const updated = await tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          status: allDone ? "RECEIVED" : anyReceived ? "PARTIAL" : po.status,
          receivedAt: allDone ? new Date() : po.receivedAt,
          receivedById: session.user.id,
        },
      });

      if (addedCost > 0) {
        await tx.supplier.update({
          where: { id: po.supplierId },
          data: { balance: { increment: addedCost } },
        });

        await postReceiveJournal(tx, {
          businessId: session.user.businessId,
          poId: po.id,
          poNumber: po.number,
          inventoryCost: addedCost,
        });
      }

      return updated;
    });

    revalidatePath("/receive");
    revalidatePath("/purchasing");
    revalidatePath("/inventory");
    revalidatePath("/products");
    revalidatePath("/stock-check");
    revalidatePath("/accounting");
    revalidatePath("/dashboard");

    return { ok: true as const, number: result.number, status: result.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Receive failed";
    return { ok: false as const, error: message };
  }
}

export async function collectCustomerPayment(
  customerId: string,
  amount?: number,
  method: "CASH" | "CARD" | "MOMO" = "CASH",
) {
  const session = await requireSession();

  try {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId: session.user.businessId },
    });
    if (!customer) throw new Error("Customer not found");
    if (customer.balance <= 0) throw new Error("No outstanding balance");

    const pay = amount && amount > 0 ? Math.min(amount, customer.balance) : customer.balance;
    if (!Number.isInteger(pay) || pay <= 0) throw new Error("Enter a valid amount");

    const updated = await prisma.$transaction(async (tx) => {
      const cust = await tx.customer.update({
        where: { id: customer.id },
        data: { balance: { decrement: pay } },
      });

      await postCustomerPaymentJournal(tx, {
        businessId: session.user.businessId,
        customerId: customer.id,
        customerName: customer.name,
        amount: pay,
        method,
      });

      return cust;
    });

    revalidatePath("/quick-pay");
    revalidatePath("/customers");
    revalidatePath("/accounting");
    revalidatePath("/banking");
    revalidatePath("/dashboard");
    revalidatePath("/notifications");

    return {
      ok: true as const,
      paid: pay,
      remaining: updated.balance,
      customerName: customer.name,
      method,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment failed";
    return { ok: false as const, error: message };
  }
}

export async function getDebtors() {
  const session = await requireSession();
  const debtors = await prisma.customer.findMany({
    where: {
      businessId: session.user.businessId,
      balance: { gt: 0 },
      isActive: true,
    },
    include: {
      sales: {
        where: { status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true, total: true, number: true },
      },
    },
    orderBy: { balance: "desc" },
  });

  return debtors.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    segment: c.segment,
    type: c.type,
    balance: c.balance,
    lastSale: c.sales[0]
      ? {
          date: c.sales[0].createdAt.toISOString().slice(0, 10),
          total: c.sales[0].total,
          number: c.sales[0].number,
        }
      : null,
  }));
}

export async function lookupByBarcode(code: string) {
  const session = await requireSession();
  const normalized = code.trim().replace(/\s/g, "");
  const variants = [normalized];
  if (normalized.length === 12) variants.push(`0${normalized}`);
  if (normalized.length === 13 && normalized.startsWith("0")) variants.push(normalized.slice(1));

  const product = await prisma.product.findFirst({
    where: {
      businessId: session.user.businessId,
      OR: [{ barcode: { in: variants } }, { sku: { in: variants } }],
    },
  });

  if (!product) {
    return {
      status: "not_found" as const,
      code: normalized,
      message: `No product for barcode ${normalized}`,
    };
  }

  if (product.status === ProductStatus.INACTIVE) {
    return {
      status: "not_found" as const,
      code: normalized,
      message: `${product.name} is inactive — reactivate in Products`,
    };
  }

  const catalog = toCatalogProduct(product);
  if (product.stockQty <= 0) {
    return {
      status: "out_of_stock" as const,
      product: catalog,
      message: `${product.name} is out of stock`,
    };
  }

  return {
    status: "found" as const,
    product: catalog,
    message: `Found ${product.name} · ${product.stockQty} ${product.unit} left`,
  };
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysAgo(n: number) {
  const x = startOfDay();
  x.setDate(x.getDate() - n);
  return x;
}

export async function getDashboardData(periodInput?: string) {
  const session = await requireSession();
  const businessId = session.user.businessId;

  const allowed = new Set([
    "today",
    "yesterday",
    "this_week",
    "last_week",
    "this_month",
    "last_month",
    "ytd",
  ]);
  const period = isReportPeriodId(periodInput) && allowed.has(periodInput) ? periodInput : "today";
  const range = resolveReportRange(period);
  const priorId =
    period === "today"
      ? "yesterday"
      : period === "this_week"
        ? "last_week"
        : period === "this_month"
          ? "last_month"
          : period === "yesterday"
            ? "today"
            : period === "last_week"
              ? "this_week"
              : period === "last_month"
                ? "this_month"
                : "this_month";
  const priorRange = resolveReportRange(priorId as typeof period);

  const [periodSales, priorSales, products, customers, suppliers, recentSales, openPos, accounts] =
    await Promise.all([
      prisma.sale.findMany({
        where: {
          businessId,
          status: "COMPLETED",
          createdAt: { gte: range.start, lte: range.end },
        },
        include: { lines: true },
      }),
      prisma.sale.findMany({
        where: {
          businessId,
          status: "COMPLETED",
          createdAt: { gte: priorRange.start, lte: priorRange.end },
        },
        include: { lines: true },
      }),
      prisma.product.findMany({
        where: { businessId, status: { not: "INACTIVE" } },
      }),
      prisma.customer.findMany({
        where: { businessId, isActive: true },
        orderBy: { balance: "desc" },
      }),
      prisma.supplier.findMany({
        where: { businessId, isActive: true },
        orderBy: { balance: "desc" },
      }),
      prisma.sale.findMany({
        where: { businessId, status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { user: true, customer: true },
      }),
      prisma.purchaseOrder.count({
        where: {
          businessId,
          status: { in: ["ORDERED", "PARTIAL", "PENDING_APPROVAL"] },
        },
      }),
      (async () => {
        await ensureChartOfAccounts(prisma, businessId);
        return prisma.account.findMany({ where: { businessId } });
      })(),
    ]);

  const productById = new Map(products.map((p) => [p.id, p]));
  const cogsOf = (sale: { lines: { productId: string; qty: number }[] }) =>
    sale.lines.reduce((s, line) => s + (productById.get(line.productId)?.costPrice ?? 0) * line.qty, 0);

  const sumSales = (rows: typeof periodSales) => rows.reduce((s, x) => s + x.total, 0);
  const sumProfit = (rows: typeof periodSales) =>
    rows.reduce((s, sale) => s + (sale.total - sale.taxAmt - cogsOf(sale)), 0);

  const salesPeriod = sumSales(periodSales);
  const salesPrior = sumSales(priorSales);
  const profitPeriod = sumProfit(periodSales);
  const profitPrior = sumProfit(priorSales);
  const tickets = periodSales.length;
  const avgTicket = tickets > 0 ? Math.round(salesPeriod / tickets) : 0;
  const vatCollected = periodSales.reduce((s, x) => s + x.taxAmt, 0);

  const salesChange =
    salesPrior === 0
      ? salesPeriod > 0
        ? 100
        : 0
      : Math.round(((salesPeriod - salesPrior) / salesPrior) * 1000) / 10;
  const profitChange =
    profitPrior === 0
      ? profitPeriod > 0
        ? 100
        : 0
      : Math.round(((profitPeriod - profitPrior) / Math.abs(profitPrior)) * 1000) / 10;

  const cash = accounts.find((a) => a.code === "1000")?.balance ?? 0;
  const bank = accounts.find((a) => a.code === "1100")?.balance ?? 0;
  const momo = accounts.find((a) => a.code === "1200")?.balance ?? 0;
  const vat = accounts.find((a) => a.code === "2100")?.balance ?? 0;
  const liquid = cash + bank + momo;

  const inventoryValue = products.reduce((s, p) => s + p.stockQty * p.costPrice, 0);
  const lowStock = products.filter((p) => p.stockQty <= p.minStock);
  const outStock = products.filter((p) => p.stockQty <= 0);
  const customerDebts = customers.reduce((s, c) => s + c.balance, 0);
  const supplierPayables = suppliers.reduce((s, c) => s + c.balance, 0);
  const topDebtors = customers
    .filter((c) => c.balance > 0)
    .slice(0, 5)
    .map((c) => ({ id: c.id, name: c.name, balance: c.balance }));

  // Trend buckets
  const trend: { day: string; sales: number; profit: number }[] = [];
  if (range.trendMode === "hour") {
    for (let h = 0; h < 24; h++) {
      trend.push({ day: `${String(h).padStart(2, "0")}:00`, sales: 0, profit: 0 });
    }
    for (const sale of periodSales) {
      const i = sale.createdAt.getHours();
      trend[i].sales += sale.total;
      trend[i].profit += sale.total - sale.taxAmt - cogsOf(sale);
    }
  } else if (range.trendMode === "month") {
    const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const map = new Map<string, { day: string; sales: number; profit: number }>();
    const cursor = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
    while (cursor <= range.end) {
      const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
      map.set(key, { day: names[cursor.getMonth()], sales: 0, profit: 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    for (const sale of periodSales) {
      const key = `${sale.createdAt.getFullYear()}-${sale.createdAt.getMonth()}`;
      const row = map.get(key);
      if (!row) continue;
      row.sales += sale.total;
      row.profit += sale.total - sale.taxAmt - cogsOf(sale);
    }
    trend.push(...map.values());
  } else {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const map = new Map<string, { day: string; sales: number; profit: number }>();
    for (let d = new Date(range.start); d <= range.end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      const spanDays =
        (range.end.getTime() - range.start.getTime()) / (24 * 60 * 60 * 1000);
      const label =
        spanDays > 14
          ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
          : dayNames[d.getDay()];
      map.set(key, { day: label, sales: 0, profit: 0 });
    }
    for (const sale of periodSales) {
      const key = sale.createdAt.toISOString().slice(0, 10);
      const row = map.get(key);
      if (!row) continue;
      row.sales += sale.total;
      row.profit += sale.total - sale.taxAmt - cogsOf(sale);
    }
    trend.push(...map.values());
  }

  const factors = [
    {
      id: "sales",
      label: "Sales activity",
      ok: salesPeriod > 0,
      delta: salesPeriod > 0 ? 8 : 0,
      detail: salesPeriod > 0 ? `${tickets} tickets` : "No sales in period",
    },
    {
      id: "stock",
      label: "Stock levels",
      ok: lowStock.length === 0,
      delta: lowStock.length === 0 ? 6 : -Math.min(12, lowStock.length * 2),
      detail:
        lowStock.length === 0
          ? "All SKUs above minimum"
          : `${lowStock.length} low · ${outStock.length} out`,
    },
    {
      id: "liquidity",
      label: "Cash position",
      ok: liquid > 0,
      delta: liquid > 0 ? 6 : -5,
      detail: formatCurrency(liquid),
    },
    {
      id: "ar",
      label: "Receivables",
      ok: customerDebts <= inventoryValue * 0.2 || customerDebts === 0,
      delta: customerDebts < inventoryValue * 0.2 ? 4 : -4,
      detail: formatCurrency(customerDebts),
    },
    {
      id: "profit",
      label: "Gross profit",
      ok: profitPeriod >= 0,
      delta: profitPeriod > 0 ? 4 : profitPeriod < 0 ? -4 : 0,
      detail: formatCurrency(profitPeriod),
    },
  ];
  const healthScore = Math.max(
    35,
    Math.min(98, 70 + factors.reduce((s, f) => s + f.delta, 0)),
  );

  return {
    businessName: session.user.businessName,
    branchName: session.user.branchName,
    period: range.period,
    periodLabel: range.label,
    shortLabel: range.shortLabel,
    priorLabel: priorRange.shortLabel,
    healthScore,
    healthFactors: factors,
    salesToday: salesPeriod,
    salesPeriod,
    salesChange,
    profitToday: profitPeriod,
    profitPeriod,
    profitChange,
    tickets,
    avgTicket,
    vatCollected,
    cashBalance: cash + momo,
    cash,
    momo,
    bankBalance: bank,
    liquid,
    inventoryValue,
    lowStock: lowStock.map(toCatalogProduct),
    outStockCount: outStock.length,
    customerDebts,
    supplierPayables,
    vatPayable: vat,
    openPos,
    topDebtors,
    salesTrend: trend,
    recentActivity: recentSales.map((s) => ({
      id: s.id,
      number: s.number,
      title: `${s.number} · ${formatActivityMethod(s.paymentMethod)} · ${s.user.name}`,
      customer: s.customer?.name ?? "Walk-in",
      time: s.createdAt.toISOString(),
      total: s.total,
    })),
  };
}

function formatActivityMethod(m: string) {
  return m.replaceAll("_", " ");
}

export async function getAccountingData() {
  const session = await requireSession();
  const businessId = session.user.businessId;
  await ensureChartOfAccounts(prisma, businessId);

  const [accounts, journals, customers, suppliers] = await Promise.all([
    prisma.account.findMany({
      where: { businessId },
      orderBy: { code: "asc" },
    }),
    prisma.journalEntry.findMany({
      where: { businessId },
      include: {
        lines: {
          include: { account: { select: { code: true, name: true, type: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    prisma.customer.aggregate({
      where: { businessId },
      _sum: { balance: true },
    }),
    prisma.supplier.aggregate({
      where: { businessId },
      _sum: { balance: true },
    }),
  ]);

  const assets = accounts.filter((a) => a.type === "ASSET").reduce((s, a) => s + a.balance, 0);
  const liabilities = accounts
    .filter((a) => a.type === "LIABILITY")
    .reduce((s, a) => s + a.balance, 0);
  const equity = accounts.filter((a) => a.type === "EQUITY").reduce((s, a) => s + a.balance, 0);
  const revenue = accounts.filter((a) => a.type === "REVENUE").reduce((s, a) => s + a.balance, 0);
  const expenses = accounts.filter((a) => a.type === "EXPENSE").reduce((s, a) => s + a.balance, 0);

  return {
    accounts: accounts.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      balance: a.balance,
    })),
    accountOptions: accounts.map((a) => ({
      code: a.code,
      name: a.name,
      type: a.type,
    })),
    journals: journals.map((j) => ({
      id: j.id,
      number: j.number,
      description: j.description,
      status: j.status,
      refType: j.refType,
      date: j.createdAt.toISOString().slice(0, 10),
      time: j.createdAt.toISOString().slice(11, 16),
      amount: j.lines.reduce((s, l) => s + l.debit, 0),
      lines: j.lines.map((l) => ({
        code: l.account.code,
        name: l.account.name,
        type: l.account.type,
        debit: l.debit,
        credit: l.credit,
      })),
    })),
    totals: { assets, liabilities, equity, revenue, expenses },
    cash: accounts.find((a) => a.code === "1000")?.balance ?? 0,
    bank: accounts.find((a) => a.code === "1100")?.balance ?? 0,
    momo: accounts.find((a) => a.code === "1200")?.balance ?? 0,
    ar: customers._sum.balance ?? 0,
    ap: suppliers._sum.balance ?? 0,
    journalCount: journals.length,
  };
}

const manualJournalSchema = z.object({
  description: z.string().trim().min(3).max(200),
  lines: z
    .array(
      z.object({
        code: z.string().min(1),
        debit: z.number().int().nonnegative().default(0),
        credit: z.number().int().nonnegative().default(0),
      }),
    )
    .min(2)
    .max(12),
});

export async function createManualJournal(input: z.infer<typeof manualJournalSchema>) {
  const session = await requireSession();
  try {
    const data = manualJournalSchema.parse(input);
    for (const line of data.lines) {
      if (line.debit > 0 && line.credit > 0) {
        throw new Error("A line cannot have both debit and credit");
      }
      if (line.debit === 0 && line.credit === 0) {
        throw new Error("Each line needs a debit or credit amount");
      }
    }
    const debitSum = data.lines.reduce((s, l) => s + l.debit, 0);
    const creditSum = data.lines.reduce((s, l) => s + l.credit, 0);
    if (debitSum !== creditSum) {
      throw new Error(
        `Unbalanced: debit ${debitSum.toLocaleString()} ≠ credit ${creditSum.toLocaleString()}`,
      );
    }
    if (debitSum <= 0) throw new Error("Journal amount must be greater than zero");

    const journal = await prisma.$transaction(async (tx) => {
      return postJournal(tx, {
        businessId: session.user.businessId,
        description: data.description,
        refType: "Manual",
        lines: data.lines.map((l) => ({
          code: l.code,
          debit: l.debit || undefined,
          credit: l.credit || undefined,
        })),
      });
    });

    revalidatePath("/accounting");
    revalidatePath("/banking");
    revalidatePath("/dashboard");
    revalidatePath("/reports");
    revalidatePath("/tax");

    return {
      ok: true as const,
      number: journal?.number ?? null,
      id: journal?.id ?? null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not post journal";
    return { ok: false as const, error: message };
  }
}

export async function getTaxData(periodInput?: string) {
  const session = await requireSession();
  const businessId = session.user.businessId;
  await ensureChartOfAccounts(prisma, businessId);

  const period = isReportPeriodId(periodInput) ? periodInput : "this_month";
  const range = resolveReportRange(period);
  const { start, end } = range;

  const [sales, accounts, business, products] = await Promise.all([
    prisma.sale.findMany({
      where: {
        businessId,
        status: "COMPLETED",
        createdAt: { gte: start, lte: end },
      },
      include: {
        lines: { include: { product: { select: { name: true, sku: true, taxExempt: true, taxRate: true } } } },
        customer: { select: { name: true } },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.account.findMany({ where: { businessId } }),
    prisma.business.findUnique({ where: { id: businessId } }),
    prisma.product.findMany({
      where: { businessId, status: { not: "INACTIVE" } },
      select: { taxExempt: true, taxRate: true },
    }),
  ]);

  const vatRate = business?.vatRate ?? 0.18;
  const outputVat = sales.reduce((s, x) => s + x.taxAmt, 0);
  const grossSales = sales.reduce((s, x) => s + x.total, 0);
  const netSales = sales.reduce((s, x) => s + (x.total - x.taxAmt), 0);
  const discounts = sales.reduce((s, x) => s + x.discountAmt, 0);

  let taxableNet = 0;
  let exemptNet = 0;
  let zeroRatedNet = 0;
  for (const sale of sales) {
    for (const line of sale.lines) {
      const lineNet = line.lineTotal - line.taxAmt;
      if (line.product.taxExempt || line.taxAmt === 0) {
        if (line.product.taxExempt) exemptNet += lineNet;
        else zeroRatedNet += lineNet;
      } else {
        taxableNet += lineNet;
      }
    }
  }

  const vatPayable = accounts.find((a) => a.code === "2100")?.balance ?? 0;
  const inputVat = accounts.find((a) => a.code === "2200")?.balance ?? 0;

  const catalogStandard = products.filter((p) => !p.taxExempt && p.taxRate > 0).length;
  const catalogExempt = products.filter((p) => p.taxExempt).length;
  const catalogZero = products.filter((p) => !p.taxExempt && p.taxRate === 0).length;

  // Daily VAT buckets for chart/table
  const dayMap = new Map<string, { date: string; label: string; outputVat: number; netSales: number; tickets: number }>();
  for (let d = new Date(start); d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    dayMap.set(key, {
      date: key,
      label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      outputVat: 0,
      netSales: 0,
      tickets: 0,
    });
  }
  for (const sale of sales) {
    const key = sale.createdAt.toISOString().slice(0, 10);
    const row = dayMap.get(key);
    if (!row) continue;
    row.outputVat += sale.taxAmt;
    row.netSales += sale.total - sale.taxAmt;
    row.tickets += 1;
  }

  const monthEnd = new Date(end.getFullYear(), end.getMonth() + 1, 0);
  const filingHint =
    period === "this_month" || period === "last_month"
      ? `File VAT for ${range.shortLabel} by ${monthEnd.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} (+ local grace period).`
      : `Period ${range.label}. Ledger payable is cumulative — use monthly periods for filing.`;

  return {
    period: range.period,
    periodLabel: range.label,
    shortLabel: range.shortLabel,
    vatRate,
    outputVat,
    inputVat,
    netVat: Math.max(0, vatPayable),
    ledgerPayable: vatPayable,
    salesCount: sales.length,
    grossSales,
    netSales,
    discounts,
    taxableNet,
    exemptNet,
    zeroRatedNet,
    effectiveRate: netSales > 0 ? Math.round((outputVat / netSales) * 1000) / 10 : 0,
    catalog: {
      standard: catalogStandard,
      exempt: catalogExempt,
      zeroRated: catalogZero,
      ratePct: Math.round(vatRate * 100),
    },
    daily: [...dayMap.values()],
    register: sales.slice(0, 100).map((s) => ({
      id: s.id,
      number: s.number,
      date: s.createdAt.toISOString().slice(0, 10),
      time: s.createdAt.toISOString().slice(11, 16),
      customer: s.customer?.name ?? "Walk-in",
      cashier: s.user.name,
      net: s.total - s.taxAmt,
      tax: s.taxAmt,
      total: s.total,
      exemptLines: s.lines.filter((l) => l.product.taxExempt || l.taxAmt === 0).length,
      taxableLines: s.lines.filter((l) => !l.product.taxExempt && l.taxAmt > 0).length,
    })),
    filingHint,
  };
}

export async function getTaxExportRows(periodInput?: string) {
  const data = await getTaxData(periodInput);
  return {
    summary: [
      ["Period", data.periodLabel],
      ["VAT rate", `${Math.round(data.vatRate * 100)}%`],
      ["Gross sales (inc. VAT)", data.grossSales],
      ["Net sales", data.netSales],
      ["Taxable net", data.taxableNet],
      ["Exempt net", data.exemptNet],
      ["Zero-rated net", data.zeroRatedNet],
      ["Output VAT", data.outputVat],
      ["Input VAT (ledger)", data.inputVat],
      ["VAT payable (ledger)", data.ledgerPayable],
      ["Tickets", data.salesCount],
    ] as [string, string | number][],
    register: data.register,
    daily: data.daily,
  };
}

export async function getBankingData() {
  const session = await requireSession();
  const businessId = session.user.businessId;
  await ensureChartOfAccounts(prisma, businessId);

  const today = startOfDay();
  const [accounts, paymentsToday, journalLines] = await Promise.all([
    prisma.account.findMany({
      where: { businessId, code: { in: ["1000", "1100", "1200"] } },
      orderBy: { code: "asc" },
    }),
    prisma.salePayment.findMany({
      where: {
        sale: { businessId, createdAt: { gte: today }, status: "COMPLETED" },
        method: { not: "CREDIT" },
      },
    }),
    prisma.journalLine.findMany({
      where: {
        account: { businessId, code: { in: ["1000", "1100", "1200"] } },
      },
      include: {
        account: { select: { code: true, name: true } },
        journal: { select: { id: true, number: true, description: true, createdAt: true, refType: true } },
      },
      orderBy: { journal: { createdAt: "desc" } },
      take: 60,
    }),
  ]);

  const totalLiquid = accounts.reduce((s, a) => s + a.balance, 0);
  const todayOut = journalLines
    .filter(
      (l) =>
        l.journal.createdAt >= today &&
        l.credit > 0 &&
        (l.journal.refType === "CashOut" || l.journal.refType === "SupplierPayment"),
    )
    .reduce((s, l) => s + l.credit, 0);

  return {
    accounts: accounts.map((a) => ({
      code: a.code,
      name: a.name,
      balance: a.balance,
      type: a.code === "1000" ? "Cash" : a.code === "1200" ? "Mobile money" : "Bank",
    })),
    totalLiquid,
    todayIn: paymentsToday.reduce((s, p) => s + p.amount, 0),
    todayOut,
    cashbook: journalLines.map((l) => ({
      id: l.id,
      journalId: l.journal.id,
      number: l.journal.number,
      time: l.journal.createdAt.toISOString().slice(11, 16),
      date: l.journal.createdAt.toISOString().slice(0, 10),
      description: l.journal.description,
      account: l.account.name,
      code: l.account.code,
      refType: l.journal.refType,
      in: l.debit,
      out: l.credit,
    })),
  };
}

const transferSchema = z.object({
  fromCode: z.enum(["1000", "1100", "1200"]),
  toCode: z.enum(["1000", "1100", "1200"]),
  amount: z.number().int().positive(),
  note: z.string().trim().max(200).optional(),
});

export async function transferFunds(input: z.infer<typeof transferSchema>) {
  const session = await requireSession();
  try {
    const data = transferSchema.parse(input);
    if (data.fromCode === data.toCode) throw new Error("Choose two different accounts");

    await prisma.$transaction(async (tx) => {
      await ensureChartOfAccounts(tx, session.user.businessId);
      const from = await tx.account.findFirst({
        where: { businessId: session.user.businessId, code: data.fromCode },
      });
      if (!from) throw new Error("Source account not found");
      if (from.balance < data.amount) {
        throw new Error(
          `Insufficient balance in ${from.name} (${from.balance.toLocaleString()} RWF)`,
        );
      }
      await postTransferJournal(tx, {
        businessId: session.user.businessId,
        fromCode: data.fromCode,
        toCode: data.toCode,
        amount: data.amount,
        note: data.note,
      });
    });

    revalidatePath("/banking");
    revalidatePath("/accounting");
    revalidatePath("/dashboard");
    revalidatePath("/reports");
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transfer failed";
    return { ok: false as const, error: message };
  }
}

const cashOutSchema = z.object({
  fromCode: z.enum(["1000", "1100", "1200"]),
  amount: z.number().int().positive(),
  category: z.enum([
    "Rent",
    "Utilities",
    "Transport",
    "Supplies",
    "Wages",
    "Owner draw",
    "Other",
  ]),
  note: z.string().trim().max(200).optional(),
});

export async function recordCashOut(input: z.infer<typeof cashOutSchema>) {
  const session = await requireSession();
  try {
    const data = cashOutSchema.parse(input);

    await prisma.$transaction(async (tx) => {
      await ensureChartOfAccounts(tx, session.user.businessId);
      const from = await tx.account.findFirst({
        where: { businessId: session.user.businessId, code: data.fromCode },
      });
      if (!from) throw new Error("Account not found");
      if (from.balance < data.amount) {
        throw new Error(
          `Insufficient balance in ${from.name} (${from.balance.toLocaleString()} RWF)`,
        );
      }
      await postCashOutJournal(tx, {
        businessId: session.user.businessId,
        fromCode: data.fromCode,
        amount: data.amount,
        category: data.category,
        note: data.note,
      });
    });

    revalidatePath("/banking");
    revalidatePath("/accounting");
    revalidatePath("/dashboard");
    revalidatePath("/reports");
    revalidatePath("/tax");
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cash-out failed";
    return { ok: false as const, error: message };
  }
}

export type AppNotification = {
  id: string;
  title: string;
  detail?: string;
  time: string;
  type: "stock" | "approval" | "tax" | "payment" | "ai" | "cash";
  severity: "critical" | "warn" | "info";
  unread: boolean;
  href: string;
  actionLabel: string;
};

function relativeFrom(date: Date) {
  const mins = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

/** Live alerts derived from stock, POs, debts, and VAT — no separate notification store yet. */
export async function getNotifications(): Promise<AppNotification[]> {
  const session = await requireSession();
  const businessId = session.user.businessId;
  const now = new Date();
  const in30 = new Date(now);
  in30.setDate(in30.getDate() + 30);

  const [products, pendingPos, debtors, suppliers, accounts] = await Promise.all([
    prisma.product.findMany({
      where: { businessId, status: { not: "INACTIVE" } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.purchaseOrder.findMany({
      where: { businessId, status: "PENDING_APPROVAL" },
      include: { supplier: true },
      orderBy: { orderDate: "desc" },
      take: 10,
    }),
    prisma.customer.findMany({
      where: { businessId, isActive: true, balance: { gt: 0 } },
      orderBy: { balance: "desc" },
      take: 8,
    }),
    prisma.supplier.findMany({
      where: { businessId, isActive: true, balance: { gt: 0 } },
      orderBy: { balance: "desc" },
      take: 5,
    }),
    prisma.account.findMany({
      where: { businessId, code: { in: ["1000", "2100"] } },
    }),
  ]);

  const items: AppNotification[] = [];

  for (const p of products.filter((x) => x.stockQty <= 0)) {
    items.push({
      id: `oos-${p.id}`,
      title: `Out of stock: ${p.name}`,
      detail: `${p.sku} · reorder at least ${Math.max(p.minStock, 1)} ${p.unit}`,
      time: relativeFrom(p.updatedAt),
      type: "stock",
      severity: "critical",
      unread: true,
      href: `/inventory?product=${p.id}`,
      actionLabel: "Adjust / count",
    });
  }

  for (const p of products.filter((x) => x.stockQty > 0 && x.stockQty <= x.minStock).slice(0, 12)) {
    items.push({
      id: `low-${p.id}`,
      title: `Low stock: ${p.name}`,
      detail: `${p.stockQty} ${p.unit} left (min ${p.minStock})`,
      time: relativeFrom(p.updatedAt),
      type: "stock",
      severity: "warn",
      unread: true,
      href: `/inventory?product=${p.id}`,
      actionLabel: "Review stock",
    });
  }

  for (const p of products.filter(
    (x) => x.expiryDate && x.expiryDate <= in30 && x.expiryDate >= now && x.stockQty > 0,
  )) {
    const days = Math.ceil((p.expiryDate!.getTime() - now.getTime()) / 86_400_000);
    items.push({
      id: `exp-${p.id}`,
      title: `Expiry soon: ${p.name}`,
      detail: `${p.stockQty} ${p.unit} · ${days} day${days === 1 ? "" : "s"} left`,
      time: relativeFrom(p.updatedAt),
      type: "stock",
      severity: days <= 7 ? "critical" : "warn",
      unread: true,
      href: `/inventory?product=${p.id}`,
      actionLabel: "Open product",
    });
  }

  for (const po of pendingPos) {
    items.push({
      id: `po-${po.id}`,
      title: `${po.number} awaiting approval`,
      detail: `${po.supplier.name} · ${formatCurrency(po.totalCost)}`,
      time: relativeFrom(po.orderDate),
      type: "approval",
      severity: "warn",
      unread: true,
      href: `/purchasing?po=${po.id}`,
      actionLabel: "Review PO",
    });
  }

  for (const c of debtors.slice(0, 5)) {
    items.push({
      id: `ar-${c.id}`,
      title: `Customer debt: ${c.name}`,
      detail: `Outstanding ${formatCurrency(c.balance)} — collect at Counter → Customer pay`,
      time: relativeFrom(c.updatedAt),
      type: "payment",
      severity: c.balance > 200_000 ? "warn" : "info",
      unread: c.balance > 200_000,
      href: `/quick-pay?customer=${c.id}`,
      actionLabel: "Collect",
    });
  }

  for (const s of suppliers.slice(0, 3)) {
    items.push({
      id: `ap-${s.id}`,
      title: `Supplier payable: ${s.name}`,
      detail: formatCurrency(s.balance),
      time: relativeFrom(s.updatedAt),
      type: "payment",
      severity: "info",
      unread: false,
      href: `/purchasing?pay=${s.id}`,
      actionLabel: "Pay supplier",
    });
  }

  const vat = accounts.find((a) => a.code === "2100")?.balance ?? 0;
  if (vat > 0) {
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    items.push({
      id: "vat-filing",
      title: `VAT filing reminder — due ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
      detail: `VAT payable ${formatCurrency(vat)} on the ledger`,
      time: "This month",
      type: "tax",
      severity: "warn",
      unread: true,
      href: "/tax",
      actionLabel: "Open tax",
    });
  }

  const cash = accounts.find((a) => a.code === "1000")?.balance ?? 0;
  if (cash > 0 && cash < 100_000) {
    items.push({
      id: "cash-low",
      title: "Cash float running low",
      detail: `On-hand cash ${formatCurrency(cash)}`,
      time: "Live",
      type: "cash",
      severity: "critical",
      unread: true,
      href: "/banking",
      actionLabel: "Banking",
    });
  }

  const lowCount = products.filter((p) => p.stockQty <= p.minStock).length;
  if (lowCount >= 3) {
    items.push({
      id: "ai-reorder",
      title: "AI: Reorder recommendation ready",
      detail: `${lowCount} SKUs at or below minimum — review Inventory then raise a PO`,
      time: "Live",
      type: "ai",
      severity: "info",
      unread: false,
      href: "/procurement",
      actionLabel: "Create PO",
    });
  }

  const severityRank: Record<AppNotification["severity"], number> = {
    critical: 0,
    warn: 1,
    info: 2,
  };
  const typeRank: Record<AppNotification["type"], number> = {
    stock: 0,
    approval: 1,
    cash: 2,
    tax: 3,
    payment: 4,
    ai: 5,
  };

  return items.sort((a, b) => {
    if (a.unread !== b.unread) return a.unread ? -1 : 1;
    if (a.severity !== b.severity) return severityRank[a.severity] - severityRank[b.severity];
    return typeRank[a.type] - typeRank[b.type];
  });
}

export type GlobalSearchHit = {
  id: string;
  category:
    | "Pages"
    | "Products"
    | "Customers"
    | "Suppliers"
    | "Purchase orders"
    | "Sales"
    | "Users";
  title: string;
  subtitle: string;
  href: string;
};

/** Cross-module lookup for the topbar command palette (Ctrl/⌘K). */
export async function globalSearch(query: string): Promise<GlobalSearchHit[]> {
  const session = await requireSession();
  const q = query.trim();
  if (q.length < 1) return [];

  const businessId = session.user.businessId;
  const canManageUsers = session.user.role === "OWNER" || session.user.role === "MANAGER";
  const { allModules } = await import("@/lib/navigation");

  const pageHits: GlobalSearchHit[] = allModules
    .filter(
      (m) =>
        m.label.toLowerCase().includes(q.toLowerCase()) ||
        m.href.toLowerCase().includes(q.toLowerCase()),
    )
    .slice(0, 6)
    .map((m) => ({
      id: `page-${m.href}`,
      category: "Pages" as const,
      title: m.label,
      subtitle: m.href,
      href: m.href,
    }));

  const [products, customers, suppliers, purchaseOrders, sales, users] = await Promise.all([
    prisma.product.findMany({
      where: {
        businessId,
        OR: [
          { name: { contains: q } },
          { sku: { contains: q } },
          { barcode: { contains: q } },
          { category: { contains: q } },
          { brand: { contains: q } },
        ],
      },
      orderBy: { name: "asc" },
      take: 6,
    }),
    prisma.customer.findMany({
      where: {
        businessId,
        OR: [
          { name: { contains: q } },
          { phone: { contains: q } },
          { email: { contains: q } },
        ],
      },
      orderBy: { name: "asc" },
      take: 6,
    }),
    prisma.supplier.findMany({
      where: {
        businessId,
        OR: [
          { name: { contains: q } },
          { phone: { contains: q } },
          { email: { contains: q } },
          { category: { contains: q } },
        ],
      },
      orderBy: { name: "asc" },
      take: 5,
    }),
    prisma.purchaseOrder.findMany({
      where: {
        businessId,
        OR: [{ number: { contains: q } }, { supplier: { name: { contains: q } } }],
      },
      include: { supplier: { select: { name: true } } },
      orderBy: { orderDate: "desc" },
      take: 5,
    }),
    prisma.sale.findMany({
      where: {
        businessId,
        OR: [
          { number: { contains: q } },
          { customer: { name: { contains: q } } },
        ],
      },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    canManageUsers
      ? prisma.user.findMany({
          where: {
            businessId,
            OR: [
              { name: { contains: q } },
              { email: { contains: q } },
              ...(
                ["OWNER", "MANAGER", "CASHIER", "ACCOUNTANT", "STOREKEEPER"] as const
              ).some((r) => r.toLowerCase().includes(q.toLowerCase()))
                ? [
                    {
                      role: {
                        in: (
                          ["OWNER", "MANAGER", "CASHIER", "ACCOUNTANT", "STOREKEEPER"] as const
                        ).filter((r) => r.toLowerCase().includes(q.toLowerCase())),
                      },
                    },
                  ]
                : [],
            ],
          },
          orderBy: { name: "asc" },
          take: 5,
        })
      : Promise.resolve([]),
  ]);

  const hits: GlobalSearchHit[] = [
    ...pageHits,
    ...products.map((p) => ({
      id: `product-${p.id}`,
      category: "Products" as const,
      title: p.name,
      subtitle: `${p.sku} · ${p.stockQty} ${p.unit} · ${formatCurrency(p.sellPrice)}`,
      href: `/inventory?product=${p.id}`,
    })),
    ...customers.map((c) => ({
      id: `customer-${c.id}`,
      category: "Customers" as const,
      title: c.name,
      subtitle: [c.phone, c.email, c.balance > 0 ? `owes ${formatCurrency(c.balance)}` : null]
        .filter(Boolean)
        .join(" · "),
      href: `/customers?customer=${c.id}`,
    })),
    ...suppliers.map((s) => ({
      id: `supplier-${s.id}`,
      category: "Suppliers" as const,
      title: s.name,
      subtitle: [s.category, s.balance > 0 ? `payable ${formatCurrency(s.balance)}` : "Supplier"]
        .filter(Boolean)
        .join(" · "),
      href: `/purchasing?pay=${s.id}`,
    })),
    ...purchaseOrders.map((po) => ({
      id: `po-${po.id}`,
      category: "Purchase orders" as const,
      title: po.number,
      subtitle: `${po.supplier.name} · ${po.status} · ${formatCurrency(po.totalCost)}`,
      href: `/purchasing?po=${po.id}`,
    })),
    ...sales.map((s) => ({
      id: `sale-${s.id}`,
      category: "Sales" as const,
      title: s.number,
      subtitle: `${s.customer?.name ?? "Walk-in"} · ${formatCurrency(s.total)} · ${s.createdAt.toISOString().slice(0, 10)}`,
      href: `/reports`,
    })),
    ...users.map((u) => ({
      id: `user-${u.id}`,
      category: "Users" as const,
      title: u.name,
      subtitle: `${u.email} · ${u.role}${u.isActive ? "" : " · inactive"}`,
      href: `/users`,
    })),
  ];

  return hits;
}

export async function getReportsData(periodInput?: string) {
  const session = await requireSession();
  const businessId = session.user.businessId;
  await ensureChartOfAccounts(prisma, businessId);

  const period = isReportPeriodId(periodInput) ? periodInput : "this_month";
  const range = resolveReportRange(period);
  const { start, end } = range;

  const [sales, products, customers, suppliers, accounts, purchaseOrders, payments] =
    await Promise.all([
      prisma.sale.findMany({
        where: {
          businessId,
          status: "COMPLETED",
          createdAt: { gte: start, lte: end },
        },
        include: {
          lines: true,
          payments: true,
          user: true,
          customer: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.product.findMany({ where: { businessId } }),
      prisma.customer.findMany({
        where: { businessId, isActive: true },
        orderBy: { balance: "desc" },
      }),
      prisma.supplier.findMany({
        where: { businessId, isActive: true },
        orderBy: { balance: "desc" },
      }),
      prisma.account.findMany({ where: { businessId }, orderBy: { code: "asc" } }),
      prisma.purchaseOrder.findMany({
        where: {
          businessId,
          orderDate: { gte: start, lte: end },
        },
        include: { supplier: true, lines: true },
        orderBy: { orderDate: "desc" },
      }),
      prisma.salePayment.findMany({
        where: {
          sale: {
            businessId,
            status: "COMPLETED",
            createdAt: { gte: start, lte: end },
          },
        },
      }),
    ]);

  const productById = new Map(products.map((p) => [p.id, p]));
  const cogsOf = (sale: { lines: { productId: string; qty: number }[] }) =>
    sale.lines.reduce((s, line) => {
      const p = productById.get(line.productId);
      return s + (p?.costPrice ?? 0) * line.qty;
    }, 0);

  const grossSales = sales.reduce((s, x) => s + x.total, 0);
  const revenue = sales.reduce((s, x) => s + (x.total - x.taxAmt), 0);
  const cogs = sales.reduce((s, x) => s + cogsOf(x), 0);
  const vatCollected = sales.reduce((s, x) => s + x.taxAmt, 0);
  const discounts = sales.reduce((s, x) => s + x.discountAmt, 0);
  const grossProfit = revenue - cogs;
  const marginPct = revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : 0;
  const avgTicket = sales.length > 0 ? Math.round(grossSales / sales.length) : 0;
  const unitsSold = sales.reduce(
    (s, sale) => s + sale.lines.reduce((ls, l) => ls + l.qty, 0),
    0,
  );

  const inventoryValue = products.reduce((s, p) => s + p.stockQty * p.costPrice, 0);
  const lowStock = products.filter((p) => p.stockQty <= p.minStock);
  const ar = customers.reduce((s, c) => s + c.balance, 0);
  const ap = suppliers.reduce((s, c) => s + c.balance, 0);

  const paymentMixMap = new Map<string, number>();
  for (const p of payments) {
    paymentMixMap.set(p.method, (paymentMixMap.get(p.method) ?? 0) + p.amount);
  }
  // Fallback if no SalePayment rows
  if (paymentMixMap.size === 0) {
    for (const s of sales) {
      paymentMixMap.set(s.paymentMethod, (paymentMixMap.get(s.paymentMethod) ?? 0) + s.total);
    }
  }
  const paymentMix = [...paymentMixMap.entries()]
    .map(([method, amount]) => ({ method, amount }))
    .sort((a, b) => b.amount - a.amount);

  const cashierMap = new Map<
    string,
    { name: string; tickets: number; sales: number; profit: number }
  >();
  for (const sale of sales) {
    const cur = cashierMap.get(sale.userId) ?? {
      name: sale.user.name,
      tickets: 0,
      sales: 0,
      profit: 0,
    };
    cur.tickets += 1;
    cur.sales += sale.total;
    cur.profit += sale.total - sale.taxAmt - cogsOf(sale);
    cashierMap.set(sale.userId, cur);
  }
  const cashiers = [...cashierMap.values()].sort((a, b) => b.sales - a.sales);

  const productSales = new Map<
    string,
    { id: string; name: string; sku: string; category: string; qty: number; sales: number; cogs: number }
  >();
  for (const sale of sales) {
    for (const line of sale.lines) {
      const p = productById.get(line.productId);
      const cur = productSales.get(line.productId) ?? {
        id: line.productId,
        name: p?.name ?? "Unknown",
        sku: p?.sku ?? "—",
        category: p?.category ?? "—",
        qty: 0,
        sales: 0,
        cogs: 0,
      };
      cur.qty += line.qty;
      cur.sales += line.lineTotal;
      cur.cogs += (p?.costPrice ?? 0) * line.qty;
      productSales.set(line.productId, cur);
    }
  }
  const topProducts = [...productSales.values()]
    .map((p) => ({
      ...p,
      profit: p.sales - p.cogs,
      margin: p.sales > 0 ? Math.round(((p.sales - p.cogs) / p.sales) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.sales - a.sales);

  const categoryMap = new Map<string, { category: string; qty: number; sales: number }>();
  for (const p of topProducts) {
    const cur = categoryMap.get(p.category) ?? { category: p.category, qty: 0, sales: 0 };
    cur.qty += p.qty;
    cur.sales += p.sales;
    categoryMap.set(p.category, cur);
  }
  const categories = [...categoryMap.values()].sort((a, b) => b.sales - a.sales);

  // Trend buckets
  const trend: { label: string; revenue: number; expenses: number; tickets: number }[] = [];
  const pushBucket = (label: string, key: string, map: Map<string, (typeof trend)[0]>) => {
    if (!map.has(key)) map.set(key, { label, revenue: 0, expenses: 0, tickets: 0 });
  };

  if (range.trendMode === "hour") {
    const map = new Map<string, (typeof trend)[0]>();
    for (let h = 0; h < 24; h++) {
      const key = String(h).padStart(2, "0");
      pushBucket(`${key}:00`, key, map);
    }
    for (const sale of sales) {
      const key = String(sale.createdAt.getHours()).padStart(2, "0");
      const row = map.get(key)!;
      row.revenue += sale.total - sale.taxAmt;
      row.expenses += cogsOf(sale);
      row.tickets += 1;
    }
    trend.push(...map.values());
  } else if (range.trendMode === "day") {
    const map = new Map<string, (typeof trend)[0]>();
    for (let d = new Date(start); d <= end; d = addDaysLocal(d, 1)) {
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      pushBucket(label, key, map);
    }
    for (const sale of sales) {
      const key = sale.createdAt.toISOString().slice(0, 10);
      const row = map.get(key);
      if (!row) continue;
      row.revenue += sale.total - sale.taxAmt;
      row.expenses += cogsOf(sale);
      row.tickets += 1;
    }
    trend.push(...map.values());
  } else if (range.trendMode === "week") {
    const map = new Map<string, (typeof trend)[0]>();
    let weekStart = startOfWeekLocal(start);
    let i = 1;
    while (weekStart <= end) {
      const key = weekStart.toISOString().slice(0, 10);
      pushBucket(`W${i}`, key, map);
      weekStart = addDaysLocal(weekStart, 7);
      i += 1;
    }
    for (const sale of sales) {
      const ws = startOfWeekLocal(sale.createdAt);
      const key = ws.toISOString().slice(0, 10);
      const row = map.get(key);
      if (!row) continue;
      row.revenue += sale.total - sale.taxAmt;
      row.expenses += cogsOf(sale);
      row.tickets += 1;
    }
    trend.push(...map.values());
  } else {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const map = new Map<string, (typeof trend)[0]>();
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      pushBucket(monthNames[cursor.getMonth()], key, map);
      cursor.setMonth(cursor.getMonth() + 1);
    }
    for (const sale of sales) {
      const key = `${sale.createdAt.getFullYear()}-${String(sale.createdAt.getMonth() + 1).padStart(2, "0")}`;
      const row = map.get(key);
      if (!row) continue;
      row.revenue += sale.total - sale.taxAmt;
      row.expenses += cogsOf(sale);
      row.tickets += 1;
    }
    trend.push(...map.values());
  }

  const assets = accounts.filter((a) => a.type === "ASSET").reduce((s, a) => s + a.balance, 0);
  const liabilities = accounts
    .filter((a) => a.type === "LIABILITY")
    .reduce((s, a) => s + a.balance, 0);
  const equity = accounts.filter((a) => a.type === "EQUITY").reduce((s, a) => s + a.balance, 0);
  const vatPayable = accounts.find((a) => a.code === "2100")?.balance ?? 0;
  const cash = accounts.find((a) => a.code === "1000")?.balance ?? 0;
  const bank = accounts.find((a) => a.code === "1100")?.balance ?? 0;
  const momo = accounts.find((a) => a.code === "1200")?.balance ?? 0;

  const purchasesTotal = purchaseOrders.reduce((s, p) => s + p.totalCost, 0);

  return {
    period: range.period,
    periodLabel: range.label,
    shortLabel: range.shortLabel,
    rangeStart: start.toISOString(),
    rangeEnd: end.toISOString(),
    trendMode: range.trendMode,
    kpis: {
      grossSales,
      revenue,
      cogs,
      profit: grossProfit,
      marginPct,
      vatCollected,
      discounts,
      tickets: sales.length,
      unitsSold,
      avgTicket,
      purchasesTotal,
    },
    incomeStatement: [
      { label: "Gross sales (inc. VAT)", amount: grossSales },
      { label: "Less: VAT collected", amount: -vatCollected },
      { label: "Net sales revenue", amount: revenue },
      { label: "Discounts", amount: -discounts },
      { label: "Cost of goods sold", amount: -cogs },
      { label: "Gross profit", amount: grossProfit },
    ],
    trend: trend.map((t) => ({
      label: t.label,
      revenue: t.revenue,
      expenses: t.expenses,
      tickets: t.tickets,
    })),
    paymentMix,
    cashiers,
    topProducts: topProducts.slice(0, 25).map((p) => ({
      name: p.name,
      sku: p.sku,
      category: p.category,
      qty: p.qty,
      sales: p.sales,
      cogs: p.cogs,
      profit: p.sales - p.cogs,
      margin: p.margin,
    })),
    categories,
    salesRegister: sales.slice(0, 100).map((s) => ({
      id: s.id,
      number: s.number,
      date: s.createdAt.toISOString().slice(0, 10),
      time: s.createdAt.toISOString().slice(11, 16),
      cashier: s.user.name,
      customer: s.customer?.name ?? "Walk-in",
      method: s.paymentMethod,
      items: s.lines.reduce((n, l) => n + l.qty, 0),
      subtotal: s.subtotal,
      tax: s.taxAmt,
      total: s.total,
    })),
    purchases: purchaseOrders.map((po) => ({
      number: po.number,
      supplier: po.supplier.name,
      date: po.orderDate.toISOString().slice(0, 10),
      status: po.status.replaceAll("_", " "),
      lines: po.lines.length,
      total: po.totalCost,
    })),
    debtors: customers
      .filter((c) => c.balance > 0)
      .slice(0, 15)
      .map((c) => ({ id: c.id, name: c.name, segment: c.segment, balance: c.balance })),
    creditors: suppliers
      .filter((s) => s.balance > 0)
      .slice(0, 15)
      .map((s) => ({ id: s.id, name: s.name, category: s.category ?? "—", balance: s.balance })),
    inventory: {
      value: inventoryValue,
      skuCount: products.length,
      lowStock: lowStock.length,
      outOfStock: products.filter((p) => p.stockQty <= 0).length,
      lowStockItems: lowStock.slice(0, 12).map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        stock: p.stockQty,
        min: p.minStock,
        unit: p.unit,
      })),
    },
    balanceSheet: {
      assets,
      liabilities,
      equity,
      cash,
      bank,
      momo,
      inventoryValue,
      ar,
      ap,
      vatPayable,
    },
    trialBalance: accounts.map((a) => ({
      code: a.code,
      name: a.name,
      type: a.type,
      balance: a.balance,
    })),
    // legacy aliases used by BI / older callers
    revenue,
    expenses: cogs,
    profit: grossProfit,
    vatCollected,
    inventoryValue,
    ar,
    ap,
    assets,
    liabilities,
    equity,
    salesCountYtd: sales.length,
    salesCountMonth: sales.length,
    purchasesMonth: purchasesTotal,
    monthlyTrend: trend.map((t) => ({
      month: t.label,
      revenue: t.revenue,
      expenses: t.expenses,
    })),
    library: [
      { name: "Income Statement (P&L)", hint: formatCurrency(grossProfit) + " gross" },
      { name: "Sales register", hint: `${sales.length} tickets` },
      { name: "Payment mix", hint: `${paymentMix.length} methods` },
      { name: "Product profitability", hint: `${topProducts.length} SKUs sold` },
      { name: "Category performance", hint: `${categories.length} categories` },
      { name: "Cashier performance", hint: `${cashiers.length} staff` },
      { name: "VAT report", hint: formatCurrency(vatCollected) + " collected" },
      { name: "Purchase report", hint: formatCurrency(purchasesTotal) },
      { name: "Accounts receivable", hint: formatCurrency(ar) },
      { name: "Accounts payable", hint: formatCurrency(ap) },
      { name: "Inventory valuation", hint: formatCurrency(inventoryValue) },
      { name: "Trial balance", hint: `${accounts.length} accounts` },
    ],
  };
}

function addDaysLocal(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function startOfWeekLocal(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

export async function getBranchesData(periodInput?: string) {
  const session = await requireSession();
  const businessId = session.user.businessId;
  const period = isReportPeriodId(periodInput) ? periodInput : "this_month";
  const range = resolveReportRange(period);

  const [branches, sales, products, users] = await Promise.all([
    prisma.branch.findMany({
      where: { businessId },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
    prisma.sale.findMany({
      where: {
        businessId,
        status: "COMPLETED",
        createdAt: { gte: range.start, lte: range.end },
      },
      include: { lines: true },
    }),
    prisma.product.findMany({ where: { businessId } }),
    prisma.user.findMany({
      where: { businessId, isActive: true },
      select: { branchId: true },
    }),
  ]);

  const productById = new Map(products.map((p) => [p.id, p]));
  const inventoryValue = products.reduce((s, p) => s + p.stockQty * p.costPrice, 0);
  const lowStock = products.filter((p) => p.stockQty <= p.minStock).length;
  const staffByBranch = new Map<string, number>();
  for (const u of users) {
    if (!u.branchId) continue;
    staffByBranch.set(u.branchId, (staffByBranch.get(u.branchId) ?? 0) + 1);
  }

  const rows = branches.map((b) => {
    const branchSales = sales.filter((s) => s.branchId === b.id);
    const salesTotal = branchSales.reduce((s, x) => s + x.total, 0);
    const profit = branchSales.reduce((s, sale) => {
      const net = sale.total - sale.taxAmt;
      const cogs = sale.lines.reduce((ls, line) => {
        const p = productById.get(line.productId);
        return ls + (p?.costPrice ?? 0) * line.qty;
      }, 0);
      return s + (net - cogs);
    }, 0);

    const health = Math.max(
      45,
      Math.min(
        98,
        72 +
          (salesTotal > 0 ? 10 : 0) +
          (b.isDefault ? (lowStock === 0 ? 8 : -Math.min(10, lowStock * 2)) : 4) +
          (profit > 0 ? 6 : 0),
      ),
    );

    return {
      id: b.id,
      name: b.name,
      code: b.code,
      isDefault: b.isDefault,
      sales: salesTotal,
      profit,
      stock: inventoryValue,
      saleCount: branchSales.length,
      avgTicket: branchSales.length ? Math.round(salesTotal / branchSales.length) : 0,
      staffCount: staffByBranch.get(b.id) ?? 0,
      health,
    };
  });

  const groupSales = rows.reduce((s, b) => s + b.sales, 0);

  return {
    branches: rows.map((b) => ({
      ...b,
      salesShare: groupSales > 0 ? Math.round((b.sales / groupSales) * 1000) / 10 : 0,
    })),
    inventoryValue,
    lowStock,
    period: range.period,
    periodLabel: range.label,
    shortLabel: range.shortLabel,
    groupSales,
    groupProfit: rows.reduce((s, b) => s + b.profit, 0),
    groupStock: inventoryValue,
    groupTickets: rows.reduce((s, b) => s + b.saleCount, 0),
  };
}

function normalizeBranchCode(code: string) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

export async function createBranch(input: { name: string; code: string; makeDefault?: boolean }) {
  const session = await requireSession();
  const businessId = session.user.businessId;
  const name = input.name.trim();
  const code = normalizeBranchCode(input.code);
  if (!name) throw new Error("Branch name is required");
  if (code.length < 2) throw new Error("Code must be at least 2 letters/digits");

  const exists = await prisma.branch.findFirst({ where: { businessId, code } });
  if (exists) throw new Error(`Code ${code} is already used`);

  const branch = await prisma.$transaction(async (tx) => {
    if (input.makeDefault) {
      await tx.branch.updateMany({
        where: { businessId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.branch.create({
      data: {
        businessId,
        name,
        code,
        isDefault: !!input.makeDefault,
      },
    });
  });

  revalidatePath("/branches");
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true as const, id: branch.id };
}

export async function updateBranch(input: { id: string; name: string; code: string }) {
  const session = await requireSession();
  const businessId = session.user.businessId;
  const name = input.name.trim();
  const code = normalizeBranchCode(input.code);
  if (!name) throw new Error("Branch name is required");
  if (code.length < 2) throw new Error("Code must be at least 2 letters/digits");

  const branch = await prisma.branch.findFirst({ where: { id: input.id, businessId } });
  if (!branch) throw new Error("Branch not found");

  const clash = await prisma.branch.findFirst({
    where: { businessId, code, NOT: { id: input.id } },
  });
  if (clash) throw new Error(`Code ${code} is already used`);

  await prisma.branch.update({
    where: { id: input.id },
    data: { name, code },
  });

  revalidatePath("/branches");
  revalidatePath("/settings");
  return { ok: true as const };
}

export async function setDefaultBranch(branchId: string) {
  const session = await requireSession();
  const businessId = session.user.businessId;
  const branch = await prisma.branch.findFirst({ where: { id: branchId, businessId } });
  if (!branch) throw new Error("Branch not found");

  await prisma.$transaction([
    prisma.branch.updateMany({
      where: { businessId, isDefault: true },
      data: { isDefault: false },
    }),
    prisma.branch.update({
      where: { id: branchId },
      data: { isDefault: true },
    }),
  ]);

  revalidatePath("/branches");
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function getWarehouseData() {
  const session = await requireSession();
  const businessId = session.user.businessId;
  const now = new Date();
  const in30 = new Date(now);
  in30.setDate(in30.getDate() + 30);

  const [products, movements, openPos] = await Promise.all([
    prisma.product.findMany({
      where: { businessId, status: { not: "INACTIVE" } },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.stockMovement.findMany({
      where: { businessId },
      include: { product: true, user: true },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.purchaseOrder.findMany({
      where: { businessId, status: { in: ["ORDERED", "PARTIAL", "PENDING_APPROVAL"] } },
      include: { supplier: true, lines: true },
      orderBy: { orderDate: "desc" },
      take: 8,
    }),
  ]);

  const active = products.filter((p) => p.status !== "INACTIVE");
  const totalValue = active.reduce((s, p) => s + p.stockQty * p.costPrice, 0);
  const lowStock = active.filter((p) => p.stockQty > 0 && p.stockQty <= p.minStock);
  const outOfStock = active.filter((p) => p.stockQty <= 0);
  const expiringSoon = active.filter(
    (p) => p.expiryDate && p.expiryDate <= in30 && p.expiryDate >= now && p.stockQty > 0,
  );

  const byCategory = new Map<
    string,
    { name: string; skus: number; value: number; units: number; low: number; out: number }
  >();
  for (const p of active) {
    const cur = byCategory.get(p.category) ?? {
      name: p.category,
      skus: 0,
      value: 0,
      units: 0,
      low: 0,
      out: 0,
    };
    cur.skus += 1;
    cur.value += p.stockQty * p.costPrice;
    cur.units += p.stockQty;
    if (p.stockQty <= 0) cur.out += 1;
    else if (p.stockQty <= p.minStock) cur.low += 1;
    byCategory.set(p.category, cur);
  }

  const maxVal = Math.max(...[...byCategory.values()].map((x) => x.value), 1);
  const zones = [...byCategory.values()]
    .sort((a, b) => b.value - a.value)
    .map((z, i) => ({
      id: `Z-${i + 1}`,
      name: z.name,
      skus: z.skus,
      value: z.value,
      units: z.units,
      low: z.low,
      out: z.out,
      utilization: Math.min(98, Math.round((z.value / maxVal) * 85 + 10)),
      share: totalValue > 0 ? Math.round((z.value / totalValue) * 1000) / 10 : 0,
    }));

  const pickList = [...lowStock, ...outOfStock]
    .sort((a, b) => a.stockQty - b.stockQty)
    .slice(0, 12)
    .map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category,
      stockQty: p.stockQty,
      minStock: p.minStock,
      unit: p.unit,
      reorderQty: Math.max(p.minStock * 2 - p.stockQty, p.minStock || 1),
      status: p.stockQty <= 0 ? "out" : "low",
    }));

  return {
    zones,
    totalSkus: active.length,
    totalValue,
    totalUnits: active.reduce((s, p) => s + p.stockQty, 0),
    openReceives: openPos.length,
    lowStockCount: lowStock.length,
    outOfStockCount: outOfStock.length,
    expiringCount: expiringSoon.length,
    products: active.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      category: p.category,
      stockQty: p.stockQty,
      minStock: p.minStock,
      unit: p.unit,
      value: p.stockQty * p.costPrice,
      location: `${p.category} · ${p.sku.slice(0, 4)}`,
      status:
        p.stockQty <= 0 ? "out" : p.stockQty <= p.minStock ? "low" : ("ok" as "out" | "low" | "ok"),
    })),
    pickList,
    movements: movements.map((m) => ({
      id: m.id,
      productId: m.productId,
      product: m.product.name,
      sku: m.product.sku,
      type: m.type,
      qty: m.qty,
      note: m.note,
      user: m.user?.name ?? "System",
      time: m.createdAt.toISOString(),
    })),
    inbound: openPos.map((po) => {
      const lines = po.lines.length;
      const received = po.lines.reduce((s, l) => s + l.qtyReceived, 0);
      const ordered = po.lines.reduce((s, l) => s + l.qtyOrdered, 0);
      return {
        id: po.id,
        number: po.number,
        supplier: po.supplier.name,
        status: po.status,
        total: po.totalCost,
        lines,
        progress: ordered > 0 ? Math.round((received / ordered) * 100) : 0,
        orderDate: po.orderDate.toISOString().slice(0, 10),
      };
    }),
  };
}

export async function getPurchasingData() {
  const session = await requireSession();
  const businessId = session.user.businessId;

  const [suppliers, orders] = await Promise.all([
    prisma.supplier.findMany({
      where: { businessId, isActive: true },
      orderBy: { balance: "desc" },
    }),
    prisma.purchaseOrder.findMany({
      where: { businessId },
      include: {
        supplier: true,
        lines: true,
      },
      orderBy: { orderDate: "desc" },
      take: 40,
    }),
  ]);

  const orderCountBySupplier = new Map<string, number>();
  for (const po of orders) {
    orderCountBySupplier.set(po.supplierId, (orderCountBySupplier.get(po.supplierId) ?? 0) + 1);
  }

  return {
    suppliers: suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category ?? "General",
      phone: s.phone,
      email: s.email,
      balance: s.balance,
      rating: s.rating,
      leadDays: s.leadDays,
      orders: orderCountBySupplier.get(s.id) ?? 0,
    })),
    purchaseOrders: orders.map((po) => ({
      id: po.id,
      number: po.number,
      supplier: po.supplier.name,
      supplierId: po.supplierId,
      date: po.orderDate.toISOString().slice(0, 10),
      items: po.lines.length,
      total: po.totalCost,
      status: po.status.replaceAll("_", " "),
      rawStatus: po.status,
      cancellable: ["DRAFT", "PENDING_APPROVAL", "ORDERED"].includes(po.status),
    })),
    openCount: orders.filter((po) =>
      ["ORDERED", "PARTIAL", "PENDING_APPROVAL"].includes(po.status),
    ).length,
    payableTotal: suppliers.reduce((s, x) => s + x.balance, 0),
  };
}

export async function getCustomersData(opts?: { includeInactive?: boolean }) {
  const session = await requireSession();
  const businessId = session.user.businessId;

  const customers = await prisma.customer.findMany({
    where: {
      businessId,
      ...(opts?.includeInactive ? {} : { isActive: true }),
    },
    include: {
      sales: {
        where: { status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          total: true,
          taxAmt: true,
          discountAmt: true,
          paymentMethod: true,
          number: true,
        },
      },
    },
    orderBy: [{ balance: "desc" }, { name: "asc" }],
  });

  return {
    customers: customers.map((c) => {
      const lifetime = c.sales.reduce((s, sale) => s + sale.total, 0);
      const last = c.sales[0];
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        type: c.type,
        segment: c.segment,
        balance: c.balance,
        points: c.points,
        isActive: c.isActive,
        saleCount: c.sales.length,
        lifetime,
        lastPurchase: last?.createdAt.toISOString().slice(0, 10) ?? "—",
        lastTotal: last?.total ?? 0,
      };
    }),
    debtTotal: customers.reduce((s, c) => s + c.balance, 0),
    withDebt: customers.filter((c) => c.balance > 0).length,
  };
}

export async function getCustomerStatement(customerId: string) {
  const session = await requireSession();
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId: session.user.businessId },
    include: {
      sales: {
        where: { status: "COMPLETED" },
        include: {
          lines: { include: { product: { select: { name: true, sku: true } } } },
          payments: true,
          user: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });
  if (!customer) return null;

  const lifetime = customer.sales.reduce((s, sale) => s + sale.total, 0);
  const creditSales = customer.sales.filter((s) =>
    s.payments.some((p) => p.method === "CREDIT") || s.paymentMethod === "CREDIT",
  );

  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    type: customer.type,
    segment: customer.segment,
    balance: customer.balance,
    points: customer.points,
    lifetime,
    saleCount: customer.sales.length,
    sales: customer.sales.map((s) => ({
      id: s.id,
      number: s.number,
      date: s.createdAt.toISOString().slice(0, 10),
      time: s.createdAt.toISOString().slice(11, 16),
      cashier: s.user.name,
      method: s.paymentMethod,
      subtotal: s.subtotal,
      discount: s.discountAmt,
      tax: s.taxAmt,
      total: s.total,
      payments: s.payments.map((p) => ({ method: p.method, amount: p.amount })),
      lines: s.lines.map((l) => ({
        name: l.product.name,
        sku: l.product.sku,
        qty: l.qty,
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal,
      })),
    })),
    creditTicketCount: creditSales.length,
  };
}

export async function getProcurementData() {
  const session = await requireSession();
  const businessId = session.user.businessId;

  const [products, suppliers] = await Promise.all([
    prisma.product.findMany({
      where: { businessId, status: { not: "INACTIVE" } },
      orderBy: { name: "asc" },
    }),
    prisma.supplier.findMany({
      where: { businessId, isActive: true },
      orderBy: { rating: "desc" },
    }),
  ]);

  const low = products.filter((p) => p.stockQty <= p.minStock);
  const recommendations = low.map((p, i) => {
    const suggestedQty = Math.max(p.minStock * 2 - p.stockQty, p.minStock || 1);
    const supplier = suppliers[i % Math.max(suppliers.length, 1)];
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      stock: p.stockQty,
      minStock: p.minStock,
      unit: p.unit,
      suggestedQty,
      supplier: supplier?.name ?? "Unassigned",
      supplierId: supplier?.id ?? null,
      estCost: suggestedQty * p.costPrice,
      urgency: p.stockQty <= 0 ? "critical" : "low",
    };
  });

  return {
    recommendations,
    supplierOptions: suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      rating: s.rating,
      leadDays: s.leadDays,
      category: s.category ?? "General",
    })),
    estTotal: recommendations.reduce((s, r) => s + r.estCost, 0),
  };
}

function loyaltyTierOf(pts: number) {
  return pts >= 1500 ? ("Gold" as const) : pts >= 500 ? ("Silver" as const) : ("Bronze" as const);
}

/** Rough redeem value: 100 pts ≈ 1,000 RWF */
function loyaltyPointsValue(pts: number) {
  return Math.floor(pts / 100) * 1000;
}

export async function getLoyaltyData() {
  const session = await requireSession();
  const customers = await prisma.customer.findMany({
    where: { businessId: session.user.businessId, isActive: true },
    include: {
      sales: {
        where: { status: "COMPLETED" },
        select: { total: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      _count: { select: { sales: { where: { status: "COMPLETED" } } } },
    },
    orderBy: { points: "desc" },
  });

  const pointsIssued = customers.reduce((s, c) => s + c.points, 0);
  const redeemableValue = loyaltyPointsValue(pointsIssued);

  const tiers = {
    Bronze: customers.filter((c) => loyaltyTierOf(c.points) === "Bronze").length,
    Silver: customers.filter((c) => loyaltyTierOf(c.points) === "Silver").length,
    Gold: customers.filter((c) => loyaltyTierOf(c.points) === "Gold").length,
  };

  const members = customers.map((c) => {
    const pts = c.points;
    const tier = loyaltyTierOf(pts);
    const nextAt = tier === "Bronze" ? 500 : tier === "Silver" ? 1500 : null;
    const progress =
      tier === "Gold"
        ? 100
        : tier === "Silver"
          ? Math.min(100, Math.round(((pts - 500) / 1000) * 100))
          : Math.min(100, Math.round((pts / 500) * 100));

    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      segment: c.segment,
      type: c.type,
      points: pts,
      tier,
      balance: c.balance,
      saleCount: c._count.sales,
      lastPurchase: c.sales[0]?.createdAt.toISOString().slice(0, 10) ?? null,
      redeemValue: loyaltyPointsValue(pts),
      nextTierAt: nextAt,
      ptsToNext: nextAt != null ? Math.max(0, nextAt - pts) : 0,
      progress,
    };
  });

  return {
    memberCount: customers.length,
    pointsIssued,
    redeemableValue,
    membersWithPoints: customers.filter((c) => c.points > 0).length,
    tiers,
    members,
    topMembers: members.slice(0, 10),
    rules: {
      earnRate: "1 point per 1,000 RWF paid (cash, card, MoMo — not credit)",
      redeemRate: "100 points = 1,000 RWF store credit (applied to customer balance + ledger)",
      tiers: [
        { name: "Bronze", range: "0–499 pts", perk: "1% rewards" },
        { name: "Silver", range: "500–1,499 pts", perk: "2% rewards" },
        { name: "Gold", range: "1,500+ pts", perk: "4% rewards + birthday offer" },
      ],
    },
  };
}

export async function adjustLoyaltyPoints(input: {
  customerId: string;
  /** Positive = award, negative = redeem/deduct */
  delta: number;
  reason?: string;
}) {
  const session = await requireSession();
  const delta = Math.trunc(input.delta);
  if (!delta) throw new Error("Enter a non-zero points change");
  if (Math.abs(delta) > 100_000) throw new Error("Change too large");

  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, businessId: session.user.businessId, isActive: true },
  });
  if (!customer) throw new Error("Customer not found");

  const next = customer.points + delta;
  if (next < 0) throw new Error(`Only ${customer.points} points available`);

  await prisma.customer.update({
    where: { id: customer.id },
    data: { points: next },
  });

  revalidatePath("/loyalty");
  revalidatePath("/customers");
  revalidatePath("/pos");

  return {
    ok: true as const,
    points: next,
    tier: loyaltyTierOf(next),
    customerName: customer.name,
    delta,
    reason: input.reason?.trim() || (delta > 0 ? "Manual award" : "Redeemed"),
  };
}

export async function redeemLoyaltyPoints(input: {
  customerId: string;
  points: number;
  reason?: string;
}) {
  const session = await requireSession();
  const businessId = session.user.businessId;
  const pts = Math.trunc(input.points);
  if (pts <= 0) throw new Error("Redeem amount must be positive");
  if (pts % 100 !== 0) throw new Error("Redeem in multiples of 100 points");

  const creditValue = loyaltyPointsValue(pts);
  if (creditValue <= 0) throw new Error("Not enough points for store credit");

  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, businessId, isActive: true },
  });
  if (!customer) throw new Error("Customer not found");
  if (customer.points < pts) throw new Error(`Only ${customer.points} points available`);

  const reason = input.reason?.trim() || `Redeemed ${pts} pts → ${formatCurrency(creditValue)} store credit`;

  await prisma.$transaction(async (tx) => {
    await ensureChartOfAccounts(tx, businessId);
    await tx.customer.update({
      where: { id: customer.id },
      data: {
        points: { decrement: pts },
        // Store credit reduces AR (debt) or builds prepaid credit (negative balance)
        balance: { decrement: creditValue },
      },
    });
    await postLoyaltyRedeemJournal(tx, {
      businessId,
      customerId: customer.id,
      customerName: customer.name,
      amount: creditValue,
      points: pts,
    });
  });

  const updated = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });

  revalidatePath("/loyalty");
  revalidatePath("/customers");
  revalidatePath("/quick-pay");
  revalidatePath("/accounting");
  revalidatePath("/pos");

  return {
    ok: true as const,
    points: updated.points,
    balance: updated.balance,
    creditValue,
    tier: loyaltyTierOf(updated.points),
    customerName: customer.name,
    reason,
  };
}

export async function getBiData(periodInput?: string) {
  const period = isReportPeriodId(periodInput) ? periodInput : "this_month";
  const [reports, branches] = await Promise.all([
    getReportsData(period),
    getBranchesData(period),
  ]);

  const marginPct =
    reports.revenue > 0
      ? Math.round((reports.profit / reports.revenue) * 1000) / 10
      : 0;

  return {
    period: reports.period,
    periodLabel: reports.periodLabel,
    shortLabel: reports.shortLabel,
    revenue: reports.revenue,
    profit: reports.profit,
    expenses: reports.expenses,
    marginPct,
    inventoryValue: reports.inventoryValue,
    tickets: reports.kpis.tickets,
    avgTicket: reports.kpis.avgTicket,
    vatCollected: reports.kpis.vatCollected,
    trend: reports.trend,
    monthlyTrend: reports.monthlyTrend,
    topProducts: reports.topProducts.slice(0, 12),
    categories: reports.categories.slice(0, 10),
    paymentMix: reports.paymentMix,
    cashiers: reports.cashiers,
    branches: branches.branches,
  };
}

export async function getSecurityData() {
  const session = await requireSession();
  const { canViewSecurity } = await import("@/lib/rbac");
  if (!canViewSecurity(session.user.role)) {
    throw new Error("Security is limited to Owner and Manager");
  }
  const businessId = session.user.businessId;

  const [users, branches, sales, journals, movements, voids] = await Promise.all([
    prisma.user.findMany({
      where: { businessId },
      include: { branch: true },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    prisma.branch.findMany({
      where: { businessId },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
    prisma.sale.findMany({
      where: { businessId },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.journalEntry.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.stockMovement.findMany({
      where: { businessId },
      include: { user: true, product: true },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.sale.findMany({
      where: { businessId, status: "VOIDED" },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  type AuditRow = {
    id: string;
    user: string;
    action: string;
    time: string;
    date: string;
    risk: "Low" | "Medium" | "High";
    at: number;
    category: "sale" | "void" | "journal" | "stock";
  };

  const logs: AuditRow[] = [];

  for (const s of sales) {
    logs.push({
      id: `sale-${s.id}`,
      user: s.user.name,
      action: `Sale ${s.number} · ${formatCurrency(s.total)} · ${s.paymentMethod}`,
      time: s.createdAt.toISOString().slice(11, 16),
      date: s.createdAt.toISOString().slice(0, 10),
      risk: s.total >= 500_000 ? "Medium" : "Low",
      at: s.createdAt.getTime(),
      category: "sale",
    });
  }
  for (const v of voids) {
    logs.push({
      id: `void-${v.id}`,
      user: v.user.name,
      action: `Voided sale ${v.number} · ${formatCurrency(v.total)}`,
      time: v.createdAt.toISOString().slice(11, 16),
      date: v.createdAt.toISOString().slice(0, 10),
      risk: "High",
      at: v.createdAt.getTime(),
      category: "void",
    });
  }
  for (const j of journals) {
    const high =
      j.refType === "CashOut" ||
      j.refType === "Payroll" ||
      j.description.toLowerCase().includes("manual");
    logs.push({
      id: `je-${j.id}`,
      user: "System",
      action: `Journal ${j.number}: ${j.description}`,
      time: j.createdAt.toISOString().slice(11, 16),
      date: j.createdAt.toISOString().slice(0, 10),
      risk: high ? "Medium" : "Low",
      at: j.createdAt.getTime(),
      category: "journal",
    });
  }
  for (const m of movements) {
    logs.push({
      id: `mv-${m.id}`,
      user: m.user?.name ?? "System",
      action: `${m.type} ${m.qty > 0 ? "+" : ""}${m.qty} × ${m.product.name}${m.note ? ` · ${m.note}` : ""}`,
      time: m.createdAt.toISOString().slice(11, 16),
      date: m.createdAt.toISOString().slice(0, 10),
      risk: m.type === "ADJUSTMENT" ? "Medium" : "Low",
      at: m.createdAt.getTime(),
      category: "stock",
    });
  }

  logs.sort((a, b) => b.at - a.at);
  const audit = logs.slice(0, 50);

  const roleCounts = users.reduce(
    (acc, u) => {
      acc[u.role] = (acc[u.role] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const highRisk = audit.filter((a) => a.risk === "High").length;
  const mediumRisk = audit.filter((a) => a.risk === "Medium").length;

  return {
    meId: session.user.id,
    meRole: session.user.role,
    canManage: session.user.role === "OWNER" || session.user.role === "MANAGER",
    activeUsers: users.filter((u) => u.isActive).length,
    totalUsers: users.length,
    highRisk,
    mediumRisk,
    roleCounts,
    branches: branches.map((b) => ({ id: b.id, name: b.name, code: b.code })),
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      branchId: u.branchId,
      branch: u.branch?.name ?? "—",
      active: u.isActive,
      createdAt: u.createdAt.toISOString().slice(0, 10),
    })),
    audit,
  };
}

const ROLES = ["OWNER", "MANAGER", "CASHIER", "ACCOUNTANT", "STOREKEEPER"] as const;

function assertCanManageUsers(role: string) {
  if (role !== "OWNER" && role !== "MANAGER") {
    throw new Error("Only Owner or Manager can manage users");
  }
}

export async function createSecurityUser(input: {
  name: string;
  email: string;
  password: string;
  role: (typeof ROLES)[number];
  branchId?: string | null;
}) {
  const session = await requireSession();
  assertCanManageUsers(session.user.role);
  const businessId = session.user.businessId;

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (name.length < 2) throw new Error("Name is required");
  if (!email.includes("@")) throw new Error("Valid email is required");
  if (input.password.length < 6) throw new Error("Password must be at least 6 characters");
  if (!ROLES.includes(input.role)) throw new Error("Invalid role");
  if (session.user.role === "MANAGER" && input.role === "OWNER") {
    throw new Error("Managers cannot create Owner accounts");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("Email already in use");

  if (input.branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: input.branchId, businessId },
    });
    if (!branch) throw new Error("Branch not found");
  }

  const { hash } = await import("bcryptjs");
  const { defaultSalaryForRole } = await import("@/lib/rbac");
  const user = await prisma.user.create({
    data: {
      businessId,
      name,
      email,
      passwordHash: await hash(input.password, 10),
      role: input.role,
      branchId: input.branchId || null,
      isActive: true,
      salaryMonthly: defaultSalaryForRole(input.role),
      termsAcceptedAt: new Date(),
    },
  });

  revalidatePath("/security");
  revalidatePath("/users");
  revalidatePath("/payroll");
  revalidatePath("/settings");
  return { ok: true as const, id: user.id };
}

export async function updateSecurityUser(input: {
  id: string;
  name: string;
  role: (typeof ROLES)[number];
  branchId?: string | null;
  isActive: boolean;
}) {
  const session = await requireSession();
  assertCanManageUsers(session.user.role);
  const businessId = session.user.businessId;

  const name = input.name.trim();
  if (name.length < 2) throw new Error("Name is required");
  if (!ROLES.includes(input.role)) throw new Error("Invalid role");

  const target = await prisma.user.findFirst({
    where: { id: input.id, businessId },
  });
  if (!target) throw new Error("User not found");

  if (session.user.role === "MANAGER" && (target.role === "OWNER" || input.role === "OWNER")) {
    throw new Error("Managers cannot change Owner accounts");
  }

  if (target.id === session.user.id && !input.isActive) {
    throw new Error("You cannot deactivate your own account");
  }

  if (target.role === "OWNER" && (input.role !== "OWNER" || !input.isActive)) {
    const owners = await prisma.user.count({
      where: { businessId, role: "OWNER", isActive: true },
    });
    if (owners <= 1) throw new Error("Keep at least one active Owner");
  }

  if (input.branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: input.branchId, businessId },
    });
    if (!branch) throw new Error("Branch not found");
  }

  await prisma.user.update({
    where: { id: target.id },
    data: {
      name,
      role: input.role,
      branchId: input.branchId || null,
      isActive: input.isActive,
    },
  });

  revalidatePath("/security");
  revalidatePath("/users");
  revalidatePath("/payroll");
  revalidatePath("/settings");
  return { ok: true as const };
}

export async function resetSecurityUserPassword(input: {
  id: string;
  newPassword: string;
}) {
  const session = await requireSession();
  assertCanManageUsers(session.user.role);
  if (input.newPassword.length < 8) throw new Error("Password must be at least 8 characters");

  const target = await prisma.user.findFirst({
    where: { id: input.id, businessId: session.user.businessId },
  });
  if (!target) throw new Error("User not found");
  if (session.user.role === "MANAGER" && target.role === "OWNER") {
    throw new Error("Managers cannot reset Owner passwords");
  }

  const { hash } = await import("bcryptjs");
  await prisma.user.update({
    where: { id: target.id },
    data: { passwordHash: await hash(input.newPassword, 10) },
  });

  // Invalidate open reset links after admin sets a password
  await prisma.passwordReset.updateMany({
    where: { userId: target.id, usedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  revalidatePath("/security");
  revalidatePath("/users");
  return { ok: true as const };
}

/** Admin: create a one-time password reset link (email if SMTP configured). */
export async function createPasswordResetLink(input: {
  userId: string;
  appOrigin?: string;
}) {
  const session = await requireSession();
  assertCanManageUsers(session.user.role);
  const businessId = session.user.businessId;

  const target = await prisma.user.findFirst({
    where: { id: input.userId, businessId },
  });
  if (!target) throw new Error("User not found");
  if (!target.isActive) throw new Error("User is inactive");
  if (session.user.role === "MANAGER" && target.role === "OWNER") {
    throw new Error("Managers cannot reset Owner passwords");
  }

  const { generateInviteToken, hashInviteToken, resetExpiryDate } = await import(
    "@/lib/invite-utils"
  );
  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = resetExpiryDate(24);

  await prisma.passwordReset.updateMany({
    where: { userId: target.id, usedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  const reset = await prisma.passwordReset.create({
    data: {
      businessId,
      userId: target.id,
      tokenHash,
      createdById: session.user.id,
      expiresAt,
    },
  });

  const origin =
    input.appOrigin?.replace(/\/$/, "") ||
    process.env.AUTH_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";
  const resetUrl = `${origin}/reset/${token}`;

  const { resetEmailBody, sendAppEmail } = await import("@/lib/mail");
  const body = resetEmailBody({ name: target.name, resetUrl });
  const delivery = await sendAppEmail({
    to: target.email,
    subject: body.subject,
    text: body.text,
  });

  console.info(
    `[RBIAP password reset] ${target.email} → ${resetUrl}${delivery.emailed ? " (emailed)" : ""}`,
  );

  revalidatePath("/users");
  revalidatePath("/security");

  return {
    ok: true as const,
    resetId: reset.id,
    email: target.email,
    name: target.name,
    expiresAt: expiresAt.toISOString(),
    resetUrl,
    emailed: delivery.emailed,
    mailError: delivery.mailError ?? null,
    mailtoHref: `mailto:${encodeURIComponent(target.email)}?subject=${encodeURIComponent(
      body.subject,
    )}&body=${encodeURIComponent(body.text)}`,
  };
}

/** Public — preview reset without signing in. */
export async function getPasswordResetPreview(token: string) {
  const { hashInviteToken } = await import("@/lib/invite-utils");
  const tokenHash = hashInviteToken(token.trim());
  const reset = await prisma.passwordReset.findUnique({
    where: { tokenHash },
    include: {
      user: { select: { name: true, email: true, isActive: true } },
      business: { select: { name: true } },
    },
  });

  if (!reset || reset.revokedAt) {
    return { ok: false as const, error: "This reset link is invalid or has been revoked." };
  }
  if (reset.usedAt) {
    return { ok: false as const, error: "This reset link was already used. Sign in instead." };
  }
  if (reset.expiresAt.getTime() < Date.now()) {
    return { ok: false as const, error: "This reset link has expired. Ask your admin for a new one." };
  }
  if (!reset.user.isActive) {
    return { ok: false as const, error: "This account is inactive. Contact your administrator." };
  }

  return {
    ok: true as const,
    name: reset.user.name,
    email: reset.user.email,
    businessName: reset.business.name,
    expiresAt: reset.expiresAt.toISOString(),
  };
}

/** Public — set a new password via reset token. */
export async function acceptPasswordReset(input: {
  token: string;
  password: string;
  confirmPassword: string;
}) {
  if (input.password.length < 8) throw new Error("Password must be at least 8 characters");
  if (input.password !== input.confirmPassword) throw new Error("Passwords do not match");

  const { hashInviteToken } = await import("@/lib/invite-utils");
  const tokenHash = hashInviteToken(input.token.trim());
  const reset = await prisma.passwordReset.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!reset || reset.revokedAt) throw new Error("Invalid or revoked reset link");
  if (reset.usedAt) throw new Error("Reset link already used");
  if (reset.expiresAt.getTime() < Date.now()) throw new Error("Reset link has expired");
  if (!reset.user.isActive) throw new Error("Account is inactive");

  const { hash } = await import("bcryptjs");
  const passwordHash = await hash(input.password, 10);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: reset.userId },
      data: { passwordHash },
    });
    await tx.passwordReset.update({
      where: { id: reset.id },
      data: { usedAt: now },
    });
    await tx.passwordReset.updateMany({
      where: { userId: reset.userId, usedAt: null, revokedAt: null, id: { not: reset.id } },
      data: { revokedAt: now },
    });
  });

  return { ok: true as const, email: reset.user.email };
}

export async function createUserInvite(input: {
  name: string;
  email: string;
  role: (typeof ROLES)[number];
  branchId?: string | null;
  /** Absolute origin for building the invite URL, e.g. http://localhost:3000 */
  appOrigin?: string;
}) {
  const session = await requireSession();
  assertCanManageUsers(session.user.role);
  const businessId = session.user.businessId;

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (name.length < 2) throw new Error("Name is required");
  if (!email.includes("@")) throw new Error("Valid email is required");
  if (!ROLES.includes(input.role)) throw new Error("Invalid role");
  if (session.user.role === "MANAGER" && input.role === "OWNER") {
    throw new Error("Managers cannot invite Owner accounts");
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) throw new Error("A user with this email already exists");

  if (input.branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: input.branchId, businessId },
    });
    if (!branch) throw new Error("Branch not found");
  }

  const { generateInviteToken, hashInviteToken, inviteExpiryDate } = await import(
    "@/lib/invite-utils"
  );
  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = inviteExpiryDate(7);

  // Revoke prior open invites for this email in this business
  await prisma.userInvite.updateMany({
    where: {
      businessId,
      email,
      acceptedAt: null,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  const invite = await prisma.userInvite.create({
    data: {
      businessId,
      branchId: input.branchId || null,
      email,
      name,
      role: input.role,
      tokenHash,
      invitedById: session.user.id,
      expiresAt,
    },
  });

  const origin =
    input.appOrigin?.replace(/\/$/, "") ||
    process.env.AUTH_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";
  const inviteUrl = `${origin}/invite/${token}`;

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true },
  });
  const { inviteEmailBody, sendAppEmail } = await import("@/lib/mail");
  const body = inviteEmailBody({
    name,
    inviteUrl,
    businessHint: business?.name ? `at ${business.name}` : undefined,
  });
  const delivery = await sendAppEmail({
    to: email,
    subject: body.subject,
    text: body.text,
  });

  console.info(`[RBIAP invite] ${email} → ${inviteUrl}${delivery.emailed ? " (emailed)" : ""}`);

  revalidatePath("/users");
  revalidatePath("/security");

  return {
    ok: true as const,
    inviteId: invite.id,
    email,
    name,
    expiresAt: expiresAt.toISOString(),
    inviteUrl,
    emailed: delivery.emailed,
    mailError: delivery.mailError ?? null,
    mailtoHref: `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(
      body.subject,
    )}&body=${encodeURIComponent(body.text)}`,
  };
}

export async function revokeUserInvite(inviteId: string) {
  const session = await requireSession();
  assertCanManageUsers(session.user.role);
  const invite = await prisma.userInvite.findFirst({
    where: { id: inviteId, businessId: session.user.businessId },
  });
  if (!invite) throw new Error("Invite not found");
  if (invite.acceptedAt) throw new Error("Invite already accepted");
  if (invite.revokedAt) throw new Error("Invite already revoked");

  await prisma.userInvite.update({
    where: { id: invite.id },
    data: { revokedAt: new Date() },
  });

  revalidatePath("/users");
  return { ok: true as const };
}

/** Public — preview invite without signing in. */
export async function getInvitePreview(token: string) {
  const { hashInviteToken, TERMS_OF_USE, TERMS_VERSION } = await import("@/lib/invite-utils");
  const tokenHash = hashInviteToken(token.trim());
  const invite = await prisma.userInvite.findUnique({
    where: { tokenHash },
    include: { business: { select: { name: true } }, branch: { select: { name: true } } },
  });

  if (!invite || invite.revokedAt) {
    return { ok: false as const, error: "This invite is invalid or has been revoked." };
  }
  if (invite.acceptedAt) {
    return { ok: false as const, error: "This invite was already used. Sign in instead." };
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    return { ok: false as const, error: "This invite has expired. Ask your admin for a new one." };
  }

  return {
    ok: true as const,
    name: invite.name,
    email: invite.email,
    role: invite.role,
    businessName: invite.business.name,
    branchName: invite.branch?.name ?? null,
    expiresAt: invite.expiresAt.toISOString(),
    terms: TERMS_OF_USE,
    termsVersion: TERMS_VERSION,
  };
}

/** Public — accept invite: agree to terms + set password → create user. */
export async function acceptUserInvite(input: {
  token: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
  name?: string;
}) {
  if (!input.acceptTerms) throw new Error("You must accept the terms to continue");
  if (input.password.length < 8) throw new Error("Password must be at least 8 characters");
  if (input.password !== input.confirmPassword) throw new Error("Passwords do not match");

  const { hashInviteToken } = await import("@/lib/invite-utils");
  const tokenHash = hashInviteToken(input.token.trim());
  const invite = await prisma.userInvite.findUnique({ where: { tokenHash } });

  if (!invite || invite.revokedAt) throw new Error("Invalid or revoked invite");
  if (invite.acceptedAt) throw new Error("Invite already used");
  if (invite.expiresAt.getTime() < Date.now()) throw new Error("Invite has expired");

  const existing = await prisma.user.findUnique({ where: { email: invite.email } });
  if (existing) throw new Error("An account with this email already exists — sign in instead");

  const displayName = (input.name?.trim() || invite.name).trim();
  if (displayName.length < 2) throw new Error("Name is required");

  const { hash } = await import("bcryptjs");
  const { defaultSalaryForRole } = await import("@/lib/rbac");
  const passwordHash = await hash(input.password, 10);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        businessId: invite.businessId,
        branchId: invite.branchId,
        email: invite.email,
        name: displayName,
        passwordHash,
        role: invite.role,
        isActive: true,
        salaryMonthly: defaultSalaryForRole(invite.role),
        termsAcceptedAt: now,
      },
    });
    await tx.userInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: now },
    });
  });

  revalidatePath("/users");
  revalidatePath("/security");
  revalidatePath("/payroll");

  return { ok: true as const, email: invite.email };
}

export async function getUsersManagementData() {
  const session = await requireSession();
  const businessId = session.user.businessId;
  const canManage = session.user.role === "OWNER" || session.user.role === "MANAGER";

  if (!canManage) {
    return {
      allowed: false as const,
      meId: session.user.id,
      meRole: session.user.role,
      meName: session.user.name,
    };
  }

  const [users, branches, invites] = await Promise.all([
    prisma.user.findMany({
      where: { businessId },
      include: {
        branch: true,
        _count: { select: { sales: { where: { status: "COMPLETED" } } } },
        sales: {
          where: { status: "COMPLETED" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true, number: true, total: true },
        },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    prisma.branch.findMany({
      where: { businessId },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
    prisma.userInvite.findMany({
      where: { businessId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { invitedBy: { select: { name: true } }, branch: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const roleCounts = users.reduce(
    (acc, u) => {
      acc[u.role] = (acc[u.role] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return {
    allowed: true as const,
    meId: session.user.id,
    meRole: session.user.role,
    meName: session.user.name,
    activeUsers: users.filter((u) => u.isActive).length,
    inactiveUsers: users.filter((u) => !u.isActive).length,
    totalUsers: users.length,
    pendingInvites: invites.length,
    roleCounts,
    branches: branches.map((b) => ({ id: b.id, name: b.name, code: b.code })),
    invites: invites.map((i) => ({
      id: i.id,
      name: i.name,
      email: i.email,
      role: i.role,
      branch: i.branch?.name ?? "—",
      invitedBy: i.invitedBy.name,
      expiresAt: i.expiresAt.toISOString(),
      createdAt: i.createdAt.toISOString().slice(0, 10),
    })),
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      branchId: u.branchId,
      branch: u.branch?.name ?? "—",
      active: u.isActive,
      termsAcceptedAt: u.termsAcceptedAt?.toISOString().slice(0, 10) ?? null,
      createdAt: u.createdAt.toISOString().slice(0, 10),
      saleCount: u._count.sales,
      lastSaleAt: u.sales[0]?.createdAt.toISOString() ?? null,
      lastSaleNumber: u.sales[0]?.number ?? null,
      lastSaleTotal: u.sales[0]?.total ?? null,
    })),
  };
}

export async function getSettingsData() {
  const session = await requireSession();
  const businessId = session.user.businessId;

  const [business, branches, roleGroups, userCount, productCount, accountCount] = await Promise.all([
    prisma.business.findUniqueOrThrow({ where: { id: businessId } }),
    prisma.branch.findMany({
      where: { businessId },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
    prisma.user.groupBy({
      by: ["role"],
      where: { businessId, isActive: true },
      _count: true,
    }),
    prisma.user.count({ where: { businessId, isActive: true } }),
    prisma.product.count({ where: { businessId, status: { not: "INACTIVE" } } }),
    prisma.account.count({ where: { businessId } }),
  ]);

  const defaultBranch = branches.find((b) => b.isDefault) ?? branches[0];

  return {
    business: {
      id: business.id,
      name: business.name,
      currency: business.currency,
      fiscalYear: business.fiscalYear,
      vatRate: business.vatRate,
    },
    defaultBranchId: defaultBranch?.id ?? "",
    defaultBranchName: defaultBranch?.name ?? "",
    branches: branches.map((b) => ({ id: b.id, name: b.name, code: b.code, isDefault: b.isDefault })),
    roleCounts: roleGroups.map((u) => ({ role: u.role, count: u._count })),
    counts: {
      users: userCount,
      branches: branches.length,
      products: productCount,
      accounts: accountCount,
    },
    me: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
      branchName: session.user.branchName,
    },
  };
}

export async function updateBusinessSettings(input: {
  name: string;
  currency: string;
  fiscalYear: string;
  vatRate: number;
  defaultBranchId?: string;
}) {
  const session = await requireSession();
  const { canManageBusinessSettings } = await import("@/lib/rbac");
  if (!canManageBusinessSettings(session.user.role)) {
    throw new Error("Only Owner or Manager can change business settings");
  }
  const businessId = session.user.businessId;
  const name = input.name.trim();
  if (!name) throw new Error("Business name is required");
  if (!["RWF", "USD", "EUR"].includes(input.currency)) throw new Error("Unsupported currency");
  if (Number.isNaN(input.vatRate) || input.vatRate < 0 || input.vatRate > 1) {
    throw new Error("VAT rate must be between 0% and 100%");
  }
  if (!input.fiscalYear.trim()) throw new Error("Financial year is required");

  if (input.defaultBranchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: input.defaultBranchId, businessId },
    });
    if (!branch) throw new Error("Branch not found");
  }

  await prisma.$transaction(async (tx) => {
    await tx.business.update({
      where: { id: businessId },
      data: {
        name,
        currency: input.currency,
        fiscalYear: input.fiscalYear.trim(),
        vatRate: input.vatRate,
      },
    });

    if (input.defaultBranchId) {
      await tx.branch.updateMany({
        where: { businessId, isDefault: true },
        data: { isDefault: false },
      });
      await tx.branch.update({
        where: { id: input.defaultBranchId },
        data: { isDefault: true },
      });
    }
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/branches");
  revalidatePath("/tax");
  revalidatePath("/pos");
  revalidatePath("/counter");
  return { ok: true as const };
}

export async function changeOwnPassword(input: {
  currentPassword: string;
  newPassword: string;
}) {
  const session = await requireSession();
  const current = input.currentPassword;
  const next = input.newPassword;
  if (!current) throw new Error("Current password is required");
  if (next.length < 6) throw new Error("New password must be at least 6 characters");
  if (current === next) throw new Error("New password must be different");

  const { compare, hash } = await import("bcryptjs");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  const valid = await compare(current, user.passwordHash);
  if (!valid) throw new Error("Current password is incorrect");

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hash(next, 10) },
  });

  return { ok: true as const };
}

export async function updateOwnProfile(input: { name: string }) {
  const session = await requireSession();
  const name = input.name.trim();
  if (!name) throw new Error("Name is required");

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name },
  });

  revalidatePath("/settings");
  revalidatePath("/security");
  return { ok: true as const };
}

function payrollDeptFor(role: string) {
  if (role === "CASHIER") return "Sales";
  if (role === "STOREKEEPER") return "Warehouse";
  if (role === "ACCOUNTANT") return "Finance";
  if (role === "MANAGER") return "Operations";
  return "Leadership";
}

function salaryForUser(u: { role: string; salaryMonthly: number }) {
  if (u.role === "OWNER") return u.salaryMonthly > 0 ? u.salaryMonthly : 0;
  if (u.salaryMonthly > 0) return u.salaryMonthly;
  // Lazy import avoided — inline defaults mirror rbac.defaultSalaryForRole
  const map: Record<string, number> = {
    MANAGER: 650_000,
    CASHIER: 280_000,
    ACCOUNTANT: 520_000,
    STOREKEEPER: 320_000,
  };
  return map[u.role] ?? 300_000;
}

export async function getPayrollData() {
  const session = await requireSession();
  const { canRunPayroll } = await import("@/lib/rbac");
  if (!canRunPayroll(session.user.role)) {
    throw new Error("Payroll is limited to Owner, Manager, or Accountant");
  }
  const businessId = session.user.businessId;
  await ensureChartOfAccounts(prisma, businessId);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthLabel = now.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const [users, accounts, payrollJournals] = await Promise.all([
    prisma.user.findMany({
      where: { businessId },
      include: { branch: true },
      orderBy: { name: "asc" },
    }),
    prisma.account.findMany({
      where: { businessId, code: { in: ["1000", "1100", "1200", "5200"] } },
    }),
    prisma.journalEntry.findMany({
      where: {
        businessId,
        refType: "Payroll",
        createdAt: { gte: monthStart },
      },
      include: { lines: true },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  const staff = users.map((u) => {
    const salary = salaryForUser(u);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      dept: payrollDeptFor(u.role),
      branch: u.branch?.name ?? "—",
      branchId: u.branchId,
      shift: u.role === "CASHIER" ? "A" : "Day",
      active: u.isActive,
      status: u.isActive ? "Active" : "Inactive",
      salary,
      salaryMonthly: u.salaryMonthly,
      payable: u.role !== "OWNER" && u.isActive && salary > 0,
    };
  });

  const payableStaff = staff.filter((s) => s.payable);
  const grossPayroll = payableStaff.reduce((s, e) => s + e.salary, 0);
  const paidThisMonth = payrollJournals.reduce(
    (s, j) => s + j.lines.reduce((ls, l) => ls + l.debit, 0),
    0,
  );

  const byDept = new Map<string, { dept: string; headcount: number; cost: number }>();
  for (const s of payableStaff) {
    const cur = byDept.get(s.dept) ?? { dept: s.dept, headcount: 0, cost: 0 };
    cur.headcount += 1;
    cur.cost += s.salary;
    byDept.set(s.dept, cur);
  }

  const bal = (code: string) => accounts.find((a) => a.code === code)?.balance ?? 0;

  return {
    monthLabel,
    activeEmployees: staff.filter((s) => s.active).length,
    payableCount: payableStaff.length,
    payrollThisMonth: grossPayroll,
    paidThisMonth,
    unpaidEstimate: Math.max(0, grossPayroll - paidThisMonth),
    onLeave: staff.filter((s) => !s.active).length,
    staff,
    byDept: [...byDept.values()].sort((a, b) => b.cost - a.cost),
    liquid: {
      cash: bal("1000"),
      bank: bal("1100"),
      momo: bal("1200"),
      salariesExpense: bal("5200"),
    },
    recentRuns: payrollJournals.map((j) => ({
      id: j.id,
      number: j.number,
      description: j.description,
      amount: j.lines.reduce((s, l) => s + l.debit, 0),
      date: j.createdAt.toISOString(),
    })),
    canEditSalaries: session.user.role === "OWNER" || session.user.role === "MANAGER",
  };
}

export async function updateStaffSalary(input: { userId: string; salaryMonthly: number }) {
  const session = await requireSession();
  const { canManageUsers, defaultSalaryForRole } = await import("@/lib/rbac");
  if (!canManageUsers(session.user.role)) {
    throw new Error("Only Owner or Manager can edit salaries");
  }
  const amount = Math.trunc(input.salaryMonthly);
  if (amount < 0 || amount > 50_000_000) throw new Error("Invalid salary amount");

  const user = await prisma.user.findFirst({
    where: { id: input.userId, businessId: session.user.businessId },
  });
  if (!user) throw new Error("Employee not found");
  if (user.role === "OWNER" && amount > 0) {
    // allow owner salary if they want, but typically 0
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { salaryMonthly: amount },
  });

  revalidatePath("/payroll");
  revalidatePath("/users");
  return {
    ok: true as const,
    salaryMonthly: amount,
    effective: amount > 0 ? amount : user.role === "OWNER" ? 0 : defaultSalaryForRole(user.role),
  };
}

export async function runPayroll(input: {
  userIds: string[];
  fromCode: "1000" | "1100" | "1200";
  note?: string;
}) {
  const session = await requireSession();
  const { canRunPayroll } = await import("@/lib/rbac");
  if (!canRunPayroll(session.user.role)) {
    throw new Error("You cannot run payroll");
  }
  const businessId = session.user.businessId;
  const ids = [...new Set(input.userIds)];
  if (ids.length === 0) throw new Error("Select at least one employee");

  const users = await prisma.user.findMany({
    where: { id: { in: ids }, businessId, isActive: true },
  });
  if (users.length !== ids.length) throw new Error("One or more employees not found");

  const lines = users
    .map((u) => ({
      id: u.id,
      name: u.name,
      salary: salaryForUser(u),
    }))
    .filter((u) => u.salary > 0);

  if (lines.length === 0) throw new Error("No payable staff in selection (set salaries in Payroll)");

  const total = lines.reduce((s, l) => s + l.salary, 0);
  const monthLabel = new Date().toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  const journal = await prisma.$transaction(async (tx) => {
    await ensureChartOfAccounts(tx, businessId);
    const from = await tx.account.findFirst({
      where: { businessId, code: input.fromCode },
    });
    if (!from) throw new Error("Payment account not found");
    if (from.balance < total) {
      throw new Error(
        `Insufficient balance on ${input.fromCode === "1000" ? "Cash" : input.fromCode === "1100" ? "Bank" : "MoMo"} (${formatCurrency(from.balance)} available, need ${formatCurrency(total)})`,
      );
    }

    return postPayrollJournal(tx, {
      businessId,
      fromCode: input.fromCode,
      amount: total,
      periodLabel: monthLabel,
      staffCount: lines.length,
      note:
        input.note?.trim() ||
        `Payroll ${monthLabel}: ${lines.map((l) => l.name).join(", ")}`,
    });
  });

  revalidatePath("/payroll");
  revalidatePath("/accounting");
  revalidatePath("/banking");
  revalidatePath("/dashboard");

  return {
    ok: true as const,
    total,
    staffCount: lines.length,
    journalNumber: journal?.number ?? null,
  };
}

export async function getIntegrationsData() {
  const session = await requireSession();
  const businessId = session.user.businessId;
  await ensureChartOfAccounts(prisma, businessId);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [accounts, tax, salesToday, productsWithBarcode, movementsToday, users] =
    await Promise.all([
      prisma.account.findMany({
        where: { businessId, code: { in: ["1000", "1100", "1200", "2100"] } },
      }),
      getTaxData("this_month"),
      prisma.sale.count({
        where: { businessId, status: "COMPLETED", createdAt: { gte: today } },
      }),
      prisma.product.count({
        where: { businessId, status: { not: "INACTIVE" }, barcode: { not: null } },
      }),
      prisma.stockMovement.count({
        where: { businessId, createdAt: { gte: today } },
      }),
      prisma.user.count({ where: { businessId, isActive: true } }),
    ]);

  const bal = (code: string) => accounts.find((a) => a.code === code)?.balance ?? 0;

  type Status = "live" | "configured" | "planned" | "offline";

  const channels: {
    id: string;
    name: string;
    category: string;
    status: Status;
    detail: string;
    href: string;
    canToggle: boolean;
  }[] = [
    {
      id: "cash",
      name: "Cash / Till",
      category: "Payments",
      status: "live",
      detail: `Ledger ${formatCurrency(bal("1000"))} · POS posts here`,
      href: "/banking",
      canToggle: true,
    },
    {
      id: "momo",
      name: "Mobile money (MoMo)",
      category: "Payments",
      status: "live",
      detail: `Ledger ${formatCurrency(bal("1200"))} · internal channel`,
      href: "/banking",
      canToggle: true,
    },
    {
      id: "bank",
      name: "Bank account",
      category: "Banking",
      status: "live",
      detail: `Ledger ${formatCurrency(bal("1100"))} · transfers & payroll`,
      href: "/banking",
      canToggle: true,
    },
    {
      id: "card",
      name: "Card terminal",
      category: "Payments",
      status: "planned",
      detail: "POS accepts Card locally; gateway TBD",
      href: "/pos",
      canToggle: true,
    },
    {
      id: "vat",
      name: "VAT / Tax ledger",
      category: "Tax",
      status: "configured",
      detail: `Payable ${formatCurrency(tax.netVat)} · ${tax.salesCount} tickets this month`,
      href: "/tax",
      canToggle: false,
    },
    {
      id: "rra",
      name: "RRA EBM / Fiscal",
      category: "Tax",
      status: "planned",
      detail: "Export-ready VAT register; EBM connector planned",
      href: "/tax",
      canToggle: true,
    },
    {
      id: "auth",
      name: "Auth.js credentials",
      category: "Platform",
      status: "live",
      detail: `${users} active users · JWT sessions`,
      href: "/security",
      canToggle: false,
    },
    {
      id: "db",
      name: "SQLite / Prisma",
      category: "Platform",
      status: "live",
      detail: "Local database · server actions",
      href: "/settings",
      canToggle: false,
    },
    {
      id: "barcode",
      name: "Barcode scanner",
      category: "Hardware",
      status: productsWithBarcode > 0 ? "live" : "configured",
      detail: `${productsWithBarcode} SKUs with barcodes · html5-qrcode`,
      href: "/inventory",
      canToggle: true,
    },
    {
      id: "pos-api",
      name: "Sales & receive actions",
      category: "Platform",
      status: "live",
      detail: `${salesToday} sales today · ${movementsToday} stock moves`,
      href: "/pos",
      canToggle: false,
    },
    {
      id: "webhooks",
      name: "Outbound webhooks",
      category: "Platform",
      status: "planned",
      detail: "Notify external systems on sale / receive",
      href: "/integrations",
      canToggle: true,
    },
    {
      id: "smtp",
      name: "SMTP email",
      category: "Messaging",
      status: "configured" as const,
      detail: "Set SMTP_* in .env to email invites and resets",
      href: "/users",
      canToggle: false,
    },
    {
      id: "sms",
      name: "SMS / WhatsApp alerts",
      category: "Messaging",
      status: "planned",
      detail: "Low stock & debt reminders",
      href: "/notifications",
      canToggle: true,
    },
  ];

  const { isSmtpConfigured } = await import("@/lib/mail");
  const smtpOn = isSmtpConfigured();
  const smtpChannel = channels.find((c) => c.id === "smtp");
  if (smtpChannel) {
    smtpChannel.status = smtpOn ? "live" : "configured";
    smtpChannel.detail = smtpOn
      ? "Invites & password resets emailed via SMTP_HOST"
      : "Set SMTP_* in .env to email invites and resets";
  }

  const live = channels.filter((c) => c.status === "live").length;
  const planned = channels.filter((c) => c.status === "planned").length;

  return {
    businessName: session.user.businessName,
    channels,
    live,
    planned,
    configured: channels.filter((c) => c.status === "configured").length,
    total: channels.length,
    liquid: bal("1000") + bal("1100") + bal("1200"),
    salesToday,
  };
}

export async function getAiContext() {
  const [dash, procurement, tax, loyalty, payroll] = await Promise.all([
    getDashboardData("today"),
    getProcurementData(),
    getTaxData("this_month"),
    getLoyaltyData(),
    getPayrollData(),
  ]);

  const topReorder = procurement.recommendations.slice(0, 5);
  const topDebtors = dash.topDebtors?.slice(0, 3) ?? [];

  const insights: {
    title: string;
    detail: string;
    confidence: number;
    type: "ops" | "cash" | "tax" | "ar" | "payroll" | "loyalty";
    href: string;
  }[] = [];

  if (topReorder[0]) {
    insights.push({
      title: `Reorder ${topReorder[0].name}`,
      detail: `Stock ${topReorder[0].stock}/${topReorder[0].minStock}. Suggest ${topReorder[0].suggestedQty} via ${topReorder[0].supplier} (~${formatCurrency(topReorder[0].estCost)}).`,
      confidence: 90,
      type: "ops",
      href: "/procurement",
    });
  } else {
    insights.push({
      title: "Stock levels healthy",
      detail: "No SKUs below minimum right now. Keep watching high-velocity items after peak hours.",
      confidence: 80,
      type: "ops",
      href: "/inventory",
    });
  }

  insights.push({
    title: "Cash position",
    detail: `Cash + MoMo ${formatCurrency(dash.cashBalance)}. Bank ${formatCurrency(dash.bankBalance)}. Liquid ${formatCurrency(dash.liquid)}.`,
    confidence: 95,
    type: "cash",
    href: "/banking",
  });

  insights.push({
    title: "VAT snapshot",
    detail: `Output VAT MTD ${formatCurrency(tax.outputVat)}. Payable ledger ${formatCurrency(tax.netVat)}.`,
    confidence: 92,
    type: "tax",
    href: "/tax",
  });

  if (dash.customerDebts > 0) {
    const names = topDebtors.map((d: { name: string }) => d.name).join(", ");
    insights.push({
      title: "Collect receivables",
      detail: `AR ${formatCurrency(dash.customerDebts)}${names ? ` · top: ${names}` : ""}. Use Customer pay.`,
      confidence: 88,
      type: "ar",
      href: "/quick-pay",
    });
  }

  if (payroll.unpaidEstimate > 0) {
    insights.push({
      title: "Payroll still due",
      detail: `Est. unpaid ${formatCurrency(payroll.unpaidEstimate)} of ${formatCurrency(payroll.payrollThisMonth)} for ${payroll.monthLabel}.`,
      confidence: 85,
      type: "payroll",
      href: "/payroll",
    });
  }

  if (loyalty.membersWithPoints > 0) {
    insights.push({
      title: "Loyalty engagement",
      detail: `${loyalty.membersWithPoints} members with points · ${loyalty.pointsIssued.toLocaleString()} pts on file (~${formatCurrency(loyalty.redeemableValue)}).`,
      confidence: 78,
      type: "loyalty",
      href: "/loyalty",
    });
  }

  return {
    businessName: dash.businessName,
    healthScore: dash.healthScore,
    healthFactors: dash.healthFactors,
    salesToday: dash.salesToday,
    salesChange: dash.salesChange,
    profitToday: dash.profitToday,
    tickets: dash.tickets,
    avgTicket: dash.avgTicket,
    cashBalance: dash.cashBalance,
    bankBalance: dash.bankBalance,
    liquid: dash.liquid,
    inventoryValue: dash.inventoryValue,
    lowStockCount: dash.lowStock.length,
    outStockCount: dash.outStockCount,
    lowStockNames: dash.lowStock.slice(0, 5).map((p) => p.name),
    customerDebts: dash.customerDebts,
    supplierPayables: dash.supplierPayables,
    topDebtors: topDebtors.map((d: { id: string; name: string; balance: number }) => ({
      id: d.id,
      name: d.name,
      balance: d.balance,
    })),
    vatPayable: tax.netVat,
    outputVat: tax.outputVat,
    taxPeriodLabel: tax.periodLabel,
    reorderEst: procurement.estTotal,
    reorderCount: procurement.recommendations.length,
    reorderLines: topReorder.map((r) => ({
      name: r.name,
      qty: r.suggestedQty,
      cost: r.estCost,
      supplier: r.supplier,
    })),
    payrollDue: payroll.unpaidEstimate,
    payrollMonth: payroll.monthLabel,
    loyaltyPoints: loyalty.pointsIssued,
    openPos: dash.openPos,
    insights,
    prompts: [
      "Reorder plan",
      "Profit brief",
      "VAT status",
      "Cash position",
      "Who owes us?",
      "Payroll status",
      "Health score",
      "Weekend forecast",
    ],
  };
}

const createCustomerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().max(80).optional().nullable(),
  type: z.enum(["Walk-in", "Credit"]).default("Walk-in"),
  segment: z.enum(["Regular", "VIP", "Wholesale", "Pharmacy", "New"]).default("Regular"),
});

export async function createCustomer(input: z.infer<typeof createCustomerSchema>) {
  const session = await requireSession();
  try {
    const data = createCustomerSchema.parse(input);
    const customer = await prisma.customer.create({
      data: {
        businessId: session.user.businessId,
        name: data.name,
        phone: data.phone || null,
        email: data.email || null,
        type: data.type,
        segment: data.segment,
        balance: 0,
        points: 0,
      },
    });
    revalidatePath("/customers");
    revalidatePath("/loyalty");
    revalidatePath("/quick-pay");
    revalidatePath("/pos");
    return { ok: true as const, id: customer.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create customer";
    return { ok: false as const, error: message };
  }
}

const updateCustomerSchema = createCustomerSchema.extend({
  id: z.string().min(1),
  isActive: z.boolean().optional().default(true),
});

export async function updateCustomer(input: z.infer<typeof updateCustomerSchema>) {
  const session = await requireSession();
  try {
    const data = updateCustomerSchema.parse(input);
    const existing = await prisma.customer.findFirst({
      where: { id: data.id, businessId: session.user.businessId },
    });
    if (!existing) throw new Error("Customer not found");

    await prisma.customer.update({
      where: { id: data.id },
      data: {
        name: data.name,
        phone: data.phone || null,
        email: data.email || null,
        type: data.type,
        segment: data.segment,
        isActive: data.isActive,
      },
    });

    revalidatePath("/customers");
    revalidatePath("/loyalty");
    revalidatePath("/quick-pay");
    revalidatePath("/pos");
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update customer";
    return { ok: false as const, error: message };
  }
}

/** Build one ORDERED PO per supplier from current low-stock recommendations. */
export async function generateReorderPurchaseOrders() {
  const session = await requireSession();
  const businessId = session.user.businessId;

  try {
    const procurement = await getProcurementData();
    if (procurement.recommendations.length === 0) {
      return { ok: false as const, error: "No reorder recommendations right now" };
    }

    const bySupplier = new Map<
      string,
      { supplierId: string; lines: { productId: string; qty: number; unitCost: number }[] }
    >();

    for (const r of procurement.recommendations) {
      if (!r.supplierId) continue;
      const product = await prisma.product.findFirst({
        where: { id: r.id, businessId },
      });
      if (!product) continue;
      const group = bySupplier.get(r.supplierId) ?? {
        supplierId: r.supplierId,
        lines: [],
      };
      group.lines.push({
        productId: product.id,
        qty: r.suggestedQty,
        unitCost: product.costPrice,
      });
      bySupplier.set(r.supplierId, group);
    }

    if (bySupplier.size === 0) {
      return { ok: false as const, error: "No supplier assigned to recommendations" };
    }

    const year = new Date().getFullYear();
    const existing = await prisma.purchaseOrder.count({ where: { businessId } });
    let seq = existing + 1;
    const created: string[] = [];

    await prisma.$transaction(async (tx) => {
      const productIds = [...bySupplier.values()].flatMap((g) => g.lines.map((l) => l.productId));
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, businessId },
      });
      const costById = new Map(products.map((p) => [p.id, p.costPrice]));

      for (const group of bySupplier.values()) {
        const lines = group.lines.map((l) => ({
          ...l,
          unitCost: costById.get(l.productId) ?? l.unitCost,
        }));
        const totalCost = lines.reduce((s, l) => s + l.qty * l.unitCost, 0);
        const number = `PO-${year}-${String(100 + seq).padStart(3, "0")}`;
        seq += 1;
        const po = await tx.purchaseOrder.create({
          data: {
            businessId,
            branchId: session.user.branchId,
            supplierId: group.supplierId,
            number,
            status: "ORDERED",
            totalCost,
            lines: {
              create: lines.map((l) => ({
                productId: l.productId,
                qtyOrdered: l.qty,
                unitCost: l.unitCost,
              })),
            },
          },
        });
        created.push(po.number);
      }
    });

    revalidatePath("/purchasing");
    revalidatePath("/procurement");
    revalidatePath("/receive");
    revalidatePath("/warehouse");
    revalidatePath("/notifications");

    return { ok: true as const, numbers: created };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate POs";
    return { ok: false as const, error: message };
  }
}

export async function getPurchasingFormOptions() {
  const session = await requireSession();
  const businessId = session.user.businessId;
  const [suppliers, products] = await Promise.all([
    prisma.supplier.findMany({
      where: { businessId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { businessId, status: { not: "INACTIVE" } },
      orderBy: { name: "asc" },
    }),
  ]);
  return {
    suppliers: suppliers.map((s) => ({ id: s.id, name: s.name })),
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      costPrice: p.costPrice,
      unit: p.unit,
    })),
  };
}

const createPoSchema = z.object({
  supplierId: z.string().min(1),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty: z.number().int().positive(),
      }),
    )
    .min(1),
});

export async function createPurchaseOrder(input: z.infer<typeof createPoSchema>) {
  const session = await requireSession();
  const businessId = session.user.businessId;

  try {
    const data = createPoSchema.parse(input);
    const supplier = await prisma.supplier.findFirst({
      where: { id: data.supplierId, businessId, isActive: true },
    });
    if (!supplier) throw new Error("Supplier not found");

    const productIds = data.lines.map((l) => l.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, businessId },
    });
    if (products.length !== productIds.length) throw new Error("One or more products not found");

    const byId = new Map(products.map((p) => [p.id, p]));
    const lines = data.lines.map((l) => {
      const p = byId.get(l.productId)!;
      return { productId: p.id, qtyOrdered: l.qty, unitCost: p.costPrice };
    });
    const totalCost = lines.reduce((s, l) => s + l.qtyOrdered * l.unitCost, 0);

    const year = new Date().getFullYear();
    const count = await prisma.purchaseOrder.count({ where: { businessId } });
    const number = `PO-${year}-${String(100 + count + 1).padStart(3, "0")}`;

    const status =
      session.user.role === "CASHIER" || session.user.role === "STOREKEEPER"
        ? "PENDING_APPROVAL"
        : "ORDERED";

    const po = await prisma.purchaseOrder.create({
      data: {
        businessId,
        branchId: session.user.branchId,
        supplierId: supplier.id,
        number,
        status,
        totalCost,
        lines: { create: lines },
      },
    });

    revalidatePath("/purchasing");
    revalidatePath("/receive");
    revalidatePath("/procurement");
    revalidatePath("/warehouse");
    revalidatePath("/notifications");

    return { ok: true as const, number: po.number, id: po.id, status };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create PO";
    return { ok: false as const, error: message };
  }
}

const createSupplierSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().max(80).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().max(80).optional().nullable(),
  leadDays: z.number().int().min(0).max(90).default(3),
  rating: z.number().min(1).max(5).default(4),
});

export async function createSupplier(input: z.infer<typeof createSupplierSchema>) {
  const session = await requireSession();
  try {
    const data = createSupplierSchema.parse(input);
    const supplier = await prisma.supplier.create({
      data: {
        businessId: session.user.businessId,
        name: data.name,
        category: data.category || "General",
        phone: data.phone || null,
        email: data.email || null,
        leadDays: data.leadDays,
        rating: data.rating,
      },
    });
    revalidatePath("/purchasing");
    revalidatePath("/procurement");
    revalidatePath("/receive");
    return { ok: true as const, id: supplier.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create supplier";
    return { ok: false as const, error: message };
  }
}

const updateSupplierSchema = createSupplierSchema.extend({
  id: z.string().min(1),
  isActive: z.boolean().optional().default(true),
});

export async function updateSupplier(input: z.infer<typeof updateSupplierSchema>) {
  const session = await requireSession();
  try {
    const data = updateSupplierSchema.parse(input);
    const existing = await prisma.supplier.findFirst({
      where: { id: data.id, businessId: session.user.businessId },
    });
    if (!existing) throw new Error("Supplier not found");

    await prisma.supplier.update({
      where: { id: data.id },
      data: {
        name: data.name,
        category: data.category || "General",
        phone: data.phone || null,
        email: data.email || null,
        leadDays: data.leadDays,
        rating: data.rating,
        isActive: data.isActive,
      },
    });

    revalidatePath("/purchasing");
    revalidatePath("/procurement");
    revalidatePath("/receive");
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update supplier";
    return { ok: false as const, error: message };
  }
}

const paySupplierSchema = z.object({
  supplierId: z.string().min(1),
  amount: z.number().int().positive(),
  method: z.enum(["CASH", "CARD", "MOMO"]).default("CASH"),
  note: z.string().trim().max(200).optional(),
});

export async function paySupplier(input: z.infer<typeof paySupplierSchema>) {
  const session = await requireSession();
  try {
    const data = paySupplierSchema.parse(input);
    const supplier = await prisma.supplier.findFirst({
      where: { id: data.supplierId, businessId: session.user.businessId },
    });
    if (!supplier) throw new Error("Supplier not found");
    if (supplier.balance <= 0) throw new Error("No outstanding balance");

    const pay = Math.min(data.amount, supplier.balance);

    const updated = await prisma.$transaction(async (tx) => {
      const s = await tx.supplier.update({
        where: { id: supplier.id },
        data: { balance: { decrement: pay } },
      });

      await postSupplierPaymentJournal(tx, {
        businessId: session.user.businessId,
        supplierId: supplier.id,
        supplierName: supplier.name,
        amount: pay,
        method: data.method,
      });

      return s;
    });

    revalidatePath("/purchasing");
    revalidatePath("/accounting");
    revalidatePath("/banking");
    revalidatePath("/dashboard");
    revalidatePath("/reports");
    revalidatePath("/notifications");

    return {
      ok: true as const,
      paid: pay,
      remaining: updated.balance,
      supplierName: supplier.name,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment failed";
    return { ok: false as const, error: message };
  }
}

export async function approvePurchaseOrder(purchaseOrderId: string) {
  const session = await requireSession();
  if (session.user.role !== "OWNER" && session.user.role !== "MANAGER") {
    throw new Error("Only Owner or Manager can approve purchase orders");
  }
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: purchaseOrderId, businessId: session.user.businessId },
  });
  if (!po) throw new Error("Purchase order not found");
  if (po.status !== "PENDING_APPROVAL") throw new Error("PO is not awaiting approval");

  await prisma.purchaseOrder.update({
    where: { id: po.id },
    data: { status: "ORDERED" },
  });

  revalidatePath("/purchasing");
  revalidatePath("/receive");
  revalidatePath("/notifications");
  revalidatePath("/warehouse");
  return { ok: true as const };
}

export async function cancelPurchaseOrder(purchaseOrderId: string) {
  const session = await requireSession();
  try {
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, businessId: session.user.businessId },
    });
    if (!po) throw new Error("Purchase order not found");
    if (!["DRAFT", "PENDING_APPROVAL", "ORDERED"].includes(po.status)) {
      throw new Error("Only draft, pending, or ordered POs can be cancelled");
    }

    await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { status: "CANCELLED" },
    });

    revalidatePath("/purchasing");
    revalidatePath("/receive");
    revalidatePath("/procurement");
    revalidatePath("/warehouse");
    revalidatePath("/notifications");

    return { ok: true as const, number: po.number };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not cancel PO";
    return { ok: false as const, error: message };
  }
}

export async function getSalesExportRows(periodInput?: string) {
  const session = await requireSession();
  const period = isReportPeriodId(periodInput) ? periodInput : "this_month";
  const { start, end } = resolveReportRange(period);
  const sales = await prisma.sale.findMany({
    where: {
      businessId: session.user.businessId,
      status: "COMPLETED",
      createdAt: { gte: start, lte: end },
    },
    include: { user: true, customer: true },
    orderBy: { createdAt: "desc" },
  });
  return sales.map((s) => ({
    number: s.number,
    date: s.createdAt.toISOString().slice(0, 10),
    time: s.createdAt.toISOString().slice(11, 16),
    cashier: s.user.name,
    customer: s.customer?.name ?? "Walk-in",
    method: s.paymentMethod,
    subtotal: s.subtotal,
    tax: s.taxAmt,
    total: s.total,
  }));
}

export async function getInventoryExportRows() {
  const session = await requireSession();
  const products = await prisma.product.findMany({
    where: { businessId: session.user.businessId },
    orderBy: { name: "asc" },
  });
  return products.map((p) => ({
    sku: p.sku,
    name: p.name,
    category: p.category,
    stock: p.stockQty,
    min: p.minStock,
    unit: p.unit,
    cost: p.costPrice,
    sell: p.sellPrice,
    value: p.stockQty * p.costPrice,
    status: p.status,
  }));
}

const createProductSchema = z.object({
  name: z.string().trim().min(2).max(160),
  category: z.string().trim().min(1).max(80),
  brand: z.string().trim().max(80).optional(),
  sku: z.string().trim().min(2).max(40),
  barcode: z.string().trim().max(40).optional(),
  size: z.string().trim().max(40).optional(),
  color: z.string().trim().max(40).optional(),
  costPrice: z.number().int().nonnegative(),
  sellPrice: z.number().int().positive(),
  stockQty: z.number().int().nonnegative().default(0),
  minStock: z.number().int().nonnegative().default(0),
  unit: z.string().trim().min(1).max(20).default("pcs"),
  taxRate: z.number().min(0).max(1).default(0.18),
  taxExempt: z.boolean().default(false),
});

export async function createProduct(input: z.infer<typeof createProductSchema>) {
  const session = await requireSession();
  try {
    const data = createProductSchema.parse(input);
    const sku = data.sku.toUpperCase();
    const exists = await prisma.product.findFirst({
      where: { businessId: session.user.businessId, sku },
    });
    if (exists) throw new Error("SKU already exists");

    const product = await prisma.product.create({
      data: {
        businessId: session.user.businessId,
        name: data.name,
        category: data.category,
        brand: data.brand || null,
        sku,
        barcode: data.barcode || null,
        size: data.size || null,
        color: data.color || null,
        costPrice: data.costPrice,
        sellPrice: data.sellPrice,
        stockQty: data.stockQty,
        minStock: data.minStock,
        unit: data.unit,
        taxRate: data.taxRate,
        taxExempt: data.taxExempt,
        status: computeProductStatus(data.stockQty, data.minStock),
      },
    });

    if (data.stockQty > 0) {
      await prisma.stockMovement.create({
        data: {
          businessId: session.user.businessId,
          branchId: session.user.branchId,
          productId: product.id,
          userId: session.user.id,
          type: StockMovementType.ADJUSTMENT,
          qty: data.stockQty,
          note: "Opening stock on product create",
        },
      });
    }

    revalidatePath("/products");
    revalidatePath("/inventory");
    revalidatePath("/pos");
    revalidatePath("/stock-check");
    revalidatePath("/procurement");
    revalidatePath("/notifications");

    return { ok: true as const, id: product.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create product";
    return { ok: false as const, error: message };
  }
}

const updateProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2).max(160),
  category: z.string().trim().min(1).max(80),
  brand: z.string().trim().max(80).optional().nullable(),
  sku: z.string().trim().min(2).max(40),
  barcode: z.string().trim().max(40).optional().nullable(),
  size: z.string().trim().max(40).optional().nullable(),
  color: z.string().trim().max(40).optional().nullable(),
  style: z.string().trim().max(40).optional().nullable(),
  costPrice: z.number().int().nonnegative(),
  sellPrice: z.number().int().positive(),
  wholesalePrice: z.number().int().nonnegative().optional().nullable(),
  minStock: z.number().int().nonnegative(),
  unit: z.string().trim().min(1).max(20),
  taxRate: z.number().min(0).max(1),
  taxExempt: z.boolean(),
  batchNumber: z.string().trim().max(40).optional().nullable(),
  expiryDate: z.string().optional().nullable(), // YYYY-MM-DD
  inactive: z.boolean().optional().default(false),
});

export async function updateProduct(input: z.infer<typeof updateProductSchema>) {
  const session = await requireSession();
  try {
    const data = updateProductSchema.parse(input);
    const sku = data.sku.toUpperCase();

    const existing = await prisma.product.findFirst({
      where: { id: data.id, businessId: session.user.businessId },
    });
    if (!existing) throw new Error("Product not found");

    const skuClash = await prisma.product.findFirst({
      where: {
        businessId: session.user.businessId,
        sku,
        NOT: { id: data.id },
      },
    });
    if (skuClash) throw new Error("SKU already exists on another product");

    if (data.sellPrice < data.costPrice) {
      throw new Error("Sell price should be at least cost price");
    }

    const status = data.inactive
      ? ProductStatus.INACTIVE
      : computeProductStatus(existing.stockQty, data.minStock);

    await prisma.product.update({
      where: { id: data.id },
      data: {
        name: data.name,
        category: data.category,
        brand: data.brand || null,
        sku,
        barcode: data.barcode || null,
        size: data.size || null,
        color: data.color || null,
        style: data.style || null,
        costPrice: data.costPrice,
        sellPrice: data.sellPrice,
        wholesalePrice: data.wholesalePrice ?? null,
        minStock: data.minStock,
        unit: data.unit,
        taxRate: data.taxExempt ? 0 : data.taxRate,
        taxExempt: data.taxExempt,
        batchNumber: data.batchNumber || null,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        status,
      },
    });

    revalidatePath("/products");
    revalidatePath("/inventory");
    revalidatePath("/pos");
    revalidatePath("/stock-check");
    revalidatePath("/procurement");
    revalidatePath("/warehouse");
    revalidatePath("/notifications");

    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update product";
    return { ok: false as const, error: message };
  }
}

const adjustStockSchema = z
  .object({
    productId: z.string().min(1),
    /** Relative change (+/−). Ignored when countedQty is set. */
    qtyDelta: z.number().int().optional(),
    /** Absolute on-hand count — converts to a delta vs current stock. */
    countedQty: z.number().int().nonnegative().optional(),
    reason: z
      .enum(["COUNT", "DAMAGE", "FOUND", "SHRINKAGE", "RETURN", "OTHER"])
      .optional()
      .default("OTHER"),
    note: z.string().trim().max(200).optional(),
  })
  .refine((d) => d.countedQty !== undefined || (d.qtyDelta !== undefined && d.qtyDelta !== 0), {
    message: "Provide a qty change or a counted quantity",
  });

export async function adjustStock(input: z.infer<typeof adjustStockSchema>) {
  const session = await requireSession();
  try {
    const data = adjustStockSchema.parse(input);
    const product = await prisma.product.findFirst({
      where: { id: data.productId, businessId: session.user.businessId },
    });
    if (!product) throw new Error("Product not found");

    const qtyDelta =
      data.countedQty !== undefined ? data.countedQty - product.stockQty : data.qtyDelta!;
    if (qtyDelta === 0) throw new Error("Counted qty matches current stock — nothing to change");

    const nextQty = product.stockQty + qtyDelta;
    if (nextQty < 0) throw new Error("Stock cannot go below zero");

    const reasonLabel = data.reason ?? "OTHER";
    const noteParts = [
      reasonLabel !== "OTHER" ? reasonLabel : null,
      data.note?.trim() || null,
      data.countedQty !== undefined ? `Count → ${data.countedQty}` : null,
    ].filter(Boolean);
    const note = noteParts.join(" · ") || "Manual stock adjustment";

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: product.id },
        data: {
          stockQty: nextQty,
          status:
            product.status === ProductStatus.INACTIVE
              ? ProductStatus.INACTIVE
              : computeProductStatus(nextQty, product.minStock),
        },
      });
      await tx.stockMovement.create({
        data: {
          businessId: session.user.businessId,
          branchId: session.user.branchId,
          productId: product.id,
          userId: session.user.id,
          type: StockMovementType.ADJUSTMENT,
          qty: qtyDelta,
          note,
        },
      });
    });

    revalidatePath("/inventory");
    revalidatePath("/products");
    revalidatePath("/pos");
    revalidatePath("/stock-check");
    revalidatePath("/warehouse");
    revalidatePath("/procurement");
    revalidatePath("/notifications");
    revalidatePath("/dashboard");

    return {
      ok: true as const,
      stockQty: nextQty,
      qtyDelta,
      productName: product.name,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Adjustment failed";
    return { ok: false as const, error: message };
  }
}

