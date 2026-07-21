import { getProducts } from "@/lib/actions";
import { ProductsClient } from "@/components/products-client";

export default async function ProductsPage() {
  const products = await getProducts(undefined, { includeInactive: true });
  return <ProductsClient initialProducts={products} />;
}
