"use client";

import { useEffect, useState } from "react";
import { clientApiFetch, clientApiPost } from "@/lib/client-api";
import { useSelectedSite } from "@/lib/site-context";
import type { ClientInterventionRow, ClientEquipementOption, SiteRow } from "@/lib/types";

const STATUT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  CREEE:      { label: "Créée",      color: "#6b7280", bg: "#f3f4f6" },
  ASSIGNEE:   { label: "Assignée",   color: "#2563eb", bg: "#eff6ff" },
  EN_COURS:   { label: "En cours",   color: "#d97706", bg: "#fffbeb" },
  RESOLUE:    { label: "Résolue",    color: "#16a34a", bg: "#f0fdf4" },
  A_VALIDER:  { label: "À valider",  color: "#7c3aed", bg: "#f5f3ff" },
};

const PRIORITE_CONFIG: Record<string, { label: string; color: string }> = {
  NORMALE:  { label: "Normale",  color: "#6b7280" },
  URGENTE:  { label: "Urgente",  color: "#d97706" },
  CRITIQUE: { label: "Critique", color: "#dc2626" },
};

const TYPE_LABELS: Record<string, string> = {
  PANNE:                  "Panne",
  MAINTENANCE_PREVENTIVE: "Maintenance préventive",
  VISITE_REGLEMENTAIRE:   "Visite réglementaire",
  MISE_EN_CONFORMITE:     "Mise en conformité",
  AUTRE:                  "Autre",
};

const STATUT_STEPS = ["CREEE", "ASSIGNEE", "EN_COURS", "RESOLUE", "A_VALIDER"] as const;

