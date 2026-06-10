"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  canViewNavCounts,
  itemVisible,
  SIDEBAR_PHASE2,
  type AppRole,
  type SidebarNavItem,
} from "@/lib/rbac";
import { fmtNavCount, NAV_COUNT_BY_HREF } from "@/lib/dashboard-counts";
import type { DashboardCounts } from "@/lib/types";

type Props = {
  role: AppRole | null;
  recouvrementRetard: number | null;
  counts: DashboardCounts | null;
  countsLoading?: boolean;
};

function SidebarLink({
  item,
  pathname,
  recouvrementRetard,
  counts,
  countsLoading,
  showNavCounts,
}: {
  item: SidebarNavItem;
  pathname: string;
  recouvrementRetard: number | null;
  counts: DashboardCounts | null;
  countsLoading?: boolean;
  showNavCounts: boolean;
}) {
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const retard =
    item.recouvrementBadge && recouvrementRetard != null && recouvrementRetard > 0 ? recouvrementRetard : 0;
  const countKey = NAV_COUNT_BY_HREF[item.href];
  let countBadge: string | null = null;
  if (showNavCounts && countKey) {
    if (countsLoading && !counts) countBadge = "…";
    else if (counts) countBadge = fmtNavCount(counts[countKey] ?? 0);
  }

  return (
    <Link href={item.href} className={`sb-it${active ? " active" : ""}`}>
      <span className="sb-ico" aria-hidden>
        {item.icon}
      </span>
      <span className="sb-txt">
        {item.label}
        {countBadge != null ? (
          <span className="sb-count" aria-label={`${item.label} : ${countBadge}`}>
            {countBadge}
          </span>
        ) : null}
        {retard > 0 ? (
          <span className="ml-1 inline-flex min-w-[1rem] justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">
            {retard > 99 ? "99+" : retard}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

export function CrmSidebar({ role, recouvrementRetard, counts, countsLoading = false }: Props) {
  const pathname = usePathname();
  const showNavCounts = canViewNavCounts(role);

  return (
    <aside className="crm-sidebar" aria-label="Navigation CRM">
      <p className="sb-intro">
        Espace métier LVO — listes, outils et historique. Utilisez le bouton orange en haut de chaque page pour créer un
        enregistrement.
      </p>
      {SIDEBAR_PHASE2.map((section) => {
        const items = section.items.filter((it) => itemVisible(it, role));
        if (!items.length) return null;
        return (
          <div key={section.title}>
            <div className="sb-lbl">{section.title}</div>
            {items.map((it) => (
              <SidebarLink
                key={it.href}
                item={it}
                pathname={pathname}
                recouvrementRetard={recouvrementRetard}
                counts={counts}
                countsLoading={countsLoading}
                showNavCounts={showNavCounts}
              />
            ))}
          </div>
        );
      })}
    </aside>
  );
}
