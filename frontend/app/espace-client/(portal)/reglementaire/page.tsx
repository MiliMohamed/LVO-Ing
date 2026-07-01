"use client";

import { useEffect, useState } from "react";
import { clientApiFetch } from "@/lib/client-api";

type Obligation = {
  equipementId: number;
  siteNom: string;
  equipementLibelle: string;
  type: string;
  libelle: string;
  dateEcheance: string;
  organisme: string;
  statut: "OK" | "PROCHE" | "EN_RETARD";
};

type ReglementaireData = {
  obligations: Obligation[];
  tauxConformite: number;
  total: number;
  enRetard: number;
  proche: number;
  conformes: number;
};

const STATUT_CONFIG = {
  OK:        { label: "Conforme",   color: "#16a34a", bg: "#f0fdf4", icon: "✅" },
  PROCHE:    { label: "À venir",    color: "#d97706", bg: "#fffbeb", icon: "⚠️" },
  EN_RETARD: { label: "En retard",  color: "#dc2626", bg: "#fef2f2", icon: "❌" },
};

const TYPE_LABELS: Record<string, string> = {
  CONTROLE_QUINQUENNAL: "Contrôle quinquennal",
  VISITE_SECURITE:      "Visite sécurité annuelle",
};

function ConformiteGauge({ pct }: { pct: number }) {
  const color = pct >= 90 ? "#16a34a" : pct >= 70 ? "#d97706" : "#dc2626";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ flex: 1, height: 10, background: "var(--g200)", borderRadius: 5, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 5, transition: "width 0.5s" }} />
      </div>
      <span style={{ fontSize: 18, fontWeight: 800, color, minWidth: 55 }}>{pct}%</span>
    </div>
  );
}

export default function ReglementairePage() {
  const [data, setData] = useState<ReglementaireData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "OK" | "PROCHE" | "EN_RETARD">("all");

  useEffect(() => {
    void clientApiFetch<ReglementaireData>("/api/client/reglementaire")
      .then(setData)
      .catch(() => setError("Impossible de charger les obligations réglementaires."));
  }, []);

  const displayed = data?.obligations.filter((o) => filter === "all" || o.statut === filter) ?? [];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--navy)", marginBottom: 4 }}>Portail Réglementaire</h1>
        <p style={{ fontSize: 13, color: "var(--smoke)" }}>Calendrier des obligations réglementaires de vos équipements</p>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", color: "#dc2626", marginBottom: 24 }}>
          {error}
        </div>
      )}

      {data === null && !error && (
        <div style={{ color: "var(--smoke)", padding: "40px 0", textAlign: "center" }}>Chargement…</div>
      )}

      {data && (
        <>
          {/* Conformité globale */}
          <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, padding: "20px 24px", marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--smoke)", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 10 }}>
              Taux de conformité global
            </div>
            <ConformiteGauge pct={data.tauxConformite} />
          </div>

          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 24 }}>
            {[
              { label: "Total obligations", value: data.total,    color: "var(--navy)", icon: "📋" },
              { label: "Conformes",         value: data.conformes, color: "#16a34a",    icon: "✅" },
              { label: "Échéance proche",   value: data.proche,    color: "#d97706",    icon: "⚠️" },
              { label: "En retard",         value: data.enRetard,  color: "#dc2626",    icon: "❌" },
            ].map((k) => (
              <div key={k.label} style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: 16, marginBottom: 4 }}>{k.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: 11, color: "var(--smoke)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Filtres */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {([["all", "Toutes", "#6b7280"], ["EN_RETARD", "En retard", "#dc2626"], ["PROCHE", "À venir", "#d97706"], ["OK", "Conformes", "#16a34a"]] as const).map(([key, label, color]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  border: `1.5px solid ${filter === key ? color : "var(--g200)"}`,
                  background: filter === key ? `${color}15` : "#fff",
                  color: filter === key ? color : "var(--smoke)",
                  borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}
              >
                {label}
                {key !== "all" && (
                  <span style={{ marginLeft: 6, fontWeight: 400 }}>
                    ({key === "EN_RETARD" ? data.enRetard : key === "PROCHE" ? data.proche : data.conformes})
                  </span>
                )}
              </button>
            ))}
          </div>

          {displayed.length === 0 && (
            <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, padding: "40px 0", textAlign: "center", color: "var(--smoke)" }}>
              Aucune obligation dans cette catégorie.
            </div>
          )}

          {displayed.length > 0 && (
            <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ background: "var(--g50)" }}>
                  <tr>
                    {["Statut", "Site", "Équipement", "Obligation", "Échéance", "Organisme"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "11px 14px", fontSize: 11, color: "var(--smoke)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((o, i) => {
                    const cfg = STATUT_CONFIG[o.statut];
                    return (
                      <tr key={i} style={{ borderTop: "1px solid var(--g100)" }}>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, borderRadius: 6, padding: "3px 8px" }}>
                            {cfg.icon} {cfg.label}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: 13, color: "var(--navy)", fontWeight: 600 }}>{o.siteNom}</td>
                        <td style={{ padding: "12px 14px", fontSize: 12, color: "var(--smoke)", maxWidth: 220 }}>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.equipementLibelle}</div>
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: 13 }}>{TYPE_LABELS[o.type] ?? o.type}</td>
                        <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: o.statut === "EN_RETARD" ? 700 : 400, color: o.statut === "EN_RETARD" ? "#dc2626" : "inherit" }}>
                          {new Date(o.dateEcheance).toLocaleDateString("fr-FR")}
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: 12, color: "var(--smoke)" }}>{o.organisme}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
