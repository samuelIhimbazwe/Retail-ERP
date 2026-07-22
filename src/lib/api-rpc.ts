import { cookies } from "next/headers";

const TOKEN_COOKIE = "rbiap_token";

function apiBase() {
  return (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
}

export function isRemoteApiMode() {
  return Boolean(apiBase());
}

export async function callDomain(method: string, args: unknown[]) {
  const base = apiBase();

  // Local monolith: run domain logic in-process (needs DATABASE_URL)
  if (!base) {
    if (method === "isBootstrapped" || method === "bootstrapBusiness") {
      const boot = await import("@/lib/domain-bootstrap");
      const fn = boot[method as "isBootstrapped" | "bootstrapBusiness"];
      return (fn as (...a: unknown[]) => Promise<unknown>)(...args);
    }
    const actions = await import("@/lib/domain-actions");
    const fn = (actions as Record<string, (...a: unknown[]) => Promise<unknown>>)[method];
    if (!fn) throw new Error(`Unknown domain method: ${method}`);
    return fn(...args);
  }

  // Vercel web → Render API
  const jar = await cookies();
  const token = jar.get(TOKEN_COOKIE)?.value;
  const res = await fetch(`${base}/rpc`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ method, args }),
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    result?: unknown;
    error?: string;
  };

  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `API ${method} failed (${res.status})`);
  }
  return data.result;
}

export { TOKEN_COOKIE };
