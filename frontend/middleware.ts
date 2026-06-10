import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { evaluateCrmRoute } from "@/lib/crm-route-access";
import { COOKIE_AUTH, COOKIE_ROLE } from "@/lib/session-cookie";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/crm")) {
    return NextResponse.next();
  }

  const auth = request.cookies.get(COOKIE_AUTH)?.value;
  const role = request.cookies.get(COOKIE_ROLE)?.value;

  if (!auth || auth !== "1") {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  const decision = evaluateCrmRoute(pathname, role ? decodeURIComponent(role) : null);

  if (decision.decision === "login") {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (decision.decision === "redirect") {
    const dest = request.nextUrl.clone();
    dest.pathname = decision.href;
    dest.search = "";
    return NextResponse.redirect(dest);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/crm/:path*"],
};
