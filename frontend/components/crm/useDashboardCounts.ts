"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { fetchDashboardCounts, onCountsRefresh } from "@/lib/dashboard-counts";
import type { DashboardCounts } from "@/lib/types";

export function useDashboardCounts(enabled: boolean) {
  const pathname = usePathname();
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    const data = await fetchDashboardCounts();
    setCounts(data);
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    return onCountsRefresh(() => {
      void refresh();
    });
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [pathname, enabled, refresh]);

  return { counts, loading, refresh };
}
