"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ActivityFeed } from "@/components/crm/ActivityFeed";
import { CrmCreateButton } from "@/components/crm/CrmCreateButton";
import { apiFetch } from "@/lib/api";
import {
  canAccessRecouvrement,
  canMutate,
  canUsePhase2Tools,
  normalizeRole,
  roleBadgeLabel,
  type AppRole,
} from "@/lib/rbac";
import type { OffreRow } from "@/lib/types";
import { readRole, readToken } from "@/lib/token-storage";

type Shortcut = {
  href: string;
  icon: string;
  label: string;
  hint: string;
  roles?: readonly AppRole[];
};

const SHORTCUTS: Shortcut[] = [
  { href: "/crm/contacts", icon: "◇", label: "Contacts", hint: "Annuaire & relances" },
  { href: "/crm/clients", icon: "◎", label: "Clients", hint: "Comptes & SIRET" },
  { href: "/crm/sites", icon: "▣", label: "Sites", hint: "Parc & gestionnaires" },
  { href: "/crm/offres", icon: "▤", label: "Offres", hint: "Devis & missions" },
  { href: "/crm/commandes", icon: "▦", label: "Commandes", hint: "Suivi chantier" },
  { href: "/crm/factures", icon: "€", label: "Factures", hint: "Émission & suivi" },
  { href: "/crm/pipeline", icon: "⬡", label: "Pipeline", hint: "Kanban offres" },
  { href: "/crm/taches", icon: "✓", label: "Mes tâches", hint: "Rappels & suivi" },
  { href: "/crm/notifications", icon: "🔔", label: "Notifications", hint: "Alertes métier" },
  { href: "/crm/rapports", icon: "▨", label: "Rapports", hint: "Exports & historique" },
  {
    href: "/crm/recouvrement",
    icon: "💰",
    label: "Recouvrement",
    hint: "Impayés & relances",
    roles: ["ADMIN", "MANAGER"],
  },
  {
    href: "/crm/outils/planning",
    icon: "◴",
    label: "Planning",
    hint: "Jalons & Gantt",
  },
  {
    href: "/crm/outils/documents",
    icon: "DOC",
    label: "Documents",
    hint: "PDF / Word",
    roles: ["ADMIN", "MANAGER", "CONSULTANT"],
  },
];

function visibleShortcut(s: Shortcut, role: AppRole | null): boolean {
  if (!role) return false;
  if (!s.roles) return true;
  return s.roles.includes(role);
}

export function CrmAccueilClient() {
  const role = normalizeRole(readRole());
  const mutate = canMutate(role);
  const [offres, setOffres] = useState<OffreRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const token = readToken();
    let cancel = false;
    void (async () => {
      try {
        const rows = (await apiFetch("/api/offres", { token })) as OffreRow[] | null;
        if (!cancel) setOffres(Array.isArray(rows) ? rows.slice(0, 8) : []);
      } catch (e) {
        if (!cancel) setErr(e instanceof Error ? e.message : "Erreur chargement");
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const shortcuts = useMemo(() => SHORTCUTS.filter((s) => visibleShortcut(s, role)), [role]);

  const pipelinePreview = useMemo(() => {
    const by: Record<string, number> = {};
    for (const o of offres) {
      const k = o.statut?.trim() || "—";
      by[k] = (by[k] || 0) + 1;
    }
    return Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [offres]);

  return (
    <>
      <header className="pg-hdr mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="accueil-eyebrow">Espace collaborateur</p>
          <h1>Accueil CRM</h1>
          <p>
            Bienvenue — profil <strong>{roleBadgeLabel(role)}</strong>. Les indicateurs globaux (KPI) sont réservés à
            l&apos;administrateur via le menu <em>Dashboard KPI</em>.
          </p>
        </div>
        {mutate ? (
          <div className="flex flex-wrap gap-2">
            <CrmCreateButton slug="offre" />
            <CrmCreateButton slug="contact" />
          </div>
        ) : null}
      </header>

      {err ? (
        <p className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">{err}</p>
      ) : null}

      <div className="accueil-hero ccard mb-4">
        <div className="accueil-hero-grid">
          <div>
            <h2 className="accueil-hero-title">Vos modules métier</h2>
            <p className="text-sm text-neutral-600">
              {mutate
                ? "Créez et mettez à jour les fiches via les boutons orange ou les listes CRM."
                : "Mode lecture seule : parcourez les listes sans modifier les données."}
            </p>
            {canUsePhase2Tools(role) ? (
              <Link href="/crm/outils/assistants" className="cbtn cbtn-ghost cbtn-sm mt-3 inline-flex">
                Assistants OCR / IA →
              </Link>
            ) : null}
            {canAccessRecouvrement(role) ? (
              <Link href="/crm/recouvrement" className="cbtn cbtn-orange cbtn-sm mt-3 ml-2 inline-flex">
                Recouvrement →
              </Link>
            ) : null}
          </div>
          {pipelinePreview.length > 0 ? (
            <div className="accueil-pipeline-mini" aria-label="Aperçu statuts offres">
              <div className="ccard-title mb-2">Aperçu offres (échantillon)</div>
              <ul className="accueil-stat-list">
                {pipelinePreview.map(([statut, n]) => (
                  <li key={statut}>
                    <span>{statut}</span>
                    <strong>{n}</strong>
                  </li>
                ))}
              </ul>
              <Link href="/crm/pipeline" className="cbtn cbtn-ghost cbtn-sm mt-2 inline-flex">
                Voir le pipeline →
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        <ActivityFeed limit={6} />
        <div className="ccard">
          <div className="ccard-title">Conseil navigation</div>
          <p className="text-sm text-neutral-600">
            Utilisez le filtre <strong>Périmètre</strong> en haut à droite pour limiter les listes par agence (Paris,
            Réunion, PACA). Les KPI dashboard restent globaux pour l&apos;administrateur.
          </p>
        </div>
      </div>

      <div className="accueil-shortcuts">
        {shortcuts.map((s) => (
          <Link key={s.href} href={s.href} className="accueil-tile ccard">
            <span className="accueil-tile-icon" aria-hidden>
              {s.icon}
            </span>
            <span className="accueil-tile-label">{s.label}</span>
            <span className="accueil-tile-hint">{s.hint}</span>
          </Link>
        ))}
      </div>

      <div className="ccard mt-4">
        <div className="ccard-title">Dernières offres consultables</div>
        {offres.length === 0 ? (
          <p className="text-xs text-neutral-600">Aucune offre chargée pour le moment.</p>
        ) : (
          <div className="tw">
            <table className="ct" style={{ fontSize: 11 }}>
              <thead>
                <tr>
                  <th>Réf.</th>
                  <th>Client</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {offres.map((o) => (
                  <tr key={o.id}>
                    <td className="td-mono">{o.numeroOffre}</td>
                    <td>{o.clientNom}</td>
                    <td>{o.statut}</td>
                    <td>
                      <Link href="/crm/offres" className="cbtn cbtn-ghost cbtn-sm">
                        Liste →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
