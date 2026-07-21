import { getWarehouseData } from "@/lib/actions";
import { WarehouseClient } from "@/components/warehouse-client";

export default async function WarehousePage() {
  const data = await getWarehouseData();
  return <WarehouseClient data={data} />;
}
