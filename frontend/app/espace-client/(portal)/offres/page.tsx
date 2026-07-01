"use client";

import { useEffect, useState } from "react";
import { clientApiFetch, clientApiPost } from "@/lib/client-api";
import { useSelectedSite } from "@/lib/site-context";
import type { OffreRow } from "@/lib/types";

const STATUT_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  ENVOYEE:  { bg: "#eff6ff", color: "#2563eb", label: "En attente de réponse" },
  ACCEPTEE: { bg: "#f0fdf4", color: "#16a34a", label: "Acceptée" },
  REFUSEE:  { bg: "#fef2f2", color: "#dc2626", label: "Refusée" },
  EN_COURS: { bg: "#fff7ed", color: "#d97706", label: "En cours" },
  ANNULEE:  { bg: "#f3f4f6", color: "#6b7280", label: "Annulée" },
};

const MISSION_LABELS: Record<string, string> = {
  MS: "Mission de service",
  MOE: "Maîtrise d'œuvre",
  MCN: "Modernisation",
  MCM: "Maintenance",
};

type PhaseItem = { code: string; libelle: string; montantHt?: number; inclus?: boolean };
type Decision = { decision: string; decidedAt: string; decidedBy: string; commentaire?: string | null };

export default function ClientOffresPage() {
  const { selectedSite, selectedSiteId, loading: siteLoading } = useSelectedSite();
  const [allOffres, setAllOffres] = useState<OffreRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const [commentaire, setCommentaire] = useState("");
  const [confirm, setConfirm] = useState<{ id: number; action: "accept" | "refuse" } | null>(null);

  async function load() {
    try {
      const data = await clientApiFetch<OffreRow[]>("/api/client/offres");
      setAllOffres(data);
    } catch {
      setError("Impossible de charger les offres.");
    }
  }

  useEffect(() => { void load(); }, []);

  // Filter by selected site
  const offres = allOffres === null ? null
    : selectedSite
      ? allOffres.filter((o) => o.siteNom === selectedSite.nom)
      : allOffres;

  async function decide(id: number, action: "accept" | "refuse") {
    setActionId(id);
    setError(null);
    try {
      await clientApiPost(`/api/client/offres/${id}/${action}`, { commentaire });
      setConfirm(null);
      setCommentaire("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la décision.");
    } finally {
      setActionId(null);
    }
  }

  const siteName = selectedSite?.nom ?? null;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--navy)", marginBottom: 4 }}>
          Devis &amp; offres
        </h1>
        {siteName && (
          <p style={{ fontSize: 13, color: "var(--smoke)" }}>
            Site : <strong style={{ color: "var(--navy)" }}>{siteName}</strong>
          </p>
        )}
      </div>

      {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", color: "#dc2626", marginBottom: 16, fontSize: 13 }}>{error}</div>}

      {(offres === null || siteLoading) && !error && (
        <div style={{ color: "var(--smoke)", padding: "40px 0", textAlign: "center" }}>Chargement…</div>
      )}

      {offres !== null && !siteLoading && offres.length === 0 && (
        <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, padding: "60px 0", textAlign: "center", color: "var(--smoke)" }}>
          {selectedSiteId == null
            ? "Aucune offre pour le moment."
            : `Aucune offre pour le site « ${siteName} ».`}
        </div>
      )}

      {offres && offres.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {offres.map((o) => {
            const badge = STATUT_BADGE[o.statut] ?? { bg: "var(--g100)", color: "var(--smoke)", label: o.statut };
            const isOpen = expanded === o.id;
            let phases: PhaseItem[] = [];
            try { phases = JSON.parse(o.phasesLinesJson ?? "[]") as PhaseItem[]; } catch { /* ignore */ }
            let decision: Decision | null = null;
            try { if (o.clientDecisionJson) decision = JSON.parse(o.clientDecisionJson) as Decision; } catch { /* ignore */ }

            return (
              <div key={o.id} style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, overflow: "hidden", transition: "box-shadow 0.15s" }}>
                {/* Header */}
                <div
                  onClick={() => setExpanded(isOpen ? null : o.id)}
                  style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 24px", cursor: "pointer", flexWrap: "wrap" }}
                >
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "var(--navy)", marginBottom: 3 }}>{o.numeroOffre}</div>
                    <div style={{ fontSize: 13, color: "var(--smoke)" }}>
                      {MISSION_LABELS[o.typeMission] ?? o.typeMission} · {o.siteNom}
                      {o.dateOffre && <> · {o.dateOffre}</>}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <span style={{ fontSize: 17, fontWeight: 700, color: "var(--navy)" }}>{o.montantHt.toLocaleString("fr-FR")} € HT</span>
                    <span style={{ background: badge.bg, color: badge.color, borderRadius: 6, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>{badge.label}</span>
                    <span style={{ fontSize: 12, color: "var(--smoke)" }}>{isOpen ? "▲" : "▼"}</span>
                  </div>
                </div>

                {/* Decision banner */}
                {decision && (
                  <div style={{ margin: "0 24px 16px", background: decision.decision === "ACCEPTEE" ? "#f0fdf4" : "#fef2f2", border: `1px solid ${decision.decision === "ACCEPTEE" ? "#bbf7d0" : "#fecaca"}`, borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
                    <strong>{decision.decision === "ACCEPTEE" ? "Acceptée" : "Refusée"}</strong> par {decision.decidedBy} le {new Date(decision.decidedAt).toLocaleDateString("fr-FR")}
                    {decision.commentaire && <> · <em>{decision.commentaire}</em></>}
                  </div>
                )}

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ borderTop: "1px solid var(--g100)", padding: "20px 24px" }}>
                    {phases.length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--smoke)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Phases incluses</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {phases.map((p) => (
                            <div key={p.code} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--g50)", borderRadius: 8 }}>
                              <span style={{ fontSize: 14 }}>{p.inclus !== false ? "✅" : "⬜"}</span>
                              <span style={{ flex: 1, fontSize: 13, color: "var(--navy)" }}>{p.code} — {p.libelle}</span>
                              {p.montantHt != null && <span style={{ fontWeight: 600, fontSize: 13 }}>{p.montantHt.toLocaleString("fr-FR")} €</span>}
                            </div>
                          ))}
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10, padding: "10px 12px", background: "#fff7ed", borderRadius: 8, fontSize: 13 }}>
                          <span style={{ color: "var(--smoke)" }}>Total HT</span>
                          <span style={{ fontWeight: 700, marginLeft: 16, color: "var(--orange)" }}>{o.montantHt.toLocaleString("fr-FR")} €</span>
                        </div>
                      </div>
                    )}

                    {o.gestionnaireNom && (
                      <div style={{ fontSize: 12, color: "var(--smoke)", marginBottom: 16 }}>
                        Gestionnaire : <strong>{o.gestionnaireNom}</strong>
                        {o.gestionnaireContact && <> · {o.gestionnaireContact}</>}
                      </div>
                    )}

                    {/* Action buttons — only for ENVOYEE */}
                    {o.statut === "ENVOYEE" && (
                      <div>
                        {confirm?.id === o.id ? (
                          <div style={{ background: "var(--g50)", borderRadius: 10, padding: 16 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", marginBottom: 10 }}>
                              {confirm.action === "accept" ? "Confirmer l'acceptation de cette offre ?" : "Confirmer le refus de cette offre ?"}
                            </div>
                            <textarea
                              value={commentaire}
                              onChange={(e) => setCommentaire(e.target.value)}
                              placeholder="Commentaire optionnel…"
                              rows={2}
                              style={{ width: "100%", border: "1px solid var(--g200)", borderRadius: 8, padding: "8px 12px", fontSize: 13, resize: "none", outline: "none", boxSizing: "border-box", marginBottom: 12 }}
                            />
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                onClick={() => decide(confirm.id, confirm.action)}
                                disabled={actionId === o.id}
                                style={{ background: confirm.action === "accept" ? "#16a34a" : "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: actionId === o.id ? 0.6 : 1 }}
                              >
                                {actionId === o.id ? "…" : confirm.action === "accept" ? "Confirmer l'acceptation" : "Confirmer le refus"}
                              </button>
                              <button onClick={() => { setConfirm(null); setCommentaire(""); }} style={{ background: "var(--g100)", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <button
                              onClick={() => setConfirm({ id: o.id, action: "accept" })}
                              style={{ background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                            >
                              ✓ Accepter l'offre
                            </button>
                            <button
                              onClick={() => setConfirm({ id: o.id, action: "refuse" })}
                              style={{ background: "#fff", color: "#dc2626", border: "2px solid #dc2626", borderRadius: 8, padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                            >
                              ✕ Refuser l'offre
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
