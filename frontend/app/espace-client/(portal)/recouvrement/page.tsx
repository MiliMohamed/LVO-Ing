"use client";

import { useEffect, useState } from "react";
import { clientApiFetch } from "@/lib/client-api";

type FactureImpayee = {
  id: number;
  numeroFacture: string;
  montantHt: number;
  restantDu: number;
  dateEcheance: string | null;
  joursRetard: number;
  statutPaiement: string;
  niveauRelance: number;
  tranche: "0-30" | "31-60" | "61-90" | "+90";
};

type RecouvrementData = {
  impayees: FactureImpayee[];
  totalImpaye: number;
  totalPaye: number;
  totalFacture: number;
  dso: number;
  tranches: Record<string, number>;
};

const TRANCHE_CONFIG = [
  { key: "0-30",  label: "0 – 30 jours",  color: "#d97706", bg: "#fffbeb" },
  { key: "31-60", label: "31 – 60 jours", color: "#ea580c", bg: "#fff7ed" },
  { key: "61-90", label: "61 – 90 jours", color: "#dc2626", bg: "#fef2f2" },
  { key: "+90",   label: "+ 90 jours",    color: "#7f1d1d", bg: "#fef2f2" },
];

const STATUT_LABELS: Record<string, string> = {
  NON_PAYE:           "Non payée",
  EN_RETARD:          "En retard",
  PARTIELLEMENT_PAYE: "Part. payée",
};

export default function RecouvrementPage() {
  const [data, setData] = useState<RecouvrementData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void clientApiFetch<RecouvrementData>("/api/client/recouvrement")
      .then(setData)
      .catch(() => setError("Impossible de charger les données de recouvrement."));
  }, []);

  const tauxRecouvrement = data && data.totalFacture > 0
    ? Math.round((data.totalPaye / data.totalFacture) * 100)
    : null;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--navy)", marginBottom: 4 }}>Recouvrement & DSO</h1>
        <p style={{ fontSize: 13, color: "var(--smoke)" }}>Suivi de vos paiements et soldes en cours</p>
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
          {/* KPI bar */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 24 }}>
            {[
              { label: "Solde impayé HT", value: `${data.totalImpaye.toLocaleString("fr-FR")} €`, color: data.totalImpaye > 0 ? "#dc2626" : "#16a34a", icon: "💶" },
              { label: "DSO actuel", value: `${data.dso} jours`, color: data.dso > 60 ? "#dc2626" : data.dso > 30 ? "#d97706" : "#16a34a", icon: "📅" },
              { label: "Taux recouvrement", value: tauxRecouvrement !== null ? `${tauxRecouvrement}%` : "—", color: (tauxRecouvrement ?? 0) >= 90 ? "#16a34a" : "#d97706", icon: "📈" },
              { label: "Factures impayées", value: data.impayees.length, color: data.impayees.length > 0 ? "#dc2626" : "#16a34a", icon: "🧾" },
            ].map((k) => (
              <div key={k.label} style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ fontSize: 18, marginBottom: 6 }}>{k.icon}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: 11, color: "var(--smoke)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Tranches ancienneté */}
          {data.totalImpaye > 0 && (
            <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, padding: "20px 24px", marginBottom: 24 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)", marginBottom: 16 }}>Répartition par ancienneté</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                {TRANCHE_CONFIG.map((t) => {
                  const montant = data.tranches[t.key] ?? 0;
                  const pct = data.totalImpaye > 0 ? Math.round((montant / data.totalImpaye) * 100) : 0;
                  return (
                    <div key={t.key} style={{ background: t.bg, border: `1px solid ${t.color}30`, borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: t.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>{t.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: t.color }}>
                        {montant > 0 ? `${montant.toLocaleString("fr-FR")} €` : "—"}
                      </div>
                      {montant > 0 && (
                        <div style={{ fontSize: 11, color: t.color, marginTop: 4 }}>{pct}% du total</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Détail factures impayées */}
          {data.impayees.length > 0 && (
            <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--g100)" }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)" }}>Factures en attente de règlement</h2>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ background: "var(--g50)" }}>
                  <tr>
                    {["Référence", "Restant dû HT", "Échéance", "Retard", "Statut", "Relance"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 16px", fontSize: 11, color: "var(--smoke)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.impayees.map((f) => {
                    const isLate = f.joursRetard > 0;
                    return (
                      <tr key={f.id} style={{ borderTop: "1px solid var(--g100)", background: f.joursRetard > 90 ? "#fef2f210" : "transparent" }}>
                        <td style={{ padding: "12px 16px", fontWeight: 700, fontSize: 13 }}>{f.numeroFacture}</td>
                        <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: "#dc2626" }}>
                          {f.restantDu.toLocaleString("fr-FR")} €
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: isLate ? "#dc2626" : "var(--smoke)" }}>
                          {f.dateEcheance ?? "—"}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 13 }}>
                          {f.joursRetard > 0
                            ? <span style={{ color: "#dc2626", fontWeight: 700 }}>{f.joursRetard}j</span>
                            : <span style={{ color: "#16a34a" }}>À venir</span>}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 12 }}>
                          {STATUT_LABELS[f.statutPaiement] ?? f.statutPaiement}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 12, color: f.niveauRelance > 0 ? "#d97706" : "var(--smoke)" }}>
                          {f.niveauRelance > 0 ? `Relance ${f.niveauRelance}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {data.impayees.length === 0 && (
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 14, padding: "40px 0", textAlign: "center", color: "#166534" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Aucun impayé en cours</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Toutes vos factures sont à jour.</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
