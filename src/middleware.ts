import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

/** Keep this file Edge-tiny: no Auth.js, Prisma, lucide, or navigation imports. */

const TOKEN_COOKIE = "rbiap_token";

const ROLE_PREFIXES: Record<string, string[]> = {
  CASHIER: [
    "/counter",
    "/pos",
    "/stock-check",
    "/receive",
    "/quick-pay",
    "/dashboard",
    "/notifications",
    "/ai",
    "/products",
    "/inventory",
    "/customers",
    "/loyalty",
    "/settings",
  ],
  STOREKEEPER: [
    "/counter",
    "/stock-check",
    "/receive",
    "/dashboard",
    "/notifications",
    "/ai",
    "/products",
    "/inventory",
    "/warehouse",
    "/purchasing",
    "/procurement",
    "/settings",
  ],
  ACCOUNTANT: [
    "/dashboard",
    "/bi",
    "/ai",
    "/notifications",
    "/reports",
    "/customers",
    "/loyalty",
    "/accounting",
    "/tax",
    "/banking",
    "/payroll",
    "/settings",
  ],
};

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/setup" ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/reset") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/session") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  );
}

function canAccessPath(role: string, pathname: string) {
  if (role === "OWNER" || role === "MANAGER") return true;
  const prefixes = ROLE_PREFIXES[role];
  if (!prefixes) return false;
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function denyHome(role: string) {
  return role === "ACCOUNTANT" ? "/dashboard" : role === "STOREKEEPER" ? "/stock-check" : "/counter";
}

function hasAuthJsCookie(req: NextRequest) {
  return Boolean(
    req.cookies.get("authjs.session-token")?.value ||
      req.cookies.get("__Secure-authjs.session-token")?.value ||
      req.cookies.get("next-auth.session-token")?.value ||
      req.cookies.get("__Secure-next-auth.session-token")?.value,
  );
}

async function roleFromApiToken(token: string): Promise<string | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return payload.role ? String(payload.role) : null;
  } catch {
    return null;
  }
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const split = Boolean(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL);

  let loggedIn = false;
  let role: string | null = null;

  if (split) {
    const token = req.cookies.get(TOKEN_COOKIE)?.value;
    if (token) {
      role = await roleFromApiToken(token);
      loggedIn = Boolean(role);
    }
  } else {
    // Local monolith: cookie presence only (full Auth.js stays off the Edge bundle)
    loggedIn = hasAuthJsCookie(req);
  }

  if (!loggedIn && !isPublicPath(pathname)) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (loggedIn && (pathname === "/login" || pathname === "/setup")) {
    return NextResponse.redirect(new URL("/counter", req.nextUrl.origin));
  }

  if (loggedIn && (pathname.startsWith("/invite") || pathname.startsWith("/reset"))) {
    return NextResponse.redirect(new URL("/counter", req.nextUrl.origin));
  }

  if (loggedIn && role && !isPublicPath(pathname) && !canAccessPath(role, pathname)) {
    return NextResponse.redirect(new URL(denyHome(role), req.nextUrl.origin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
