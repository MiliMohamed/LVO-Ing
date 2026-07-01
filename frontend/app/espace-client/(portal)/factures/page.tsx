"use client";

import { useEffect, useState } from "react";
import { clientApiFetch } from "@/lib/client-api";
import { useSelectedSite } from "@/lib/site-context";
import type { CommandeRow, FactureRow } from "@/lib/types";

const STATUT_COLORS: Record<string, { color: string; label: string }> = {
  PAYE:               { color: "#16a34a", label: "Payée" },
  EN_RETARD:          { color: "#dc2626", label: "En retard" },
  NON_PAYE:           { color: "#d97706", label: "Non payée" },
  PARTIELLEMENT_PAYE: { color: "#2563eb", label: "Part. payée" },
};

export default function ClientFacturesPage() {
  const { selectedSite, selectedSiteId, loading: siteLoading } = useSelectedSite();
  const [allFactures, setAllFactures] = useState<FactureRow[] | null>(null);
  const [commandes, setCommandes] = useState<CommandeRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      clientApiFetch<FactureRow[]>("/api/client/factures"),
      clientApiFetch<CommandeRow[]>("/api/client/commandes"),
    ])
      .then(([f, c]) => { setAllFactures(f); setCommandes(c); })
      .catch(() => setError("Impossible de charger les factures."));
  }, []);

  // Filter factures by selected site via commandes
  const factures = allFactures === null ? null
    : selectedSite
      ? (() => {
          const siteCommandeIds = new Set(
            commandes.filter((c) => c.siteNom === selectedSite.nom).map((c) => c.id),
          );
          return allFactures.filter((f) => f.commandeId != null && siteCommandeIds.has(f.commandeId));
        })()
      : allFactures;

  const totalDu = factures
    ?.filter((f) => f.statutPaiement !== "PAYE")
    .reduce((s, f) => s + f.montantHt - (f.montantPaye ?? 0), 0) ?? null;

  const siteName = selectedSite?.nom ?? null;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--navy)", marginBottom: 4 }}>Mes factures</h1>
        {siteName && (
          <p style={{ fontSize: 13, color: "var(--smoke)" }}>
            Site : <strong style={{ color: "var(--navy)" }}>{siteName}</strong>
          </p>
        )}
      </div>

      {totalDu !== null && totalDu > 0 && (
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, padding: "14px 20px", marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <span style={{ fontSize: 14, color: "#92400e", fontWeight: 600 }}>
            Solde restant dû : {totalDu.toLocaleString("fr-FR")} € HT
          </span>
        </div>
      )}

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", color: "#dc2626", marginBottom: 24 }}>
          {error}
        </div>
      )}

      {(factures === null || siteLoading) && !error && (
        <div style={{ color: "var(--smoke)", padding: "40px 0", textAlign: "center" }}>Chargement…</div>
      )}

      {factures !== null && !siteLoading && factures.length === 0 && (
        <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, padding: "60px 0", textAlign: "center", color: "var(--smoke)" }}>
          {selectedSiteId == null
            ? "Aucune facture pour le moment."
            : `Aucune facture pour le site « ${siteName} ».`}
        </div>
      )}

      {factures && factures.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "var(--g50)" }}>
              <tr>
                {["Référence", "Commande", "Montant HT", "Échéance", "Statut paiement"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: 11, color: "var(--smoke)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {factures.map((f) => {
                const statut = f.statutPaiement ?? "";
                const s = STATUT_COLORS[statut] ?? { color: "var(--smoke)", label: statut };
                return (
                  <tr key={f.id} style={{ borderTop: "1px solid var(--g100)" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600, fontSize: 13 }}>{f.numeroFacture}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--smoke)" }}>{f.numeroCommande}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600 }}>{f.montantHt.toLocaleString("fr-FR")} € HT</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: f.statutPaiement === "EN_RETARD" ? "#dc2626" : "var(--smoke)" }}>
                      {f.dateEcheance ?? "—"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ color: s.color, fontWeight: 700, fontSize: 12 }}>{s.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
