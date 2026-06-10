"use client";

import { Bar, Doughnut } from "react-chartjs-2";

import type { MmsChartSpec } from "@/lib/mms-hypotheses";

import { registerCharts } from "./chart-register";

registerCharts();

const NAV = "#1A2B4C";
const ORA = "#FF6B00";
const GRN = "#19a249";
const RED = "#C0392B";
const STL = "#8E9DAE";
const BLU = "#3498DB";

const PALETTE = [NAV, ORA, GRN, RED, BLU, "#9B59B6"];

const COULEURS_TRANCHES: Record<string, string> = {
  "< 1h": GRN,
  "1 à 2h": "#2ECC71",
  "2 à 4h": "#F39C12",
  "> 4h": ORA,
  inconnu: STL,
};

const CHART_FONT = { family: "Montserrat, DM Sans, sans-serif", size: 10 };

function couleursDataset(spec: MmsChartSpec, datasetIndex: number, labelCount: number): string | string[] {
  if (spec.type === "doughnut" && spec.labels) {
    return spec.labels.map((l) => COULEURS_TRANCHES[l] ?? PALETTE[0]);
  }
  if (spec.titre.toLowerCase().includes("pénalité") && datasetIndex === 0) {
    return [NAV, ORA, RED, BLU].slice(0, labelCount);
  }
  return PALETTE[datasetIndex % PALETTE.length];
}

function chartData(spec: MmsChartSpec) {
  return {
    labels: spec.labels,
    datasets: spec.datasets.map((ds, i) => ({
      label: ds.label,
      data: ds.data,
      backgroundColor: couleursDataset(spec, i, spec.labels?.length ?? ds.data.length),
      borderColor: "#fff",
      borderWidth: spec.type === "doughnut" ? 2 : 0,
      borderRadius: spec.type === "bar" ? 4 : 0,
    })),
  };
}

function chartOptions(spec: MmsChartSpec) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: { boxWidth: 12, padding: 10, font: CHART_FONT, color: NAV },
      },
      title: { display: false },
    },
    scales:
      spec.type === "bar"
        ? {
            x: {
              stacked: spec.stacked ?? false,
              ticks: { font: CHART_FONT, color: STL, maxRotation: 45 },
              grid: { color: "rgba(26, 43, 76, 0.06)" },
            },
            y: {
              stacked: spec.stacked ?? false,
              beginAtZero: true,
              ticks: { font: CHART_FONT, color: STL },
              grid: { color: "rgba(26, 43, 76, 0.08)" },
            },
          }
        : undefined,
  };
}

function CarteGraphique({ spec }: { spec: MmsChartSpec }) {
  const data = chartData(spec);
  const options = chartOptions(spec);

  return (
    <div className="ccard">
      <div className="ccard-title">{spec.titre}</div>
      <div className="chart-wrap">
        {spec.type === "doughnut" ? (
          <Doughnut data={data} options={options} />
        ) : (
          <Bar data={data} options={options} />
        )}
      </div>
    </div>
  );
}

type Props = {
  graphiques: Record<string, MmsChartSpec>;
  tableaux?: {
    historique?: Record<string, unknown>[];
    synthese?: Record<string, unknown>[];
    maintenance?: Record<string, unknown>[];
  };
};

export function MaintenanceMmsCharts({ graphiques, tableaux }: Props) {
  const ids = Object.keys(graphiques);
  if (!ids.length) {
    return (
      <p className="fnote">
        Lancez une analyse pour afficher les graphiques et tableaux de synthèse.
      </p>
    );
  }

  return (
    <section className="mms-graphiques">
      <header className="pg-hdr mb-3">
        <h2>Analyse graphique</h2>
        <p>Visualisations des pénalités, pannes et délais — charte LVO Ingénierie.</p>
      </header>

      <div className="charts-grid">
        {ids.map((id) => (
          <CarteGraphique key={id} spec={graphiques[id]} />
        ))}
      </div>

      {tableaux?.synthese?.length ? (
        <div className="fcard">
          <div className="fcard-hdr">
            <h2>Synthèse par appareil (aperçu)</h2>
          </div>
          <div className="fcard-body p-0">
            <div className="tw">
              <table className="ct">
                <thead>
                  <tr>
                    {Object.keys(tableaux.synthese[0])
                      .slice(0, 8)
                      .map((k) => (
                        <th key={k}>{k}</th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {tableaux.synthese.map((row, i) => (
                    <tr key={i}>
                      {Object.keys(tableaux.synthese![0])
                        .slice(0, 8)
                        .map((k) => (
                          <td key={k}>{String(row[k] ?? "")}</td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
