"use server";

import { callDomain } from "@/lib/api-rpc";

export async function isBootstrapped(...args: Parameters<typeof import("@/lib/domain-bootstrap").isBootstrapped>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-bootstrap").isBootstrapped>>> {
  return (await callDomain("isBootstrapped", args)) as Awaited<ReturnType<typeof import("@/lib/domain-bootstrap").isBootstrapped>>;
}

export async function bootstrapBusiness(...args: Parameters<typeof import("@/lib/domain-bootstrap").bootstrapBusiness>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-bootstrap").bootstrapBusiness>>> {
  return (await callDomain("bootstrapBusiness", args)) as Awaited<ReturnType<typeof import("@/lib/domain-bootstrap").bootstrapBusiness>>;
}
