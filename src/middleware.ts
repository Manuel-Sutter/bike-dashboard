import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, computeSessionToken } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const password = process.env.DASHBOARD_PASSWORD;
  const expected = password ? await computeSessionToken(password) : null;
  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!expected || cookie !== expected) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
