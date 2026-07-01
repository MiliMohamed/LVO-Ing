import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { evaluateCrmRoute } from "@/lib/crm-route-access";
import { COOKIE_AUTH, COOKIE_CLIENT_AUTH, COOKIE_ASCENSORISTE_AUTH, COOKIE_EXPLOITATION_AUTH, COOKIE_ROLE } from "@/lib/session-cookie";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Espace client ──────────────────────────────────────────────────────────
  if (pathname.startsWith("/espace-client") && !pathname.startsWith("/espace-client/login")) {
    const clientAuth = request.cookies.get(COOKIE_CLIENT_AUTH)?.value;
    if (!clientAuth || clientAuth !== "1") {
      const login = request.nextUrl.clone();
      login.pathname = "/espace-client/login";
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
    return NextResponse.next();
  }

  // ── Espace ascensoriste ─────────────────────────────────────────────────────
  if (pathname.startsWith("/espace-ascensoriste") && !pathname.startsWith("/espace-ascensoriste/login")) {
    const ascensoristeAuth = request.cookies.get(COOKIE_ASCENSORISTE_AUTH)?.value;
    if (!ascensoristeAuth || ascensoristeAuth !== "1") {
      const login = request.nextUrl.clone();
      login.pathname = "/espace-ascensoriste/login";
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
    return NextResponse.next();
  }

  // ── Admin Exploitation (auth séparée de l'Admin CRM) ────────────────────────
  if (pathname.startsWith("/exploitation") && !pathname.startsWith("/exploitation/login")) {
    const exploitationAuth = request.cookies.get(COOKIE_EXPLOITATION_AUTH)?.value;
    if (!exploitationAuth || exploitationAuth !== "1") {
      const login = request.nextUrl.clone();
      login.pathname = "/exploitation/login";
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
    return NextResponse.next();
  }

  // ── CRM ────────────────────────────────────────────────────────────────────
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
  matcher: ["/crm/:path*", "/espace-client/:path*", "/espace-ascensoriste/:path*", "/exploitation/:path*"],
};
