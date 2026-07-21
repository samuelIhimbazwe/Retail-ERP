import { redirect } from "next/navigation";
import { isBootstrapped } from "@/lib/bootstrap";
import LoginPageClient from "./login-client";

export default async function LoginPage() {
  if (!(await isBootstrapped())) {
    redirect("/setup");
  }
  return <LoginPageClient />;
}
