import { getProducts, getStockMovements } from "@/lib/actions";
import { InventoryClient } from "@/components/inventory-client";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const params = await searchParams;
  const [products, movements] = await Promise.all([
    getProducts(undefined, { includeInactive: true }),
    getStockMovements(80),
  ]);
  return (
    <InventoryClient
      products={products}
      movements={movements}
      initialProductId={params.product}
    />
  );
}
