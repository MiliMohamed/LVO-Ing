"use client";

import { useRouter } from "next/navigation";
import { ProgressSpinner } from "primereact/progressspinner";
import { useEffect, useState } from "react";

import { CrmSidebar } from "@/components/crm/CrmSidebar";
import { CrmTopNav } from "@/components/crm/CrmTopNav";
import { useDashboardCounts } from "@/components/crm/useDashboardCounts";
import { apiFetch } from "@/lib/api";
import { canAccessRecouvrement, canViewNavCounts, normalizeRole } from "@/lib/rbac";
import type { RecouvrementKpis } from "@/lib/types";
import { readRole, readToken } from "@/lib/token-storage";

export function CrmShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [recouvrementRetard, setRecouvrementRetard] = useState<number | null>(null);
  const [session, setSession] = useState<{ ready: boolean; hasToken: boolean }>({ ready: false, hasToken: false });

  useEffect(() => {
    const hasToken = !!readToken();
    setSession({ ready: true, hasToken });
    if (!hasToken) router.replace("/login");
  }, [router]);

  const hasToken = session.hasToken;
  const role = normalizeRole(readRole());
  const countsEnabled = session.ready && hasToken && canViewNavCounts(role);
  const { counts, loading: countsLoading } = useDashboardCounts(countsEnabled);

  useEffect(() => {
    if (!session.ready || !hasToken) return;
    const role = normalizeRole(readRole());
    if (!canAccessRecouvrement(role)) return;
    const token = readToken();
    let cancel = false;
    void (async () => {
      try {
        const k = (await apiFetch("/api/recouvrement/kpis", { token })) as RecouvrementKpis | null;
        if (!cancel && k && typeof k.facturesEnRetard === "number") setRecouvrementRetard(k.facturesEnRetard);
      } catch {
        if (!cancel) setRecouvrementRetard(null);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [session.ready, hasToken]);

  if (!session.ready || !hasToken) {
    return (
      <div className="lvo-crm-root flex min-h-screen items-center justify-center gap-3">
        <ProgressSpinner style={{ width: "2rem", height: "2rem" }} strokeWidth="4" />
        <p className="text-sm text-neutral-600">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="lvo-crm-root">
      <CrmTopNav role={role} counts={counts} countsLoading={countsLoading} />
      <div className="crm-layout">
        <CrmSidebar role={role} recouvrementRetard={recouvrementRetard} counts={counts} countsLoading={countsLoading} />
        <main className="crm-main">{children}</main>
      </div>
    </div>
  );
}
