"use client";

import { useEffect, useState } from "react";
import { clientApiFetch, clientApiPost } from "@/lib/client-api";
import type { ClientContratRow } from "@/lib/types";

const STATUT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  ACTIF:             { label: "Actif",              color: "#16a34a", bg: "#f0fdf4" },
  EN_RENOUVELLEMENT: { label: "En renouvellement",  color: "#2563eb", bg: "#eff6ff" },
  EXPIRE:            { label: "Expiré",             color: "#dc2626", bg: "#fef2f2" },
  RESILIE:           { label: "Résilié",            color: "#6b7280", bg: "#f3f4f6" },
};

function daysUntil(isoDate: string): number {
  const diff = new Date(isoDate).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

function AlerteBand({ contrat }: { contrat: ClientContratRow }) {
  if (contrat.statut !== "ACTIF") return null;
  const days = daysUntil(contrat.dateFin);
  if (days > 90) return null;
  const color = days <= 30 ? "#dc2626" : days <= 60 ? "#d97706" : "#2563eb";
  const bg    = days <= 30 ? "#fef2f2" : days <= 60 ? "#fffbeb" : "#eff6ff";
  return (
    <div style={{ background: bg, border: `1px solid ${color}20`, borderRadius: 7, padding: "6px 12px", fontSize: 12, color, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>
      ⚠️ Expire dans {days} jour{days > 1 ? "s" : ""}
    </div>
  );
}

export default function ContratsPage() {
  const [contrats, setContrats] = useState<ClientContratRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [renewing, setRenewing] = useState<number | null>(null);
  const [renewSuccess, setRenewSuccess] = useState<number | null>(null);

  useEffect(() => {
    void clientApiFetch<ClientContratRow[]>("/api/client/contrats")
      .then(setContrats)
      .catch(() => setError("Impossible de charger les contrats."));
  }, []);

  async function handleRenouvellement(contrat: ClientContratRow) {
    setRenewing(contrat.id);
    try {
      await clientApiPost(`/api/client/contrats/${contrat.id}/renouvellement`, {});
      setContrats((prev) =>
        prev?.map((c) =>
          c.id === contrat.id ? { ...c, statut: "EN_RENOUVELLEMENT", demandeRenouvellementAt: new Date().toISOString() } : c,
        ) ?? prev,
      );
      setRenewSuccess(contrat.id);
      setTimeout(() => setRenewSuccess(null), 4000);
    } catch {
      // silent
    } finally {
      setRenewing(null);
    }
  }

  const actifs      = contrats?.filter((c) => c.statut === "ACTIF").length ?? 0;
  const expirant90  = contrats?.filter((c) => c.statut === "ACTIF" && daysUntil(c.dateFin) <= 90).length ?? 0;
  const expires     = contrats?.filter((c) => c.statut === "EXPIRE").length ?? 0;
  const enRenouv    = contrats?.filter((c) => c.statut === "EN_RENOUVELLEMENT").length ?? 0;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--navy)", marginBottom: 4 }}>Mes contrats</h1>
        <p style={{ fontSize: 13, color: "var(--smoke)" }}>Contrats de maintenance et de service actifs</p>
      </div>

      {/* KPIs */}
      {contrats !== null && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Actifs", value: actifs, color: "#16a34a", icon: "✅" },
            { label: "Expirant < 90j", value: expirant90, color: "#d97706", icon: "⚠️" },
            { label: "En renouvellement", value: enRenouv, color: "#2563eb", icon: "🔄" },
            { label: "Expirés", value: expires, color: "#dc2626", icon: "❌" },
          ].map((k) => (
            <div key={k.label} style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ fontSize: 18, marginBottom: 6 }}>{k.icon}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 11, color: "var(--smoke)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6 }}>{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {renewSuccess !== null && (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 16px", color: "#166534", marginBottom: 20, fontWeight: 600, fontSize: 13 }}>
          ✅ Demande de renouvellement transmise à LVO Ingénierie.
        </div>
      )}

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", color: "#dc2626", marginBottom: 24 }}>
          {error}
        </div>
      )}

      {contrats === null && !error && (
        <div style={{ color: "var(--smoke)", padding: "40px 0", textAlign: "center" }}>Chargement…</div>
      )}

      {contrats !== null && contrats.length === 0 && (
        <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, padding: "60px 0", textAlign: "center", color: "var(--smoke)" }}>
          Aucun contrat enregistré.
        </div>
      )}

      {contrats && contrats.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {contrats.map((c) => {
            const statut = STATUT_CONFIG[c.statut] ?? STATUT_CONFIG.ACTIF;
            const isOpen = expanded === c.id;
            const avenants: { date: string; description: string }[] = c.avenantsJson ? JSON.parse(c.avenantsJson) : [];
            const canRenew = c.statut === "ACTIF" || c.statut === "EXPIRE";

            return (
              <div key={c.id} style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, overflow: "hidden" }}>
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : c.id)}
                  style={{
                    width: "100%", display: "grid",
                    gridTemplateColumns: "1fr auto auto",
                    alignItems: "center", gap: 16,
                    padding: "16px 20px", background: "none", border: "none", cursor: "pointer", textAlign: "left",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)" }}>{c.reference}</span>
                      <span style={{ fontSize: 12, color: "var(--smoke)" }}>{c.intitule}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--smoke)", marginBottom: 4 }}>
                      {c.siteNom} · {c.prestataire}
                    </div>
                    <AlerteBand contrat={c} />
                  </div>
                  <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)" }}>
                      {c.montantAnnuelHt.toLocaleString("fr-FR")} € HT/an
                    </div>
                    <div style={{ fontSize: 11, color: "var(--smoke)", marginTop: 2 }}>
                      {new Date(c.dateDebut).toLocaleDateString("fr-FR")} → {new Date(c.dateFin).toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: statut.color, background: statut.bg,
                    borderRadius: 6, padding: "4px 10px", whiteSpace: "nowrap",
                  }}>
                    {statut.label}
                  </span>
                </button>

                {isOpen && (
                  <div style={{ borderTop: "1px solid var(--g100)", padding: "18px 20px 20px", background: "var(--g50)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 16 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 11, color: "var(--smoke)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 3 }}>Type de contrat</div>
                          <div style={{ fontSize: 13 }}>{c.typeContrat}</div>
                        </div>
                        {c.conditionsRenouvellement && (
                          <div>
                            <div style={{ fontSize: 11, color: "var(--smoke)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 3 }}>Conditions de renouvellement</div>
                            <div style={{ fontSize: 13 }}>{c.conditionsRenouvellement}</div>
                          </div>
                        )}
                        {c.clauseRevisionTarifaire && (
                          <div>
                            <div style={{ fontSize: 11, color: "var(--smoke)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 3 }}>Révision tarifaire</div>
                            <div style={{ fontSize: 13 }}>{c.clauseRevisionTarifaire}</div>
                          </div>
                        )}
                      </div>
                      <div>
                        {avenants.length > 0 && (
                          <div>
                            <div style={{ fontSize: 11, color: "var(--smoke)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 8 }}>Avenants ({avenants.length})</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {avenants.map((av, i) => (
                                <div key={i} style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 8, padding: "8px 12px" }}>
                                  <div style={{ fontSize: 11, color: "var(--smoke)", marginBottom: 2 }}>
                                    {new Date(av.date).toLocaleDateString("fr-FR")}
                                  </div>
                                  <div style={{ fontSize: 13 }}>{av.description}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {c.demandeRenouvellementAt ? (
                      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#1d4ed8" }}>
                        🔄 Demande de renouvellement envoyée le {new Date(c.demandeRenouvellementAt).toLocaleDateString("fr-FR")} — LVO Ingénierie revient vers vous prochainement.
                      </div>
                    ) : canRenew ? (
                      <button
                        onClick={() => void handleRenouvellement(c)}
                        disabled={renewing === c.id}
                        style={{
                          background: "var(--navy)", color: "#fff", border: "none", borderRadius: 8,
                          padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer",
                        }}
                      >
                        {renewing === c.id ? "Envoi…" : "Demander le renouvellement"}
                      </button>
                    ) : null}
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
