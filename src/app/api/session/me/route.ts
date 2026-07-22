import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { TOKEN_COOKIE } from "@/lib/api-rpc";
import { verifyApiToken } from "@/lib/api-token";

export async function GET() {
  const api = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;

  if (api && token) {
    try {
      const user = await verifyApiToken(token);
      return NextResponse.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          businessId: user.businessId,
          branchId: user.branchId,
          businessName: user.businessName,
          branchName: user.branchName,
        },
      });
    } catch {
      return NextResponse.json({ user: null }, { status: 401 });
    }
  }

  // Monolith / Auth.js path is handled by next-auth session endpoint
  return NextResponse.json({ user: null }, { status: 401 });
}
