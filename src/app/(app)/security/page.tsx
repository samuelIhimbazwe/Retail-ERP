import { getSecurityData } from "@/lib/actions";
import { SecurityClient } from "@/components/security-client";

export default async function SecurityPage() {
  const data = await getSecurityData();
  return <SecurityClient data={data} />;
}
