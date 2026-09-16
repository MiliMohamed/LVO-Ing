"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { GlobalSearchPalette } from "@/components/crm/GlobalSearchPalette";
import { NotificationBell } from "@/components/crm/NotificationBell";
import { CrmUserMenu } from "@/components/crm/CrmUserMenu";
import { LVO_LOGO_ALT, LVO_LOGO_SRC } from "@/lib/branding";
import { getCrmHomeHref, getPageTitle, type AppRole } from "@/lib/rbac";
import type { DashboardCounts } from "@/lib/types";
import { clearSession } from "@/lib/token-storage";

type Props = {
  role: AppRole | null;
  counts: DashboardCounts | null;
  countsLoading?: boolean;
  onToggleSidebar?: () => void;
};

export function CrmTopNav({ role, onToggleSidebar }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const pageTitle = getPageTitle(pathname);

  function logout() {
    clearSession();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="crm-topbar" id="crm-nav">
      <button type="button" className="ctb-hamburger" onClick={onToggleSidebar} aria-label="Menu navigation">
        <span /><span /><span />
      </button>
      <Link href={getCrmHomeHref(role)} className="ctb-logo shrink-0">
        <Image src={LVO_LOGO_SRC} alt={LVO_LOGO_ALT} width={32} height={32} className="object-contain" />
        LVO CRM
      </Link>
      {pageTitle ? (
        <>
          <span className="ctb-crumb-sep hidden sm:inline" aria-hidden>/</span>
          <span className="ctb-crumb hidden sm:inline">{pageTitle}</span>
        </>
      ) : null}
      <div className="ctb-spacer" />
      <div className="ctb-right shrink-0">
        <GlobalSearchPalette />
        <NotificationBell />
        <Link href="/" className="ctb-link hidden md:inline shrink-0">
          ← Site public
        </Link>
        <CrmUserMenu onLogout={logout} />
      </div>
    </header>
  );
}
