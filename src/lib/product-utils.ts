import { ProductStatus } from "@prisma/client";

export function computeProductStatus(stockQty: number, minStock: number): ProductStatus {
  if (stockQty <= 0) return ProductStatus.OUT_OF_STOCK;
  if (stockQty <= minStock) return ProductStatus.LOW_STOCK;
  return ProductStatus.ACTIVE;
}

export function formatStatusLabel(status: ProductStatus): string {
  switch (status) {
    case ProductStatus.ACTIVE:
      return "Active";
    case ProductStatus.LOW_STOCK:
      return "Low Stock";
    case ProductStatus.OUT_OF_STOCK:
      return "Out of Stock";
    case ProductStatus.EXPIRING:
      return "Expiring";
    case ProductStatus.INACTIVE:
      return "Inactive";
    default:
      return status;
  }
}

export type CatalogProduct = {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  sku: string;
  barcode: string | null;
  size: string | null;
  color: string | null;
  style: string | null;
  cost: number;
  sell: number;
  wholesale: number;
  stock: number;
  minStock: number;
  unit: string;
  tax: string;
  taxRate: number;
  taxExempt: boolean;
  status: string;
  batch: string;
  expiry: string;
};

export function productMatchesQuery(
  p: Pick<CatalogProduct, "name" | "sku" | "barcode" | "category" | "brand" | "size" | "color" | "style">,
  query: string,
) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  const haystack = [p.name, p.sku, p.barcode, p.category, p.brand, p.size, p.color, p.style]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return tokens.every((t) => haystack.includes(t));
}

export function variantLabel(p: Pick<CatalogProduct, "size" | "color" | "style" | "brand">) {
  return [p.brand, p.color, p.size, p.style].filter(Boolean).join(" · ");
}

export function toCatalogProduct(p: {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  sku: string;
  barcode: string | null;
  size?: string | null;
  color?: string | null;
  style?: string | null;
  costPrice: number;
  sellPrice: number;
  wholesalePrice: number | null;
  stockQty: number;
  minStock: number;
  unit: string;
  taxRate: number;
  taxExempt: boolean;
  status: ProductStatus;
  batchNumber: string | null;
  expiryDate: Date | null;
}): CatalogProduct {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    brand: p.brand,
    sku: p.sku,
    barcode: p.barcode,
    size: p.size ?? null,
    color: p.color ?? null,
    style: p.style ?? null,
    cost: p.costPrice,
    sell: p.sellPrice,
    wholesale: p.wholesalePrice ?? p.costPrice,
    stock: p.stockQty,
    minStock: p.minStock,
    unit: p.unit,
    tax: p.taxExempt ? "Exempt" : `VAT ${Math.round(p.taxRate * 100)}%`,
    taxRate: p.taxRate,
    taxExempt: p.taxExempt,
    status: formatStatusLabel(p.status),
    batch: p.batchNumber ?? "—",
    expiry: p.expiryDate ? p.expiryDate.toISOString().slice(0, 10) : "—",
  };
}
