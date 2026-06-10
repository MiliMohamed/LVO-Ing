"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { CrmAgenceFilter } from "@/components/crm/CrmAgenceFilter";
import { GlobalSearchPalette } from "@/components/crm/GlobalSearchPalette";
import { NotificationBell } from "@/components/crm/NotificationBell";
import { CrmUserMenu } from "@/components/crm/CrmUserMenu";
import { LVO_LOGO_ALT, LVO_LOGO_SRC } from "@/lib/branding";
import { fmtNavCount, NAV_COUNT_BY_HREF } from "@/lib/dashboard-counts";
import { canViewNavCounts, getCrmHomeHref, type AppRole } from "@/lib/rbac";
import type { DashboardCounts } from "@/lib/types";
import { clearSession } from "@/lib/token-storage";

const TOP_LINKS: { label: string; href: string; green?: boolean }[] = [
  { label: "Contacts", href: "/crm/contacts" },
  { label: "Clients", href: "/crm/clients" },
  { label: "Sites", href: "/crm/sites" },
  { label: "Offres", href: "/crm/offres" },
  { label: "Commandes", href: "/crm/commandes" },
  { label: "Factures", href: "/crm/factures", green: true },
  { label: "Rapports", href: "/crm/rapports" },
];

type Props = {
  role: AppRole | null;
  counts: DashboardCounts | null;
  countsLoading?: boolean;
};

export function CrmTopNav({ role, counts, countsLoading = false }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    clearSession();
    router.replace("/login");
    router.refresh();
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function badgeFor(href: string): string | null {
    if (!canViewNavCounts(role)) return null;
    const key = NAV_COUNT_BY_HREF[href];
    if (!key) return null;
    if (countsLoading && !counts) return "…";
    if (!counts) return "—";
    return fmtNavCount(counts[key] ?? 0);
  }

  return (
    <header className="crm-topbar" id="crm-nav">
      <Link href={getCrmHomeHref(role)} className="ctb-logo shrink-0">
        <Image src={LVO_LOGO_SRC} alt={LVO_LOGO_ALT} width={32} height={32} className="object-contain" />
        LVO CRM
      </Link>
      <span className="ctb-sep-site hidden sm:block" aria-hidden />
      <Link href="/" className="ctb-link hidden md:inline shrink-0">
        ← Site public
      </Link>
      <nav className="ctb-nav" aria-label="Raccourcis CRM">
        {TOP_LINKS.map((l) => {
          const badge = badgeFor(l.href);
          return (
            <Link key={l.href} href={l.href} className={isActive(l.href) ? "active" : undefined}>
              {l.label}
              {badge != null ? (
                <span
                  className={`ctb-num${l.green ? " g" : ""}${countsLoading && !counts ? " ctb-num--loading" : ""}`}
                  aria-label={`${l.label} : ${badge}`}
                >
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="ctb-right shrink-0">
        <CrmAgenceFilter />
        <NotificationBell />
        <GlobalSearchPalette />
        <CrmUserMenu onLogout={logout} />
      </div>
    </header>
  );
}
