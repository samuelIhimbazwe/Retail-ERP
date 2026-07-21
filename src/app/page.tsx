import { redirect } from "next/navigation";
import { isBootstrapped } from "@/lib/bootstrap";

export default async function Home() {
  if (!(await isBootstrapped())) {
    redirect("/setup");
  }
  redirect("/login");
}
