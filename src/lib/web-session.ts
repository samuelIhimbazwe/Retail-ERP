import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyApiToken } from "@/lib/api-token";
import { TOKEN_COOKIE } from "@/lib/api-rpc";

export type WebSessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  businessId: string;
  branchId: string | null;
  businessName: string;
  branchName: string | null;
};

function isRemoteApiMode() {
  return Boolean(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL);
}

/** Session for Next.js pages on Vercel (API JWT) or local monolith (Auth.js). */
export async function requireWebSession(): Promise<{ user: WebSessionUser }> {
  if (isRemoteApiMode()) {
    const token = (await cookies()).get(TOKEN_COOKIE)?.value;
    if (!token) redirect("/login");
    try {
      const user = await verifyApiToken(token);
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: String(user.role),
          businessId: user.businessId,
          branchId: user.branchId,
          businessName: user.businessName,
          branchName: user.branchName,
        },
      };
    } catch {
      redirect("/login");
    }
  }

  const { requireSession } = await import("@/auth");
  const session = await requireSession();
  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: String(session.user.role),
      businessId: session.user.businessId,
      branchId: session.user.branchId,
      businessName: session.user.businessName,
      branchName: session.user.branchName,
    },
  };
}
