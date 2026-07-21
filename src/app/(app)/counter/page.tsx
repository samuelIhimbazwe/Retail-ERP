import { requireSession } from "@/auth";
import { CounterClient } from "@/components/counter-client";

export default async function CounterPage() {
  const session = await requireSession();
  return <CounterClient businessName={session.user.businessName} />;
}
