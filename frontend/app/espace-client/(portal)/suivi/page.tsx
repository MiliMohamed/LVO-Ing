"use client";

import { useEffect, useState } from "react";
import { clientApiFetch } from "@/lib/client-api";
import type { CommandeRow, OffreRow } from "@/lib/types";

type PhaseItem = { code: string; libelle: string; montantHt?: number; inclus?: boolean };

const STATUT_COMMANDE_STEPS = ["EN_ATTENTE", "SIGNATURE", "EN_COURS", "LIVRE", "FACTURE_PARTIELLE", "FACTUREE", "CLOTUREE"];
const STATUT_LABELS: Record<string, string> = {
  EN_ATTENTE: "En attente",
  SIGNATURE: "Signature",
  EN_COURS: "En cours",
  LIVRE: "Livré",
  FACTURE_PARTIELLE: "Fact. partielle",
  FACTUREE: "Facturée",
  CLOTUREE: "Clôturée",
  ANNULEE: "Annulée",
};
const MISSION_LABELS: Record<string, string> = { MS: "Mission de service", MOE: "Maîtrise d'œuvre", MCN: "Modernisation", MCM: "Maintenance" };

function StatutBadge({ statut }: { statut: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    EN_ATTENTE: { bg: "#f3f4f6", color: "#6b7280" },
    SIGNATURE: { bg: "#eff6ff", color: "#2563eb" },
    EN_COURS: { bg: "#fff7ed", color: "#d97706" },
    LIVRE: { bg: "#f0fdf4", color: "#16a34a" },
    FACTUREE: { bg: "#f0fdf4", color: "#16a34a" },
    FACTURE_PARTIELLE: { bg: "#eff6ff", color: "#2563eb" },
    CLOTUREE: { bg: "#f0fdf4", color: "#16a34a" },
    ANNULEE: { bg: "#fef2f2", color: "#dc2626" },
  };
  const c = colors[statut] ?? { bg: "var(--g100)", color: "var(--smoke)" };
  return <span style={{ background: c.bg, color: c.color, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{STATUT_LABELS[statut] ?? statut}</span>;
}

function ProgressBar({ statut }: { statut: string }) {
  const idx = STATUT_COMMANDE_STEPS.indexOf(statut);
  const pct = idx < 0 ? 0 : Math.round(((idx + 1) / STATUT_COMMANDE_STEPS.length) * 100);
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: "var(--smoke)" }}>Avancement</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)" }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: "var(--g100)", borderRadius: 99 }}>
        <div style={{ height: 6, background: pct === 100 ? "#16a34a" : "var(--orange)", borderRadius: 99, width: `${pct}%`, transition: "width 0.5s" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
        {STATUT_COMMANDE_STEPS.map((s, i) => (
          <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: i <= idx ? "var(--orange)" : "var(--g200)", border: i === idx ? "2px solid var(--navy)" : "none", marginBottom: 2 }} />
            <span style={{ fontSize: 9, color: i <= idx ? "var(--navy)" : "#aaa", textAlign: "center", lineHeight: 1.2 }}>{STATUT_LABELS[s]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SuiviPage() {
  const [commandes, setCommandes] = useState<CommandeRow[]>([]);
  const [offres, setOffres] = useState<OffreRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const [c, o] = await Promise.all([
          clientApiFetch<CommandeRow[]>("/api/client/commandes"),
          clientApiFetch<OffreRow[]>("/api/client/offres"),
        ]);
        setCommandes(c);
        setOffres(o);
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    })();
  }, []);

  const active = commandes.filter((c) => c.statut && !["CLOTUREE", "ANNULEE"].includes(c.statut));
  const closed = commandes.filter((c) => c.statut === "CLOTUREE" || c.statut === "ANNULEE");
  const pendingOffres = offres.filter((o) => o.statut === "ENVOYEE");

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--navy)", marginBottom: 8 }}>Suivi d'avancement</h1>
      <p style={{ fontSize: 13, color: "var(--smoke)", marginBottom: 28 }}>État de vos missions en cours et offres en attente de décision.</p>

      {loading && <div style={{ color: "var(--smoke)", textAlign: "center", padding: "60px 0" }}>Chargement…</div>}

      {!loading && pendingOffres.length > 0 && (
        <div style={{ background: "#fffbf5", border: "1px solid #fed7aa", borderRadius: 14, padding: 20, marginBottom: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#d97706", marginBottom: 12 }}>⏳ Offres en attente de votre décision ({pendingOffres.length})</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {pendingOffres.map((o) => (
              <div key={o.id} style={{ background: "#fff", border: "1px solid #fed7aa", borderRadius: 10, padding: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--navy)", marginBottom: 4 }}>{o.numeroOffre}</div>
                <div style={{ fontSize: 12, color: "var(--smoke)", marginBottom: 8 }}>{MISSION_LABELS[o.typeMission] ?? o.typeMission} · {o.siteNom}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--orange)" }}>{o.montantHt.toLocaleString("fr-FR")} € HT</div>
                <a href="/espace-client/offres" style={{ display: "inline-block", marginTop: 10, fontSize: 12, color: "var(--orange)", fontWeight: 600 }}>Consulter l'offre →</a>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && active.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--navy)", marginBottom: 16 }}>Missions actives ({active.length})</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {active.map((c) => {
              let phases: PhaseItem[] = [];
              try { phases = JSON.parse((c as CommandeRow & { phasesLinesJson?: string }).phasesLinesJson ?? "[]") as PhaseItem[]; } catch { /* ignore */ }
              return (
                <div key={c.id} style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, padding: 24 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16, color: "var(--navy)" }}>{c.numeroCommande}</div>
                      <div style={{ fontSize: 13, color: "var(--smoke)", marginTop: 2 }}>
                        {MISSION_LABELS[c.typeMission] ?? c.typeMission} · {c.siteNom}
                        {c.numeroClient && <> · <span style={{ fontStyle: "italic" }}>Réf. client : {c.numeroClient}</span></>}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      <StatutBadge statut={c.statut ?? "EN_ATTENTE"} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)" }}>{c.montantHt.toLocaleString("fr-FR")} € HT</span>
                    </div>
                  </div>
                  <ProgressBar statut={c.statut ?? "EN_ATTENTE"} />
                  {phases.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--smoke)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Phases de la mission</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {phases.map((p) => (
                          <div key={p.code} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--navy)" }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--orange)", flexShrink: 0 }} />
                            <span style={{ flex: 1 }}>{p.libelle}</span>
                            {p.montantHt != null && <span style={{ fontWeight: 600, color: "var(--smoke)" }}>{p.montantHt.toLocaleString("fr-FR")} €</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {c.montantFacture > 0 && (
                    <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--g50)", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "var(--smoke)" }}>Montant déjà facturé</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)" }}>{c.montantFacture.toLocaleString("fr-FR")} € HT</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {!loading && closed.length > 0 && (
        <section>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--smoke)", marginBottom: 12 }}>Missions terminées ({closed.length})</h2>
          <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "var(--g50)" }}>
                <tr>
                  {["Commande", "Mission", "Site", "Montant HT", "Statut"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 16px", fontSize: 11, color: "var(--smoke)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {closed.map((c) => (
                  <tr key={c.id} style={{ borderTop: "1px solid var(--g100)" }}>
                    <td style={{ padding: "10px 16px", fontWeight: 600, fontSize: 13 }}>{c.numeroCommande}</td>
                    <td style={{ padding: "10px 16px", fontSize: 13, color: "var(--smoke)" }}>{MISSION_LABELS[c.typeMission] ?? c.typeMission}</td>
                    <td style={{ padding: "10px 16px", fontSize: 13 }}>{c.siteNom}</td>
                    <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600 }}>{c.montantHt.toLocaleString("fr-FR")} €</td>
                    <td style={{ padding: "10px 16px" }}><StatutBadge statut={c.statut ?? ""} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!loading && commandes.length === 0 && (
        <div style={{ textAlign: "center", color: "var(--smoke)", padding: "60px 0", fontSize: 14 }}>Aucune mission en cours. Contactez votre consultant LVO.</div>
      )}
    </div>
  );
}
