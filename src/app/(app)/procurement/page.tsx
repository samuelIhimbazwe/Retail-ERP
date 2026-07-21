import { getProcurementData } from "@/lib/actions";
import { ProcurementClient } from "@/components/procurement-client";

export default async function ProcurementPage() {
  const data = await getProcurementData();
  return (
    <ProcurementClient
      recommendations={data.recommendations}
      supplierOptions={data.supplierOptions}
      estTotal={data.estTotal}
    />
  );
}
