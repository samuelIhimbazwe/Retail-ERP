import { getOpenPurchaseOrders, getProducts } from "@/lib/actions";
import { ReceiveClient } from "@/components/receive-client";

export default async function ReceivePage({
  searchParams,
}: {
  searchParams: Promise<{ po?: string }>;
}) {
  const params = await searchParams;
  const [orders, products] = await Promise.all([getOpenPurchaseOrders(), getProducts()]);

  return (
    <ReceiveClient
      initialPoId={params.po}
      orders={orders.map((po) => ({
        id: po.id,
        number: po.number,
        supplier: po.supplier.name,
        total: po.totalCost,
        date: po.orderDate.toISOString().slice(0, 10),
        status: po.status.replaceAll("_", " "),
        lines: po.lines.map((l) => ({
          id: l.id,
          productId: l.productId,
          productName: l.product.name,
          size: l.product.size,
          color: l.product.color,
          qtyOrdered: l.qtyOrdered,
          qtyReceived: l.qtyReceived,
          unitCost: l.unitCost,
        })),
      }))}
      alternateProducts={products.map((p) => ({
        id: p.id,
        name: p.name,
        size: p.size,
        color: p.color,
      }))}
    />
  );
}
