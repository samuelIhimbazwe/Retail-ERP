import { getAccountingData } from "@/lib/actions";
import { AccountingClient } from "@/components/accounting-client";

export default async function AccountingPage() {
  const data = await getAccountingData();
  return (
    <AccountingClient
      accounts={data.accounts}
      accountOptions={data.accountOptions}
      journals={data.journals}
      totals={data.totals}
      cash={data.cash}
      bank={data.bank}
      momo={data.momo}
      ar={data.ar}
      ap={data.ap}
    />
  );
}
