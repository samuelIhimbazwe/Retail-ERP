import { getPayrollData } from "@/lib/actions";
import { PayrollClient } from "@/components/payroll-client";

export default async function PayrollPage() {
  const data = await getPayrollData();
  return <PayrollClient data={data} />;
}
