import { getIntegrationsData } from "@/lib/actions";
import { IntegrationsClient } from "@/components/integrations-client";

export default async function IntegrationsPage() {
  const data = await getIntegrationsData();
  return <IntegrationsClient data={data} />;
}
