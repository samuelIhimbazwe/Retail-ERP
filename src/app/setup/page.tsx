import { redirect } from "next/navigation";
import { isBootstrapped } from "@/lib/bootstrap";
import { SetupClient } from "@/components/setup-client";

export default async function SetupPage() {
  if (await isBootstrapped()) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--surface)] px-4 py-10">
      <SetupClient />
    </div>
  );
}
