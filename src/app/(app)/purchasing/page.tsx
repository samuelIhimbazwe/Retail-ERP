import { getPurchasingData, getPurchasingFormOptions } from "@/lib/actions";
import { PurchasingClient } from "@/components/purchasing-client";

export default async function PurchasingPage({
  searchParams,
}: {
  searchParams: Promise<{ pay?: string; po?: string; product?: string }>;
}) {
  const params = await searchParams;
  const [data, formOptions] = await Promise.all([
    getPurchasingData(),
    getPurchasingFormOptions(),
  ]);

  return (
    <PurchasingClient
      suppliers={data.suppliers}
      purchaseOrders={data.purchaseOrders}
      openCount={data.openCount}
      payableTotal={data.payableTotal}
      formOptions={formOptions}
      initialPaySupplierId={params.pay}
      initialPoId={params.po}
      initialProductId={params.product}
    />
  );
}
