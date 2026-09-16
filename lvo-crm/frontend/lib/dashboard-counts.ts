import { apiFetch } from "@/lib/api";
import type { DashboardCounts } from "@/lib/types";
import { readToken } from "@/lib/token-storage";

const REFRESH_EVENT = "lvo-counts-refresh";

export async function fetchDashboardCounts(token = readToken()): Promise<DashboardCounts | null> {
  if (!token) return null;
  try {
    return (await apiFetch("/api/dashboard/counts", { token })) as DashboardCounts;
  } catch {
    return null;
  }
}

/** Déclenche un rechargement des compteurs navbar (après création / suppression). */
export function notifyCountsRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(REFRESH_EVENT));
  }
}

export function onCountsRefresh(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(REFRESH_EVENT, handler);
  return () => window.removeEventListener(REFRESH_EVENT, handler);
}

export function fmtNavCount(n: number): string {
  return n > 999 ? `${Math.round(n / 100) / 10}k` : `${n}`;
}

/** Associe un lien CRM à une clé de compteur API. */
export const NAV_COUNT_BY_HREF: Partial<Record<string, keyof DashboardCounts>> = {
  "/crm/contacts": "contacts",
  "/crm/clients": "clients",
  "/crm/sites": "sites",
  "/crm/offres": "offresActives",
  "/crm/commandes": "commandesActives",
  "/crm/factures": "factures",
};
