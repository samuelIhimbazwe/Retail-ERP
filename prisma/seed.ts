import { PrismaClient, ProductStatus, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function refreshStatus(stockQty: number, minStock: number): ProductStatus {
  if (stockQty <= 0) return ProductStatus.OUT_OF_STOCK;
  if (stockQty <= minStock) return ProductStatus.LOW_STOCK;
  return ProductStatus.ACTIVE;
}

async function main() {
  await prisma.journalLine.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.account.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.salePayment.deleteMany();
  await prisma.saleLine.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.purchaseOrderLine.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.business.deleteMany();

  const business = await prisma.business.create({
    data: {
      name: "Kigali Fresh Market",
      currency: "RWF",
      fiscalYear: "FY 2026",
      vatRate: 0.18,
    },
  });

  const branch = await prisma.branch.create({
    data: {
      businessId: business.id,
      name: "Kimironko Branch",
      code: "KIM",
      isDefault: true,
    },
  });

  await prisma.branch.createMany({
    data: [
      { businessId: business.id, name: "Nyabugogo Branch", code: "NYA", isDefault: false },
      { businessId: business.id, name: "Remera Branch", code: "REM", isDefault: false },
    ],
  });

  const passwordHash = await bcrypt.hash("demo1234", 10);

  const owner = await prisma.user.create({
    data: {
      businessId: business.id,
      branchId: branch.id,
      email: "jean@kigalifresh.rw",
      name: "Jean Baptiste",
      passwordHash,
      role: Role.OWNER,
      termsAcceptedAt: new Date(),
      salaryMonthly: 0,
    },
  });

  await prisma.user.createMany({
    data: [
      {
        businessId: business.id,
        branchId: branch.id,
        email: "aline@kigalifresh.rw",
        name: "Aline Uwase",
        passwordHash,
        role: Role.CASHIER,
        termsAcceptedAt: new Date(),
        salaryMonthly: 280_000,
      },
      {
        businessId: business.id,
        branchId: branch.id,
        email: "eric@kigalifresh.rw",
        name: "Eric Niyonshuti",
        passwordHash,
        role: Role.STOREKEEPER,
        termsAcceptedAt: new Date(),
        salaryMonthly: 320_000,
      },
    ],
  });

  const productDefs = [
    {
      name: "Rice 25kg Premium",
      category: "Staples",
      brand: "Mushrooms",
      sku: "RIC-25-PR",
      barcode: "6001234567890",
      costPrice: 28000,
      sellPrice: 34500,
      wholesalePrice: 31000,
      stockQty: 86,
      minStock: 40,
      unit: "bag",
    },
    {
      name: "Cooking Oil 5L",
      category: "Staples",
      brand: "Sunflower",
      sku: "OIL-5L-SF",
      barcode: "6001234567891",
      costPrice: 9800,
      sellPrice: 12500,
      wholesalePrice: 11200,
      stockQty: 22,
      minStock: 30,
      unit: "bottle",
    },
    {
      name: "Sugar 1kg",
      category: "Staples",
      brand: "Kabuye",
      sku: "SUG-1KG",
      barcode: "6001234567892",
      costPrice: 1100,
      sellPrice: 1400,
      wholesalePrice: 1250,
      stockQty: 340,
      minStock: 100,
      unit: "pack",
    },
    {
      name: "Paracetamol 500mg",
      category: "Pharmacy",
      brand: "PharmaCare",
      sku: "MED-PAR-500",
      barcode: "6001234567893",
      costPrice: 450,
      sellPrice: 800,
      wholesalePrice: 600,
      stockQty: 18,
      minStock: 50,
      unit: "box",
      taxExempt: true,
      taxRate: 0,
    },
    {
      name: "Cement 50kg",
      category: "Hardware",
      brand: "Cimerwa",
      sku: "HW-CEM-50",
      barcode: "6001234567894",
      costPrice: 9200,
      sellPrice: 11000,
      wholesalePrice: 10000,
      stockQty: 154,
      minStock: 80,
      unit: "bag",
    },
    {
      name: "Fresh Milk 1L",
      category: "Dairy",
      brand: "Inyange",
      sku: "DAI-MLK-1L",
      barcode: "6001234567895",
      costPrice: 950,
      sellPrice: 1300,
      wholesalePrice: 1100,
      stockQty: 64,
      minStock: 40,
      unit: "carton",
    },
    {
      name: "Soap Bar Multipack",
      category: "Household",
      brand: "Savon",
      sku: "HH-SOAP-MP",
      barcode: "6001234567896",
      costPrice: 2400,
      sellPrice: 3200,
      wholesalePrice: 2800,
      stockQty: 0,
      minStock: 25,
      unit: "pack",
    },
    {
      name: "Maize Flour 10kg",
      category: "Staples",
      brand: "Sosoma",
      sku: "MAZ-10KG",
      barcode: "6001234567897",
      costPrice: 7500,
      sellPrice: 9200,
      wholesalePrice: 8400,
      stockQty: 112,
      minStock: 50,
      unit: "bag",
    },
    {
      name: "Nike Air Sneaker",
      category: "Shoes",
      brand: "Nike",
      sku: "SHOE-NK-BLK-42",
      barcode: "6001234567901",
      size: "42",
      color: "Black",
      style: "Sneaker",
      costPrice: 45000,
      sellPrice: 65000,
      wholesalePrice: 52000,
      stockQty: 8,
      minStock: 3,
      unit: "pair",
    },
    {
      name: "Nike Air Sneaker",
      category: "Shoes",
      brand: "Nike",
      sku: "SHOE-NK-BLK-41",
      barcode: "6001234567902",
      size: "41",
      color: "Black",
      style: "Sneaker",
      costPrice: 45000,
      sellPrice: 65000,
      wholesalePrice: 52000,
      stockQty: 5,
      minStock: 3,
      unit: "pair",
    },
    {
      name: "Cotton Polo Shirt",
      category: "Clothes",
      brand: "LocalWear",
      sku: "CLT-POLO-BLU-M",
      barcode: "6001234567903",
      size: "M",
      color: "Blue",
      style: "Polo",
      costPrice: 8000,
      sellPrice: 15000,
      wholesalePrice: 11000,
      stockQty: 24,
      minStock: 10,
      unit: "pcs",
    },
    {
      name: "Cotton Polo Shirt",
      category: "Clothes",
      brand: "LocalWear",
      sku: "CLT-POLO-WHT-L",
      barcode: "6001234567904",
      size: "L",
      color: "White",
      style: "Polo",
      costPrice: 8000,
      sellPrice: 15000,
      wholesalePrice: 11000,
      stockQty: 16,
      minStock: 10,
      unit: "pcs",
    },
  ] as const;

  const products: Awaited<ReturnType<typeof prisma.product.create>>[] = [];
  for (const [index, p] of productDefs.entries()) {
    const { taxExempt, taxRate, ...rest } = p as typeof p & {
      taxExempt?: boolean;
      taxRate?: number;
    };
    const created = await prisma.product.create({
      data: {
        businessId: business.id,
        ...rest,
        taxExempt: taxExempt ?? false,
        taxRate: taxRate ?? 0.18,
        status: refreshStatus(p.stockQty, p.minStock),
        batchNumber: `B-2026-${String(index + 1).padStart(3, "0")}`,
      },
    });
    products.push(created);
  }

  const suppliers = await Promise.all([
    prisma.supplier.create({
      data: {
        businessId: business.id,
        name: "East Africa Distributors",
        category: "Staples",
        balance: 1_450_000,
        rating: 4.6,
        leadDays: 3,
      },
    }),
    prisma.supplier.create({
      data: {
        businessId: business.id,
        name: "PharmaLink Rwanda",
        category: "Pharmacy",
        balance: 620_000,
        rating: 4.8,
        leadDays: 2,
      },
    }),
    prisma.supplier.create({
      data: {
        businessId: business.id,
        name: "Inyange Industries",
        category: "Dairy",
        balance: 840_000,
        rating: 4.9,
        leadDays: 1,
      },
    }),
  ]);

  await prisma.customer.createMany({
    data: [
      {
        businessId: business.id,
        name: "Walk-in Customer",
        type: "Walk-in",
        segment: "Regular",
        balance: 0,
        points: 0,
      },
      {
        businessId: business.id,
        name: "Hotel des Mille Collines",
        type: "Credit",
        segment: "VIP",
        balance: 420_000,
        points: 1840,
      },
      {
        businessId: business.id,
        name: "Uwase Grace",
        type: "Walk-in",
        segment: "Regular",
        balance: 0,
        points: 320,
      },
      {
        businessId: business.id,
        name: "Kimisagara Hardware Co.",
        type: "Credit",
        segment: "Wholesale",
        balance: 680_000,
        points: 920,
      },
    ],
  });

  const oil = products.find((p) => p.sku === "OIL-5L-SF")!;
  const para = products.find((p) => p.sku === "MED-PAR-500")!;
  const soap = products.find((p) => p.sku === "HH-SOAP-MP")!;
  const shoe42 = products.find((p) => p.sku === "SHOE-NK-BLK-42")!;
  const shoe41 = products.find((p) => p.sku === "SHOE-NK-BLK-41")!;

  await prisma.purchaseOrder.create({
    data: {
      businessId: business.id,
      branchId: branch.id,
      supplierId: suppliers[0].id,
      number: "PO-2026-118",
      status: "ORDERED",
      totalCost: oil.costPrice * 80 + soap.costPrice * 40,
      lines: {
        create: [
          {
            productId: oil.id,
            qtyOrdered: 80,
            unitCost: oil.costPrice,
          },
          {
            productId: soap.id,
            qtyOrdered: 40,
            unitCost: soap.costPrice,
          },
        ],
      },
    },
  });

  await prisma.purchaseOrder.create({
    data: {
      businessId: business.id,
      branchId: branch.id,
      supplierId: suppliers[1].id,
      number: "PO-2026-119",
      status: "ORDERED",
      totalCost: para.costPrice * 60,
      lines: {
        create: [
          {
            productId: para.id,
            qtyOrdered: 60,
            unitCost: para.costPrice,
          },
        ],
      },
    },
  });

  // Apparel PO — practice partial receive / wrong size (42 ordered, may get 41)
  const shoeSupplier = await prisma.supplier.create({
    data: {
      businessId: business.id,
      name: "Kigali Footwear Hub",
      category: "Shoes",
      balance: 0,
      rating: 4.4,
      leadDays: 4,
    },
  });

  await prisma.purchaseOrder.create({
    data: {
      businessId: business.id,
      branchId: branch.id,
      supplierId: shoeSupplier.id,
      number: "PO-2026-120",
      status: "ORDERED",
      totalCost: shoe42.costPrice * 10,
      lines: {
        create: [
          {
            productId: shoe42.id,
            qtyOrdered: 10,
            unitCost: shoe42.costPrice,
          },
          {
            // Available alternate SKU if delivery is size 41 instead of 42
            productId: shoe41.id,
            qtyOrdered: 0,
            unitCost: shoe41.costPrice,
          },
        ].filter((l) => l.qtyOrdered > 0),
      },
    },
  });

  void shoe41; // available for receive-as-wrong-size demos

  const { ensureChartOfAccounts, postJournal } = await import("../src/lib/accounting");
  await ensureChartOfAccounts(prisma, business.id);

  const inventoryValue = products.reduce((s, p) => s + p.stockQty * p.costPrice, 0);
  if (inventoryValue > 0) {
    await postJournal(prisma, {
      businessId: business.id,
      description: "Opening inventory",
      refType: "Opening",
      lines: [
        { code: "1400", debit: inventoryValue },
        { code: "3000", credit: inventoryValue },
      ],
    });
  }

  // Seed opening cash float
  await postJournal(prisma, {
    businessId: business.id,
    description: "Opening cash float",
    refType: "Opening",
    lines: [
      { code: "1000", debit: 500_000 },
      { code: "3000", credit: 500_000 },
    ],
  });

  // Demo sales across periods so Reports period switcher has data
  const { postSaleJournal } = await import("../src/lib/accounting");
  const rice = products.find((p) => p.sku === "RIC-25-PR")!;
  const daysAgo = (n: number, hour = 10) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(hour, 15, 0, 0);
    return d;
  };
  const demoSales = [
    {
      number: "S-2026-1001",
      method: "CASH" as const,
      at: daysAgo(0, 9),
      items: [{ product: rice, qty: 2 }],
    },
    {
      number: "S-2026-1002",
      method: "MOMO" as const,
      at: daysAgo(1, 14),
      items: [{ product: oil, qty: 3 }],
    },
    {
      number: "S-2026-1003",
      method: "CARD" as const,
      at: daysAgo(3, 11),
      items: [
        { product: para, qty: 2 },
        { product: rice, qty: 1 },
      ],
    },
    {
      number: "S-2026-1004",
      method: "CASH" as const,
      at: daysAgo(10, 16),
      items: [{ product: oil, qty: 2 }],
    },
    {
      number: "S-2026-1005",
      method: "MOMO" as const,
      at: daysAgo(25, 12),
      items: [{ product: rice, qty: 1 }, { product: para, qty: 4 }],
    },
  ];

  for (const demo of demoSales) {
    let subtotal = 0;
    let taxAmt = 0;
    let cogs = 0;
    const lineRows: {
      productId: string;
      qty: number;
      unitPrice: number;
      taxAmt: number;
      lineTotal: number;
    }[] = [];

    for (const item of demo.items) {
      const p = item.product;
      const lineNet = p.sellPrice * item.qty;
      const lineTax = p.taxExempt ? 0 : Math.round(lineNet * p.taxRate);
      subtotal += lineNet;
      taxAmt += lineTax;
      cogs += p.costPrice * item.qty;
      lineRows.push({
        productId: p.id,
        qty: item.qty,
        unitPrice: p.sellPrice,
        taxAmt: lineTax,
        lineTotal: lineNet + lineTax,
      });
      await prisma.product.update({
        where: { id: p.id },
        data: {
          stockQty: { decrement: item.qty },
          status: refreshStatus(p.stockQty - item.qty, p.minStock),
        },
      });
      p.stockQty -= item.qty;
    }

    const total = subtotal + taxAmt;
    const sale = await prisma.sale.create({
      data: {
        businessId: business.id,
        branchId: branch.id,
        userId: owner.id,
        number: demo.number,
        status: "COMPLETED",
        paymentMethod: demo.method,
        subtotal,
        taxAmt,
        total,
        createdAt: demo.at,
        lines: { create: lineRows },
        payments: {
          create: [{ method: demo.method, amount: total }],
        },
      },
    });

    await postSaleJournal(prisma, {
      businessId: business.id,
      saleId: sale.id,
      saleNumber: sale.number,
      total,
      taxAmt,
      cogs,
      payments: [{ method: demo.method, amount: total }],
    });
  }

  console.log("Seeded RBIAP demo tenant");
  console.log("Login: jean@kigalifresh.rw / demo1234");
  console.log(`Owner id: ${owner.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