function StatutTimeline({ statut }: { statut: string }) {
  const steps = ["CREEE", "ASSIGNEE", "EN_COURS", "RESOLUE"];
  const currentIdx = steps.indexOf(statut === "A_VALIDER" ? "RESOLUE" : statut);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginTop: 6 }}>
      {steps.map((s, i) => {
        const done = i <= currentIdx;
        const cfg = STATUT_CONFIG[s];
        return (
          <div key={s} style={{ display: "flex", alignItems: "center" }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: done ? cfg.color : "#d1d5db",
              border: `2px solid ${done ? cfg.color : "#d1d5db"}`,
            }} />
            {i < steps.length - 1 && (
              <div style={{ width: 28, height: 2, background: i < currentIdx ? "#16a34a" : "#e5e7eb" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function InterventionsPage() {
  const { sites, selectedSite, selectedSiteId, loading: siteLoading } = useSelectedSite();
  const [interventions, setInterventions] = useState<ClientInterventionRow[] | null>(null);
  const [equipements, setEquipements] = useState<ClientEquipementOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  // Form state
  const [form, setForm] = useState({
    siteId: "",
    equipementId: "",
    type: "PANNE",
    priorite: "URGENTE",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function loadInterventions(siteId?: number) {
    const qs = siteId ? `?siteId=${siteId}` : "";
    void clientApiFetch<ClientInterventionRow[]>(`/api/client/interventions${qs}`)
      .then(setInterventions)
      .catch(() => setError("Impossible de charger les interventions."));
  }

  useEffect(() => {
    if (!siteLoading) loadInterventions(selectedSiteId ?? undefined);
  }, [selectedSiteId, siteLoading]);

  useEffect(() => {
    const id = Number(form.siteId);
    if (!id) { setEquipements([]); return; }
    void clientApiFetch<ClientEquipementOption[]>(`/api/client/equipements?siteId=${id}`)
      .then(setEquipements)
      .catch(() => setEquipements([]));
  }, [form.siteId]);

  useEffect(() => {
    if (showForm && selectedSiteId) {
      setForm((f) => ({ ...f, siteId: String(selectedSiteId) }));
    }
  }, [showForm, selectedSiteId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description.trim()) { setFormError("La description est requise."); return; }
    setSubmitting(true); setFormError(null);
    try {
      const created = await clientApiPost<ClientInterventionRow>("/api/client/interventions", {
        siteId: form.siteId ? Number(form.siteId) : undefined,
        equipementId: form.equipementId ? Number(form.equipementId) : undefined,
        type: form.type, priorite: form.priorite, description: form.description,
      });
      setInterventions((prev) => [created, ...(prev ?? [])]);
      setShowForm(false);
      setForm({ siteId: selectedSiteId ? String(selectedSiteId) : "", equipementId: "", type: "PANNE", priorite: "URGENTE", description: "" });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur lors de la déclaration.");
    } finally { setSubmitting(false); }
  }

  const enCours  = interventions?.filter((i) => ["CREEE","ASSIGNEE","EN_COURS"].includes(i.statut)).length ?? 0;
  const resolues = interventions?.filter((i) => i.statut === "RESOLUE").length ?? 0;
  const aValider = interventions?.filter((i) => i.statut === "A_VALIDER").length ?? 0;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--navy)", marginBottom: 4 }}>
            Interventions & Pannes
          </h1>
          {selectedSite && (
            <p style={{ fontSize: 13, color: "var(--smoke)" }}>
              Site : <strong style={{ color: "var(--navy)" }}>{selectedSite.nom}</strong>
            </p>
          )}
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{
            background: "var(--navy)", color: "#fff", border: "none", borderRadius: 10,
            padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          🔧 Déclarer une panne
        </button>
      </div>

      {/* KPI cards */}
      {interventions !== null && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Total", value: interventions.length, color: "var(--navy)", icon: "📋" },
            { label: "En cours", value: enCours, color: "#d97706", icon: "⚙️" },
            { label: "À valider", value: aValider, color: "#7c3aed", icon: "✅" },
            { label: "Résolues", value: resolues, color: "#16a34a", icon: "✔️" },
          ].map((k) => (
            <div key={k.label} style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ fontSize: 18, marginBottom: 6 }}>{k.icon}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 11, color: "var(--smoke)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6 }}>{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Declare form */}
      {showForm && (
        <div style={{ background: "#fff", border: "1.5px solid var(--navy)", borderRadius: 14, padding: "20px 24px", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--navy)" }}>Déclarer une panne / intervention</h2>
            <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--smoke)" }}>✕</button>
          </div>
          <form onSubmit={(e) => void handleSubmit(e)}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: "var(--navy)" }}>Site</span>
                <select
                  value={form.siteId}
                  onChange={(e) => setForm((f) => ({ ...f, siteId: e.target.value, equipementId: "" }))}
                  style={{ border: "1px solid var(--g200)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
                >
                  <option value="">— Tous les sites —</option>
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: "var(--navy)" }}>Équipement (optionnel)</span>
                <select
                  value={form.equipementId}
                  onChange={(e) => setForm((f) => ({ ...f, equipementId: e.target.value }))}
                  disabled={!form.siteId || equipements.length === 0}
                  style={{ border: "1px solid var(--g200)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
                >
                  <option value="">— Non précisé —</option>
                  {equipements.map((eq) => <option key={eq.id} value={eq.id}>{eq.libelle}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: "var(--navy)" }}>Type</span>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  style={{ border: "1px solid var(--g200)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
                >
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: "var(--navy)" }}>Priorité</span>
                <select
                  value={form.priorite}
                  onChange={(e) => setForm((f) => ({ ...f, priorite: e.target.value }))}
                  style={{ border: "1px solid var(--g200)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
                >
                  <option value="NORMALE">Normale</option>
                  <option value="URGENTE">Urgente</option>
                  <option value="CRITIQUE">Critique</option>
                </select>
              </label>
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13, marginBottom: 14 }}>
              <span style={{ fontWeight: 600, color: "var(--navy)" }}>Description *</span>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="Décrivez la panne ou l'intervention à effectuer…"
                style={{ border: "1px solid var(--g200)", borderRadius: 8, padding: "8px 10px", fontSize: 13, resize: "vertical" }}
              />
            </label>
            {formError && (
              <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 10 }}>{formError}</div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" disabled={submitting} style={{ background: "var(--navy)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {submitting ? "Envoi…" : "Enregistrer la déclaration"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} style={{ background: "var(--g100)", color: "var(--navy)", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, cursor: "pointer" }}>
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", color: "#dc2626", marginBottom: 24 }}>
          {error}
        </div>
      )}

      {(interventions === null || siteLoading) && !error && (
        <div style={{ color: "var(--smoke)", padding: "40px 0", textAlign: "center" }}>Chargement…</div>
      )}

      {interventions !== null && interventions.length === 0 && !siteLoading && (
        <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, padding: "60px 0", textAlign: "center", color: "var(--smoke)" }}>
          Aucune intervention enregistrée.
        </div>
      )}

      {/* Interventions list */}
      {interventions && interventions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {interventions.map((inv) => {
            const statut = STATUT_CONFIG[inv.statut] ?? STATUT_CONFIG.CREEE;
            const priorite = PRIORITE_CONFIG[inv.priorite] ?? PRIORITE_CONFIG.NORMALE;
            const isOpen = expanded === inv.id;
            return (
              <div
                key={inv.id}
                style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, overflow: "hidden" }}
              >
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : inv.id)}
                  style={{
                    width: "100%", display: "grid",
                    gridTemplateColumns: "auto 1fr auto auto auto",
                    alignItems: "center", gap: 16,
                    padding: "14px 20px", background: "none", border: "none", cursor: "pointer", textAlign: "left",
                  }}
                >
                  {/* Priorité dot */}
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: priorite.color, flexShrink: 0 }} />

                  {/* Info principale */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)" }}>{inv.reference}</span>
                      <span style={{ fontSize: 11, color: "var(--smoke)", fontWeight: 500 }}>{TYPE_LABELS[inv.type] ?? inv.type}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--smoke)" }}>
                      {inv.siteNom}{inv.equipementLibelle ? ` · ${inv.equipementLibelle}` : ""}
                    </div>
                    <StatutTimeline statut={inv.statut} />
                  </div>

                  {/* Priorité badge */}
                  <span style={{ fontSize: 11, fontWeight: 700, color: priorite.color, whiteSpace: "nowrap" }}>
                    {priorite.label}
                  </span>

                  {/* Statut badge */}
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: statut.color, background: statut.bg,
                    borderRadius: 6, padding: "3px 8px", whiteSpace: "nowrap",
                  }}>
                    {statut.label}
                  </span>

                  {/* Date */}
                  <span style={{ fontSize: 12, color: "var(--smoke)", whiteSpace: "nowrap" }}>
                    {new Date(inv.declaredAt).toLocaleDateString("fr-FR")}
                  </span>
                </button>

                {isOpen && (
                  <div style={{ borderTop: "1px solid var(--g100)", padding: "16px 20px 20px", background: "var(--g50)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--smoke)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 4 }}>Description</div>
                        <div style={{ fontSize: 13, color: "var(--navy)" }}>{inv.description}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div>
                          <span style={{ fontSize: 11, color: "var(--smoke)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7 }}>Prestataire </span>
                          <span style={{ fontSize: 13, color: "var(--navy)" }}>{inv.prestataire ?? "En attente d'assignation"}</span>
                        </div>
                        <div>
                          <span style={{ fontSize: 11, color: "var(--smoke)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7 }}>Déclaré par </span>
                          <span style={{ fontSize: 13, color: "var(--navy)" }}>{inv.declaredByName}</span>
                        </div>
                        {inv.assignedAt && (
                          <div>
                            <span style={{ fontSize: 11, color: "var(--smoke)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7 }}>Assigné le </span>
                            <span style={{ fontSize: 13, color: "var(--navy)" }}>{new Date(inv.assignedAt).toLocaleDateString("fr-FR")}</span>
                          </div>
                        )}
                        {inv.resolvedAt && (
                          <div>
                            <span style={{ fontSize: 11, color: "var(--smoke)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7 }}>Résolu le </span>
                            <span style={{ fontSize: 13, color: "#16a34a", fontWeight: 700 }}>{new Date(inv.resolvedAt).toLocaleDateString("fr-FR")}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {inv.compteRendu && (
                      <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "12px 16px" }}>
                        <div style={{ fontSize: 11, color: "#166534", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 4 }}>Compte-rendu</div>
                        <div style={{ fontSize: 13, color: "#166534" }}>{inv.compteRendu}</div>
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
