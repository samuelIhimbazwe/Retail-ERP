import { getCustomersData } from "@/lib/actions";
import { CustomersClient } from "@/components/customers-client";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>;
}) {
  const params = await searchParams;
  const data = await getCustomersData({ includeInactive: true });
  return (
    <CustomersClient
      customers={data.customers}
      withDebt={data.withDebt}
      debtTotal={data.debtTotal}
      initialCustomerId={params.customer}
    />
  );
}
