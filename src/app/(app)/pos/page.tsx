import { getCustomers, getProducts } from "@/lib/actions";
import { requireWebSession } from "@/lib/web-session";
import { PosClient } from "@/components/pos-client";

export default async function PosPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const params = await searchParams;
  const [session, products, customers] = await Promise.all([
    requireWebSession(),
    getProducts(),
    getCustomers(),
  ]);

  return (
    <PosClient
      businessName={session.user.businessName}
      initialProducts={products}
      initialProductId={params.product}
      customers={customers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        balance: c.balance,
        type: c.type,
      }))}
    />
  );
}
