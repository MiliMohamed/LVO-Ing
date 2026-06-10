"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { CrmCreateButton } from "@/components/crm/CrmCreateButton";
import { apiFetch } from "@/lib/api";
import { canMutate, normalizeRole } from "@/lib/rbac";
import type { OffreRow } from "@/lib/types";
import { readToken } from "@/lib/token-storage";

const COLUMN_ORDER = ["BROUILLON", "ENVOYEE", "EN COURS", "COMMANDEE", "ANNULEE"] as const;

function normalizeStatut(s: string): string {
  const u = s.trim().toUpperCase();
  if (u.includes("BROUIL")) return "BROUILLON";
  if (u.includes("ENVOY")) return "ENVOYEE";
  if (u.includes("COMMAND")) return "COMMANDEE";
  if (u.includes("ANNUL")) return "ANNULEE";
  if (u.includes("COURS") || u.includes("VALID")) return "EN COURS";
  return s.trim() || "—";
}

const COL_LABELS: Record<string, string> = {
  BROUILLON: "Brouillon",
  ENVOYEE: "Envoyée",
  "EN COURS": "En cours",
  COMMANDEE: "Commandée",
  ANNULEE: "Annulée",
  "—": "Autre",
};

export function PipelineClient() {
  const role = normalizeRole(readRole());
  const mutate = canMutate(role);
  const [offres, setOffres] = useState<OffreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const money = useMemo(() => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }), []);

  useEffect(() => {
    const token = readToken();
    let cancel = false;
    void (async () => {
      setLoading(true);
      try {
        const rows = (await apiFetch("/api/offres", { token })) as OffreRow[] | null;
        if (!cancel) setOffres(Array.isArray(rows) ? rows : []);
      } catch (e) {
        if (!cancel) setErr(e instanceof Error ? e.message : "Erreur");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const columns = useMemo(() => {
    const map = new Map<string, OffreRow[]>();
    for (const key of COLUMN_ORDER) map.set(key, []);
    map.set("—", []);

    for (const o of offres) {
      const col = normalizeStatut(String(o.statut ?? ""));
      if (!map.has(col)) map.set(col, []);
      map.get(col)!.push(o);
    }

    const ordered: { key: string; items: OffreRow[] }[] = [];
    const seen = new Set<string>();
    for (const key of COLUMN_ORDER) {
      if (map.has(key)) {
        ordered.push({ key, items: map.get(key)! });
        seen.add(key);
      }
    }
    for (const [key, items] of map) {
      if (!seen.has(key) && items.length) ordered.push({ key, items });
    }
    return ordered;
  }, [offres]);

  const totalHt = useMemo(
    () => offres.filter((o) => !String(o.statut).toUpperCase().includes("ANNUL")).reduce((s, o) => s + Number(o.montantHt), 0),
    [offres],
  );

  return (
    <>
      <header className="pg-hdr mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>Pipeline commercial</h1>
          <p>Vue Kanban des offres par statut — données temps réel API.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/crm/offres" className="cbtn cbtn-ghost cbtn-sm">
            Liste offres
          </Link>
          {mutate ? <CrmCreateButton slug="offre" /> : null}
        </div>
      </header>

      <div className="pipeline-summary mb-4 flex flex-wrap gap-3">
        <div className="kpi kp-navy" style={{ minWidth: 140 }}>
          <div className="kpi-label">Offres actives</div>
          <div className="kpi-val">{offres.filter((o) => !String(o.statut).toUpperCase().includes("ANNUL")).length}</div>
        </div>
        <div className="kpi kp-orange" style={{ minWidth: 160 }}>
          <div className="kpi-label">Montant HT (hors annulées)</div>
          <div className="kpi-val ov" style={{ fontSize: 18 }}>
            {money.format(totalHt)}
          </div>
        </div>
      </div>

      {err ? (
        <p className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{err}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-neutral-600">Chargement du pipeline…</p>
      ) : (
        <div className="pipeline-board" role="region" aria-label="Colonnes pipeline">
          {columns.map(({ key, items }) => (
            <div key={key} className="pipeline-col ccard">
              <div className="pipeline-col-head">
                <span className="pipeline-col-title">{COL_LABELS[key] ?? key}</span>
                <span className="pipeline-col-count">{items.length}</span>
              </div>
              <ul className="pipeline-cards">
                {items.length === 0 ? (
                  <li className="pipeline-empty">Aucune offre</li>
                ) : (
                  items.map((o) => (
                    <li key={o.id} className="pipeline-card">
                      <div className="pipeline-card-ref">{o.numeroOffre}</div>
                      <div className="pipeline-card-client">{o.clientNom}</div>
                      <div className="pipeline-card-meta">
                        {money.format(Number(o.montantHt))}
                        {o.typeMission ? ` · ${o.typeMission}` : ""}
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
