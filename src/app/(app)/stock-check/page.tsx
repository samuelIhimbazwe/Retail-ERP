import { getProducts } from "@/lib/actions";
import { StockCheckClient } from "@/components/stock-check-client";

export default async function StockCheckPage() {
  const products = await getProducts();
  return <StockCheckClient initialProducts={products} />;
}
