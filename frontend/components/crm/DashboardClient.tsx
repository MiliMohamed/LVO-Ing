"use client";

import { Bar, Doughnut } from "react-chartjs-2";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { CrmCreateButton } from "@/components/crm/CrmCreateButton";
import { apiFetch } from "@/lib/api";
import { canMutate, normalizeRole } from "@/lib/rbac";
import type { DashboardCounts, OffreRow } from "@/lib/types";
import { readRole, readToken } from "@/lib/token-storage";

import { registerCharts } from "./chart-register";

registerCharts();

const NAV = "#1A2B4C";
const ORA = "#FF6B00";
const STL = "#8E9DAE";
const GRN = "#19a249";

const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

function badge(statut: string) {
  const s = statut.toUpperCase();
  if (s.includes("COMMAND")) return "b-cmd";
  if (s.includes("ENVOY")) return "b-env";
  return "b-navy";
}

export function DashboardClient() {
  const mutate = canMutate(normalizeRole(readRole()));
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [offres, setOffres] = useState<OffreRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const token = readToken();
    let c = false;
    void (async () => {
      try {
        const [co, of] = await Promise.all([
          apiFetch("/api/dashboard/counts", { token }) as Promise<DashboardCounts | null>,
          apiFetch("/api/offres", { token }) as Promise<OffreRow[] | null>,
        ]);
        if (c) return;
        setCounts(co);
        setOffres(Array.isArray(of) ? of.slice(0, 6) : []);
      } catch (e) {
        if (!c) setErr(e instanceof Error ? e.message : "Erreur API");
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  const barData = useMemo(() => {
    const base = months.map(() => 0);
    offres.forEach((o) => {
      if (!o.dateOffre) return;
      const m = new Date(o.dateOffre).getMonth();
      if (m >= 0 && m < 12) base[m] += Number(o.montantHt) / 1000;
    });
    const has = base.some((v) => v > 0);
    const data = has ? base : base;
    return {
      labels: months,
      datasets: [
        { label: "Offres (k€)", data, backgroundColor: `${NAV}99`, borderColor: NAV, borderWidth: 1 },
        {
          label: "Estimation cmd (k€)",
          data: data.map((v) => Math.max(0, Math.round(v * 0.58 * 10) / 10)),
          backgroundColor: `${ORA}99`,
          borderColor: ORA,
          borderWidth: 1,
        },
      ],
    };
  }, [offres]);

  const pieData = useMemo(() => {
    const by: Record<string, number> = {};
    offres.forEach((o) => {
      const k = o.typeMission || "?";
      by[k] = (by[k] || 0) + 1;
    });
    const labels = Object.keys(by);
    const data = Object.values(by);
    if (labels.length === 0) {
      return {
        labels: ["Aucune donnée"],
        datasets: [{ data: [1], backgroundColor: [STL], borderWidth: 2, borderColor: "#fff" }],
      };
    }
    const colors = [NAV, ORA, STL, GRN, "#e6a800", "#17a2b8", "#6f42c1"];
    return {
      labels,
      datasets: [{ data, backgroundColor: labels.map((_, i) => colors[i % colors.length]), borderWidth: 2, borderColor: "#fff" }],
    };
  }, [offres]);

  const nf = useMemo(() => new Intl.NumberFormat("fr-FR"), []);
  const money = useMemo(() => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }), []);

  return (
    <>
      <header className="pg-hdr mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>Dashboard KPI</h1>
          <p>Vue exécutive — agrégats et graphiques (profil administrateur, API Express).</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/crm/rapports" className="cbtn cbtn-ghost cbtn-sm">
            Rapports détaillés
          </Link>
          <Link href="/crm/pipeline" className="cbtn cbtn-ghost cbtn-sm">
            Pipeline
          </Link>
          {mutate ? (
            <>
              <CrmCreateButton slug="offre" />
              <CrmCreateButton slug="commande" />
              <CrmCreateButton slug="contact" />
            </>
          ) : null}
        </div>
      </header>

      {err ? (
        <p className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{err}</p>
      ) : null}

      <div className="kpi-grid">
        <div className="kpi kp-orange">
          <div className="kpi-label">Offres actives</div>
          <div className="kpi-val ov">{counts ? nf.format(counts.offresActives) : "—"}</div>
        </div>
        <div className="kpi kp-navy">
          <div className="kpi-label">Commandes actives</div>
          <div className="kpi-val">{counts ? nf.format(counts.commandesActives) : "—"}</div>
        </div>
        <div className="kpi kp-green">
          <div className="kpi-label">Contacts</div>
          <div className="kpi-val gv">{counts ? nf.format(counts.contacts) : "—"}</div>
        </div>
        <div className="kpi kp-steel">
          <div className="kpi-label">Clients</div>
          <div className="kpi-val">{counts ? nf.format(counts.clients) : "—"}</div>
        </div>
        <div className="kpi kp-navy">
          <div className="kpi-label">Sites</div>
          <div className="kpi-val">{counts ? nf.format(counts.sites) : "—"}</div>
        </div>
        <div className="kpi kp-orange">
          <div className="kpi-label">Factures</div>
          <div className="kpi-val ov">{counts ? nf.format(counts.factures) : "—"}</div>
        </div>
      </div>

      <div className="charts-row">
        <div className="ccard">
          <div className="ccard-title">Montants HT mensuels (k€) — offres</div>
          <div className="chart-wrap">
            <Bar
              data={barData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { boxWidth: 12, font: { size: 10 } } } },
                scales: {
                  y: { beginAtZero: true, ticks: { font: { size: 9 }, callback: (v) => `${v}` } },
                  x: { ticks: { font: { size: 9 } } },
                },
              }}
            />
          </div>
        </div>
        <div className="ccard">
          <div className="ccard-title">Répartition par type de mission</div>
          <div className="chart-wrap flex items-center justify-center">
            <Doughnut
              data={pieData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: "bottom", labels: { boxWidth: 10, padding: 8, font: { size: 9 } } } },
              }}
            />
          </div>
        </div>
      </div>

      <div className="charts-row">
        <div className="ccard">
          <div className="ccard-title">Activité récente (extrait données)</div>
          {offres.length === 0 ? (
            <p className="text-xs text-neutral-600">Pas encore d&apos;offres chargées depuis l&apos;API.</p>
          ) : (
            offres.slice(0, 4).map((o, i) => (
              <div key={o.id ?? i} className="act-item">
                <div className="act-dot" style={{ background: i % 2 ? ORA : GRN }} />
                <div>
                  <div className="act-text">
                    Offre <strong>{o.numeroOffre}</strong> — {o.clientNom}
                  </div>
                  <div className="act-time">
                    {String(o.dateOffre ?? "—")} · {money.format(Number(o.montantHt))} · {o.statut}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="ccard">
          <div className="ccard-title">Offres récentes</div>
          <div className="tw">
            <table className="ct" style={{ fontSize: 11 }}>
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Client</th>
                  <th>Montant</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {(offres.length ? offres : []).map((o) => (
                  <tr key={o.id}>
                    <td className="td-mono">{o.numeroOffre}</td>
                    <td>{o.clientNom}</td>
                    <td style={{ fontWeight: 700 }}>{money.format(Number(o.montantHt))}</td>
                    <td>
                      <span className={`badge ${badge(o.statut)}`}>{o.statut}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 10, textAlign: "right" }}>
            <Link href="/crm/offres" className="cbtn cbtn-ghost cbtn-sm">
              Voir tout →
            </Link>
          </div>
        </div>
      </div>

      {mutate ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Link href="/crm/nouveau/contact" className="ccard text-center hover:border-orange-300" style={{ cursor: "pointer" }}>
            <div style={{ fontSize: 22 }}>👤</div>
            <div style={{ fontWeight: 700, color: "var(--navy)", fontSize: 12 }}>Nouveau contact</div>
          </Link>
          <Link href="/crm/nouveau/offre" className="ccard text-center hover:border-orange-300" style={{ cursor: "pointer" }}>
            <div style={{ fontSize: 22 }}>📋</div>
            <div style={{ fontWeight: 700, color: "var(--navy)", fontSize: 12 }}>Nouvelle offre</div>
          </Link>
          <Link href="/crm/nouveau/facture" className="ccard text-center hover:border-orange-300" style={{ cursor: "pointer" }}>
            <div style={{ fontSize: 22 }}>💶</div>
            <div style={{ fontWeight: 700, color: "var(--navy)", fontSize: 12 }}>Facturation</div>
          </Link>
          <Link href="/crm/historique/commandes" className="ccard text-center hover:border-orange-300" style={{ cursor: "pointer" }}>
            <div style={{ fontSize: 22 }}>🗃️</div>
            <div style={{ fontWeight: 700, color: "var(--navy)", fontSize: 12 }}>Historique</div>
          </Link>
        </div>
      ) : null}
    </>
  );
}
