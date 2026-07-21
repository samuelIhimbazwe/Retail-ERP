import { getBankingData } from "@/lib/actions";
import { BankingClient } from "@/components/banking-client";

export default async function BankingPage() {
  const data = await getBankingData();
  return (
    <BankingClient
      accounts={data.accounts}
      totalLiquid={data.totalLiquid}
      todayIn={data.todayIn}
      todayOut={data.todayOut}
      cashbook={data.cashbook}
    />
  );
}
