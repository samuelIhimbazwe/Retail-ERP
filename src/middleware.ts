import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { canAccessPath } from "@/lib/rbac";
import { verifyApiToken } from "@/lib/api-token";

const TOKEN_COOKIE = "rbiap_token";

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

function remoteApiConfigured(req: NextRequest) {
  return Boolean(
    process.env.API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      req.nextUrl.searchParams.get("__api"), // unused; env only
  );
}

function denyHome(role: string) {
  return role === "ACCOUNTANT" ? "/dashboard" : role === "STOREKEEPER" ? "/stock-check" : "/counter";
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const split = Boolean(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL);

  let loggedIn = false;
  let role: string | null = null;

  if (split) {
    const token = req.cookies.get(TOKEN_COOKIE)?.value;
    if (token) {
      try {
        const user = await verifyApiToken(token);
        loggedIn = true;
        role = String(user.role);
      } catch {
        loggedIn = false;
      }
    }
  } else {
    const session = await auth();
    loggedIn = !!session?.user;
    role = session?.user?.role ? String(session.user.role) : null;
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
