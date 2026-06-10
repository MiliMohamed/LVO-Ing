"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { readToken } from "@/lib/token-storage";

export type ActivityItem = {
  id: number;
  entityType: string;
  entityId: number;
  action: string;
  performedBy: string;
  performedAt: string;
  summary: string;
};

const ENTITY_LINK: Record<string, string> = {
  OFFRE: "/crm/offres",
  COMMANDE: "/crm/commandes",
  CLIENT: "/crm/clients",
  CONTACT: "/crm/contacts",
  SITE: "/crm/sites",
  FACTURE: "/crm/factures",
};

function fmtTime(iso: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function ActivityFeed({ limit = 8, title = "Activité récente" }: { limit?: number; title?: string }) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = readToken();
    let cancel = false;
    void (async () => {
      try {
        const data = (await apiFetch(`/api/activity/recent?limit=${limit}`, { token })) as ActivityItem[] | null;
        if (!cancel) setItems(Array.isArray(data) ? data : []);
      } catch {
        if (!cancel) setItems([]);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [limit]);

  return (
    <div className="ccard">
      <div className="ccard-title flex items-center justify-between gap-2">
        <span>{title}</span>
        <Link href="/crm/taches" className="cbtn cbtn-ghost cbtn-sm">
          Mes tâches →
        </Link>
      </div>
      {loading ? (
        <p className="text-xs text-neutral-600">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-neutral-600">Aucune activité enregistrée pour le moment.</p>
      ) : (
        <ul className="activity-feed-list">
          {items.map((a) => {
            const href = ENTITY_LINK[a.entityType.toUpperCase()] ?? "/crm/accueil";
            return (
              <li key={a.id} className="activity-feed-item">
                <span className="activity-feed-dot" aria-hidden />
                <div className="activity-feed-body">
                  <p className="activity-feed-summary">{a.summary}</p>
                  <p className="activity-feed-meta">
                    {fmtTime(a.performedAt)} · {a.performedBy}
                  </p>
                  <Link href={href} className="activity-feed-link">
                    Voir {a.entityType.toLowerCase()} →
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
