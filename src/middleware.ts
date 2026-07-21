import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { canAccessPath } from "@/lib/rbac";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  const isPublic =
    pathname === "/login" ||
    pathname === "/setup" ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/reset") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  if (!isLoggedIn && !isPublic) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && (pathname === "/login" || pathname === "/setup")) {
    return NextResponse.redirect(new URL("/counter", req.nextUrl.origin));
  }

  if (isLoggedIn && (pathname.startsWith("/invite") || pathname.startsWith("/reset"))) {
    return NextResponse.redirect(new URL("/counter", req.nextUrl.origin));
  }

  if (isLoggedIn && req.auth?.user?.role && !isPublic) {
    const role = String(req.auth.user.role);
    if (!canAccessPath(role, pathname)) {
      const home =
        role === "ACCOUNTANT"
          ? "/dashboard"
          : role === "STOREKEEPER"
            ? "/stock-check"
            : "/counter";
      return NextResponse.redirect(new URL(home, req.nextUrl.origin));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
