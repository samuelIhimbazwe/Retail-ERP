import { NextResponse } from "next/server";
import { TOKEN_COOKIE } from "@/lib/api-rpc";

export async function POST(req: Request) {
  const api = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
  if (!api) {
    return NextResponse.json({ ok: false, error: "API_URL not configured" }, { status: 500 });
  }

  const body = await req.json();
  const res = await fetch(`${api}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || !data?.ok || !data.token) {
    return NextResponse.json(
      { ok: false, error: data?.error || "Invalid email or password" },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true, user: data.user });
  response.cookies.set(TOKEN_COOKIE, data.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(TOKEN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
