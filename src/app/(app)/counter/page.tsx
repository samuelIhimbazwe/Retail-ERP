import { requireWebSession } from "@/lib/web-session";
import { CounterClient } from "@/components/counter-client";

export default async function CounterPage() {
  const session = await requireWebSession();
  return <CounterClient businessName={session.user.businessName} />;
}
