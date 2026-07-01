"use client";

import { createContext, createElement, useContext, useEffect, useMemo, useState } from "react";
import type { SiteRow } from "@/lib/types";
import { clientApiFetch } from "@/lib/client-api";

const LS_KEY = "lvo_client_selected_site_id";

export function safeParseNumber(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// ── Internal hook (used by the provider) ─────────────────────────────────────
export function useClientSitesAndSelection() {
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const s = await clientApiFetch<SiteRow[]>("/api/client/sites");
        setSites(s);

        const stored = safeParseNumber(globalThis.localStorage.getItem(LS_KEY));
        const fallback = s[0]?.id ?? null;
        const chosen = stored != null && s.some((x) => x.id === stored) ? stored : fallback;
        setSelectedSiteId(chosen);
        if (chosen != null) globalThis.localStorage.setItem(LS_KEY, String(chosen));
        else globalThis.localStorage.removeItem(LS_KEY);
      } catch {
        setError("Impossible de charger les sites.");
        setSites([]);
      }
    })();
  }, []);

  const selectedSite = useMemo(() => {
    if (!sites || selectedSiteId == null) return null;
    return sites.find((s) => s.id === selectedSiteId) ?? null;
  }, [sites, selectedSiteId]);

  return { sites, selectedSiteId, selectedSite, setSelectedSiteId, error };
}

// ── React Context ─────────────────────────────────────────────────────────────
export type SiteContextValue = {
  sites: SiteRow[];
  selectedSiteId: number | null;
  selectedSite: SiteRow | null;
  setSiteId: (id: number | null) => void;
  loading: boolean;
  error: string | null;
};

export const SiteCtx = createContext<SiteContextValue>({
  sites: [],
  selectedSiteId: null,
  selectedSite: null,
  setSiteId: () => undefined,
  loading: true,
  error: null,
});

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const { sites, selectedSiteId, selectedSite, setSelectedSiteId, error } = useClientSitesAndSelection();
  const loading = sites.length === 0 && error === null;

  function setSiteId(id: number | null) {
    setSelectedSiteId(id);
    if (id != null) globalThis.localStorage.setItem(LS_KEY, String(id));
    else globalThis.localStorage.removeItem(LS_KEY);
  }

  return createElement(
    SiteCtx.Provider,
    { value: { sites, selectedSiteId, selectedSite, setSiteId, loading, error } },
    children,
  );
}

export function useSelectedSite() {
  return useContext(SiteCtx);
}
