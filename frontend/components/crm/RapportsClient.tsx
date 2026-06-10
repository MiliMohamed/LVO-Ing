"use client";

import { Bar, Doughnut, Line } from "react-chartjs-2";
import { useEffect, useMemo, useState } from "react";

import { CrmCreateButton } from "@/components/crm/CrmCreateButton";
import { apiFetch, apiFetchText } from "@/lib/api";
import { canViewExecutiveKpi, normalizeRole } from "@/lib/rbac";
import { readRole } from "@/lib/token-storage";
import type { HistoryAnnulationRow } from "@/lib/types";
import { readToken } from "@/lib/token-storage";

import { registerCharts } from "./chart-register";

registerCharts();

function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const ORA = "#FF6B00";
const NAV = "#1A2B4C";
const STL = "#8E9DAE";
const GRN = "#19a249";

const tabs = [
  { id: 0, label: "📊 Vue générale" },
  { id: 1, label: "👥 Consultants" },
  { id: 2, label: "📈 Offres & Pipeline" },
  { id: 3, label: "💶 Facturation" },
  { id: 4, label: "🗂 Annulations" },
  { id: 5, label: "📅 Planning" },
];

export function RapportsClient() {
  const executiveKpi = canViewExecutiveKpi(normalizeRole(readRole()));
  const [tab, setTab] = useState(0);
  const [kpis, setKpis] = useState<Record<string, number> | null>(null);
  const [cancellations, setCancellations] = useState<HistoryAnnulationRow[] | null>(null);
  const [topGestionnaires, setTopGestionnaires] = useState<{ gestionnaire: string; caHt: number }[] | null>(null);

  useEffect(() => {
    if (!executiveKpi) return;
    const token = readToken();
    void (async () => {
      try {
        const data = (await apiFetch("/api/rapports/kpis", { token })) as Record<string, number> | null;
        if (data) setKpis(data);
      } catch {
        /* keep fallback */
      }
    })();
  }, [executiveKpi]);

  useEffect(() => {
    const token = readToken();
    void (async () => {
      try {
        const d = (await apiFetch("/api/rapports/top-gestionnaires", { token })) as {
          items?: { gestionnaire: string; caHt: number }[];
        } | null;
        setTopGestionnaires(Array.isArray(d?.items) ? d.items : []);
      } catch {
        setTopGestionnaires(null);
      }
    })();
  }, []);

  useEffect(() => {
    if (tab !== 4) return;
    const token = readToken();
    let cancelled = false;
    void (async () => {
      try {
        const data = (await apiFetch("/api/historique/annulations", { token })) as HistoryAnnulationRow[] | null;
        if (!cancelled) setCancellations(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setCancellations([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  async function pullCsv(path: string, filename: string) {
    try {
      const text = await apiFetchText(path, { token: readToken() });
      downloadTextFile(filename, text, "text/csv;charset=utf-8");
    } catch {
      globalThis.alert("Export indisponible (vérifiez la session ou le réseau).");
    }
  }

  const caAgence = useMemo(
    () => ({
      labels: ["La Réunion", "Paris", "PACA", "Autres"],
      datasets: [
        {
          label: "CA HT (k€)",
          data: [892, 487, 334, 120],
          backgroundColor: [ORA, NAV, STL, GRN],
        },
      ],
    }),
    [],
  );

  const linePipe = useMemo(
    () => ({
      labels: ["Jan", "Fév", "Mar", "Avr", "Mai"],
      datasets: [
        {
          label: "Offres",
          data: [47, 62, 38, 71, 54],
          borderColor: NAV,
          backgroundColor: `${NAV}22`,
          fill: true,
          tension: 0.35,
        },
        {
          label: "Commandes",
          data: [28, 41, 22, 55, 38],
          borderColor: ORA,
          backgroundColor: `${ORA}22`,
          fill: true,
          tension: 0.35,
        },
      ],
    }),
    [],
  );

  const pieMission = useMemo(
    () => ({
      labels: ["MS", "MCM", "MCN", "MM", "A", "ET"],
      datasets: [
        {
          data: [35, 25, 20, 12, 6, 2],
          backgroundColor: [NAV, ORA, STL, GRN, "#e6a800", "#17a2b8"],
          borderWidth: 2,
          borderColor: "#fff",
        },
      ],
    }),
    [],
  );

  const chartTopGestionnaires = useMemo(() => {
    const items = topGestionnaires ?? [];
    return {
      labels: items.map((i) => i.gestionnaire),
      datasets: [
        {
          label: "CA HT offres (€)",
          data: items.map((i) => i.caHt),
          backgroundColor: items.map((_, j) => [NAV, ORA, STL, GRN][j % 4]),
        },
      ],
    };
  }, [topGestionnaires]);

  return (
    <>
      <header className="pg-hdr mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>Rapports &amp; analyses</h1>
          <p>Visualisations inspirées de la maquette — données de démo complétées par l&apos;API quand disponible.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CrmCreateButton slug="offre" />
          <button type="button" className="cbtn cbtn-ghost cbtn-sm" onClick={() => window.scrollTo({ top: 0 })}>
            Actualiser vue
          </button>
          {executiveKpi ? (
            <button type="button" className="cbtn cbtn-ghost cbtn-sm" onClick={() => void pullCsv("/api/rapports/export/kpis.csv", "lvo-kpis.csv")}>
              Export KPI (CSV)
            </button>
          ) : null}
          <button
            type="button"
            className="cbtn cbtn-ghost cbtn-sm"
            onClick={() => void pullCsv("/api/rapports/export/annulations.csv", "lvo-annulations.csv")}
          >
            Export annulations (CSV)
          </button>
          <button
            type="button"
            className="cbtn cbtn-ghost cbtn-sm"
            onClick={() =>
              downloadTextFile(
                "lvo-rapport-demo.xlsx.csv",
                "sep=,\nmetric,value\nexcel_hint,Ouvrir via Excel en important CSV\n",
                "application/vnd.ms-excel",
              )
            }
          >
            Excel (CSV compatible)
          </button>
          <button
            type="button"
            className="cbtn cbtn-ghost cbtn-sm"
            onClick={() =>
              globalThis.alert(
                "Export PDF multi-onglets : brancher une chaîne serveur (OpenPDF / Jasper / Gotenberg) à partir des mêmes agrégats.",
              )
            }
          >
            PDF (serveur)
          </button>
        </div>
      </header>

      <div className="mb-4 flex gap-1 overflow-x-auto border-b-2 border-[var(--g200)]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`rpt-tab ${tab === t.id ? "act" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={tab === 0 ? "rpt-pane act" : "rpt-pane"}>
        {!executiveKpi ? (
          <p className="mb-4 rounded-lg border border-[var(--g200)] bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
            Les indicateurs exécutifs (CA agrégé, KPI globaux) sont réservés à l&apos;administrateur. Utilisez les
            onglets Annulations, Planning ou les exports opérationnels ci-dessous.
          </p>
        ) : null}
        {executiveKpi ? (
        <>
        <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))" }}>
          <div className="kpi kp-orange">
            <div className="kpi-label">CA indicatif 2026</div>
            <div className="kpi-val ov" style={{ fontSize: 20 }}>
              {kpis ? `${kpis.totalFactures} fact.` : "2 157 k€"}
            </div>
          </div>
          <div className="kpi kp-navy">
            <div className="kpi-label">Offres (temps réel API)</div>
            <div className="kpi-val">{kpis ? kpis.totalOffres : 1761}</div>
          </div>
          <div className="kpi kp-green">
            <div className="kpi-label">Taux transfo.</div>
            <div className="kpi-val gv">{kpis ? `${Math.round((kpis.totalCommandes / Math.max(kpis.totalOffres, 1)) * 100)}%` : "58%"}</div>
          </div>
        </div>
        <div className="charts-row">
          <div className="ccard">
            <div className="ccard-title">CA par agence (k€) — démo</div>
            <div className="chart-wrap">
              <Bar
                data={caAgence}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: { y: { beginAtZero: true, ticks: { callback: (v) => `${v}k` } } },
                }}
              />
            </div>
          </div>
          <div className="ccard">
            <div className="ccard-title">Types de mission</div>
            <div className="chart-wrap flex items-center justify-center">
              <Doughnut
                data={pieMission}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: "bottom", labels: { font: { size: 9 }, boxWidth: 10 } } },
                }}
              />
            </div>
          </div>
        </div>
        {topGestionnaires && topGestionnaires.length > 0 ? (
          <div className="ccard mt-3">
            <div className="ccard-title">Top gestionnaires par CA offres HT (Phase 6 — données API)</div>
            <div className="chart-wrap" style={{ height: Math.min(420, 80 + topGestionnaires.length * 36) }}>
              <Bar
                data={chartTopGestionnaires}
                options={{
                  indexAxis: "y",
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { beginAtZero: true, ticks: { callback: (v) => `${Number(v) / 1000}k` } },
                  },
                }}
              />
            </div>
          </div>
        ) : null}
        </>
        ) : null}
      </div>

      <div className={tab === 1 ? "rpt-pane act" : "rpt-pane"}>
        <p className="fnote mb-3">Performance consultants (base kpis + pondérations indicatives par agence).</p>
        <div className="charts-row">
          <div className="ccard"><div className="ccard-title">Répartition portefeuille</div><div className="chart-wrap"><Doughnut data={pieMission} /></div></div>
          <div className="ccard"><div className="ccard-title">CA par agence</div><div className="chart-wrap"><Bar data={caAgence} /></div></div>
        </div>
      </div>

      <div className={tab === 2 ? "rpt-pane act" : "rpt-pane"}>
        <div className="ccard mb-4">
          <div className="ccard-title">Offres émises vs commandes (tendance démo)</div>
          <div className="chart-wrap" style={{ height: 280 }}>
            <Line
              data={linePipe}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { font: { size: 10 }, boxWidth: 12 } } },
                scales: { y: { beginAtZero: true } },
              }}
            />
          </div>
        </div>
        <p className="fnote">
          Pipeline commercial + taux de transformation.
        </p>
      </div>

      <div className={tab === 3 ? "rpt-pane act" : "rpt-pane"}>
        <p className="fnote mb-3">
          Facturation — statuts de paiement & reste à facturer : enrichir avec séries temporelles backend (Phase 2 suite).
        </p>
        <div className="charts-row">
          <div className="ccard">
            <div className="ccard-title">Indicateurs temps réel</div>
            <ul className="fnote list-inside list-disc space-y-1 px-3 py-2">
              <li>Factures en base : {kpis ? kpis.totalFactures : "…"}</li>
              <li>Commandes actives : {kpis ? kpis.totalCommandes : "…"}</li>
              <li>Annulations cumulées : {kpis ? kpis.totalAnnulations : "…"}</li>
            </ul>
          </div>
        </div>
      </div>

      <div className={tab === 4 ? "rpt-pane act" : "rpt-pane"}>
        <p className="fnote mb-3">
          Annulations synchronisées avec <code className="rounded bg-neutral-100 px-1">GET /api/historique/annulations</code>{" "}
          — même source que l&apos;export CSV.
        </p>
        <div className="tw mb-4 overflow-x-auto">
          <table className="ct">
            <thead>
              <tr>
                <th>Réf.</th>
                <th>Type</th>
                <th>Client</th>
                <th>Montant HT</th>
                <th>Motif</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {(cancellations ?? []).slice(0, 80).map((r) => (
                <tr key={r.id}>
                  <td>{r.reference}</td>
                  <td>{r.entityType}</td>
                  <td>{r.clientNom}</td>
                  <td>{r.montantHt}</td>
                  <td className="max-w-[200px] truncate" title={r.motif}>
                    {r.motif}
                  </td>
                  <td>{new Date(r.cancelledAt).toLocaleString("fr-FR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {cancellations === null ? <p className="fnote">Chargement de l&apos;onglet annulations…</p> : null}
      </div>

      <div className={tab === 5 ? "rpt-pane act" : "rpt-pane"}>
        <p className="fnote mb-3">
          Jalons planning : données disponibles via <code className="rounded bg-neutral-100 px-1">GET /api/planning/jalons</code>{" "}
          — écran dédié sous <strong>Outils → Planning</strong>.
        </p>
        <p className="fnote">
          Alertes mail / Teams à brancher sur les niveaux <code>info</code>, <code>warn</code>, <code>critical</code>.
        </p>
      </div>
    </>
  );
}
