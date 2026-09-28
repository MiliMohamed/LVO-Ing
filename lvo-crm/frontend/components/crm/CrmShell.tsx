"use client";

import { useRouter } from "next/navigation";
import { ProgressSpinner } from "primereact/progressspinner";
import { useEffect, useState, useSyncExternalStore } from "react";

import { CrmSidebar } from "@/components/crm/CrmSidebar";
import { CrmTopNav } from "@/components/crm/CrmTopNav";
import { useDashboardCounts } from "@/components/crm/useDashboardCounts";
import { apiFetch } from "@/lib/api";
import { canAccessRecouvrement, canViewNavCounts, normalizeRole } from "@/lib/rbac";
import type { RecouvrementKpis } from "@/lib/types";
import { readRole, readToken } from "@/lib/token-storage";

/** Modales CRM (CrmEntityModal, aperçus) et dialogues PrimeReact (CrmDialog). */
const MODAL_SELECTOR = ".crm-modal-backdrop, .p-dialog-mask";

function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function subscribeModals(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

export function CrmShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [recouvrementRetard, setRecouvrementRetard] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // null côté serveur / pendant l'hydratation : le token (sessionStorage) n'est lisible qu'au navigateur.
  const hasToken = useSyncExternalStore<boolean | null>(
    subscribeStorage,
    () => !!readToken(),
    () => null,
  );
  const ready = hasToken !== null;

  // Replie la sidebar tant qu'une modale est ouverte, quelle que soit la page.
  const modalOpen = useSyncExternalStore(
    subscribeModals,
    () => !!document.querySelector(MODAL_SELECTOR),
    () => false,
  );
  const [prevModalOpen, setPrevModalOpen] = useState(modalOpen);
  if (modalOpen !== prevModalOpen) {
    setPrevModalOpen(modalOpen);
    if (modalOpen) setSidebarOpen(false);
  }

  useEffect(() => {
    if (hasToken === false) router.replace("/login");
  }, [hasToken, router]);

  const role = normalizeRole(readRole());
  const countsEnabled = ready && !!hasToken && canViewNavCounts(role);
  const { counts, loading: countsLoading } = useDashboardCounts(countsEnabled);

  useEffect(() => {
    if (!ready || !hasToken) return;
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
  }, [ready, hasToken]);

  if (!ready || !hasToken) {
    return (
      <div className="lvo-crm-root flex min-h-screen items-center justify-center gap-3">
        <ProgressSpinner style={{ width: "2rem", height: "2rem" }} strokeWidth="4" />
        <p className="text-sm text-neutral-600">Chargement…</p>
      </div>
    );
  }

  return (
    <div className={`lvo-crm-root${modalOpen ? " crm-modal-open" : ""}`}>
      <CrmTopNav role={role} counts={counts} countsLoading={countsLoading} onToggleSidebar={() => setSidebarOpen((v) => !v)} />
      <div className="crm-layout">
        {sidebarOpen && (
          <div
            className="crm-sidebar-overlay crm-sidebar-overlay--visible"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
        <CrmSidebar
          role={role}
          recouvrementRetard={recouvrementRetard}
          counts={counts}
          countsLoading={countsLoading}
          isOpen={sidebarOpen}
        />
        <main className="crm-main" onClick={() => sidebarOpen && setSidebarOpen(false)}>
          {children}
        </main>
      </div>
    </div>
  );
}
