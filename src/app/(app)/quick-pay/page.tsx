import { getDebtors } from "@/lib/actions";
import { QuickPayClient } from "@/components/quick-pay-client";

export default async function QuickPayPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>;
}) {
  const params = await searchParams;
  const debtors = await getDebtors();
  const totalOwed = debtors.reduce((s, c) => s + c.balance, 0);
  return (
    <QuickPayClient
      debtors={debtors}
      totalOwed={totalOwed}
      initialCustomerId={params.customer}
    />
  );
}
