"use client";

import { useEffect, useState } from "react";
import { clientApiFetch } from "@/lib/client-api";
import type { CommandeRow } from "@/lib/types";

export default function ClientCommandesPage() {
  const [commandes, setCommandes] = useState<CommandeRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void clientApiFetch<CommandeRow[]>("/api/client/commandes")
      .then(setCommandes)
      .catch(() => setError("Impossible de charger les commandes."));
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--navy)", marginBottom: 24 }}>Mes commandes</h1>

      {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", color: "#dc2626", marginBottom: 24 }}>{error}</div>}
      {commandes === null && !error && <div style={{ color: "var(--smoke)", padding: "40px 0", textAlign: "center" }}>Chargement…</div>}

      {commandes && commandes.length === 0 && (
        <div style={{ color: "var(--smoke)", padding: "60px 0", textAlign: "center" }}>Aucune commande pour le moment.</div>
      )}

      {commandes && commandes.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "var(--g50)" }}>
              <tr>
                {["N° Commande", "Mission", "Site", "Montant HT", "Facturé HT", "Date", "Statut"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: 11, color: "var(--smoke)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {commandes.map((c) => (
                <tr key={c.id} style={{ borderTop: "1px solid var(--g100)" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600, fontSize: 13 }}>{c.numeroCommande}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--smoke)" }}>{c.typeMission}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13 }}>{c.siteNom}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600 }}>{c.montantHt.toLocaleString("fr-FR")} € HT</td>
                  <td style={{ padding: "12px 16px", fontSize: 13 }}>{c.montantFacture.toLocaleString("fr-FR")} € HT</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--smoke)" }}>{c.dateCommande ?? "—"}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ background: "var(--g100)", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>{c.statut ?? "—"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
