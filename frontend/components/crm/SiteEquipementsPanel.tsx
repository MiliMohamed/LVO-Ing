"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { CrmEntityModal } from "@/components/crm/ui/CrmEntityModal";
import { apiFetch } from "@/lib/api";
import { canUsePhase2Tools, normalizeRole } from "@/lib/rbac";
import type { EquipementType, SiteEquipementRow } from "@/lib/types";
import { readRole, readToken } from "@/lib/token-storage";

const TYPE_OPTIONS: { value: EquipementType; label: string }[] = [
  { value: "ASCENSEUR", label: "Ascenseur" },
  { value: "MONTE_CHARGE", label: "Monte-charge" },
  { value: "MONTE_VOITURE", label: "Monte-voiture" },
  { value: "PLATEFORME", label: "Plateforme élévatrice" },
  { value: "DAE", label: "DAE (ascenseur grande vitesse)" },
];

const STATUT_LABEL: Record<string, string> = {
  ACTIF: "Actif",
  HORS_SERVICE: "Hors service",
  RETIRE: "Retiré",
};

const EMPTY_FORM = {
  type: "ASCENSEUR" as EquipementType,
  marque: "",
  modele: "",
  numeroSerie: "",
  anneeInstallation: "",
  capaciteKg: "",
  etages: "",
  statut: "ACTIF",
  notes: "",
};

export function SiteEquipementsPanel({ siteId, siteNom, onChanged }: { siteId: number; siteNom?: string; onChanged: () => void }) {
  const canEdit = canUsePhase2Tools(normalizeRole(readRole()));
  const [rows, setRows] = useState<SiteEquipementRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const load = useCallback(() => {
    const token = readToken();
    void (async () => {
      try {
        const g = (await apiFetch(`/api/sites/${siteId}/equipements`, { token })) as SiteEquipementRow[] | null;
        setRows(Array.isArray(g) ? g.filter((e) => e.statut !== "RETIRE") : []);
        setErr(null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Erreur");
        setRows([]);
      }
    })();
  }, [siteId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addEquipement() {
    if (!form.marque.trim() || !form.modele.trim() || !form.numeroSerie.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(`/api/sites/${siteId}/equipements`, {
        token: readToken(),
        method: "POST",
        body: JSON.stringify({
          type: form.type,
          marque: form.marque.trim(),
          modele: form.modele.trim(),
          numeroSerie: form.numeroSerie.trim(),
          anneeInstallation: form.anneeInstallation ? Number(form.anneeInstallation) : null,
          capaciteKg: form.capaciteKg ? Number(form.capaciteKg) : null,
          etages: form.etages.trim() || null,
          statut: form.statut,
          notes: form.notes.trim() || null,
        }),
      });
      setModal(false);
      setForm({ ...EMPTY_FORM });
      load();
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function setStatut(id: number, statut: "ACTIF" | "HORS_SERVICE" | "RETIRE") {
    if (statut === "RETIRE" && !globalThis.confirm("Retirer cet équipement du registre actif ?")) return;
    setBusy(true);
    try {
      if (statut === "RETIRE") {
        await apiFetch(`/api/sites/${siteId}/equipements/${id}`, { token: readToken(), method: "DELETE" });
      } else {
        await apiFetch(`/api/sites/${siteId}/equipements/${id}`, {
          token: readToken(),
          method: "PATCH",
          body: JSON.stringify({ statut }),
        });
      }
      load();
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  const mmsHref = `/crm/outils/maintenance-mms${siteNom ? `?site=${encodeURIComponent(siteNom)}` : ""}`;

  return (
    <div className="mt-4 border-t border-[var(--g200)] pt-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[var(--navy)]">Registre équipements</h3>
        <div className="flex flex-wrap gap-1">
          {canEdit ? (
            <Link href={mmsHref} className="cbtn cbtn-ghost cbtn-sm">
              Analyse MMS →
            </Link>
          ) : null}
          {canEdit ? (
            <button type="button" className="cbtn cbtn-ghost cbtn-sm" disabled={busy} onClick={() => setModal(true)}>
              + Ajouter
            </button>
          ) : null}
        </div>
      </div>
      <p className="crm-hint mb-2">Ascenseurs, monte-charges et équipements de levage rattachés au site.</p>
      {err ? <p className="crm-alert crm-alert--error mb-2">{err}</p> : null}
      <div className="tw max-h-56 overflow-y-auto">
        <table className="ct">
          <thead>
            <tr>
              <th>Type</th>
              <th>Marque / modèle</th>
              <th>N° série</th>
              <th>Étages</th>
              <th>Statut</th>
              {canEdit ? <th>Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 6 : 5} className="text-[var(--g500)]">
                  Aucun équipement enregistré.
                </td>
              </tr>
            ) : (
              (rows ?? []).map((e) => (
                <tr key={e.id}>
                  <td>{TYPE_OPTIONS.find((t) => t.value === e.type)?.label ?? e.type}</td>
                  <td>
                    {e.marque} {e.modele}
                    {e.anneeInstallation ? <span className="text-[var(--g500)]"> ({e.anneeInstallation})</span> : null}
                  </td>
                  <td className="font-mono text-xs">{e.numeroSerie}</td>
                  <td>{e.etages ?? "—"}</td>
                  <td>
                    <span className={e.statut === "HORS_SERVICE" ? "text-amber-700" : ""}>
                      {STATUT_LABEL[e.statut] ?? e.statut}
                    </span>
                  </td>
                  {canEdit ? (
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {e.statut === "HORS_SERVICE" ? (
                          <button
                            type="button"
                            className="cbtn cbtn-ghost cbtn-sm"
                            disabled={busy}
                            onClick={() => void setStatut(e.id, "ACTIF")}
                          >
                            Réactiver
                          </button>
                        ) : e.statut === "ACTIF" ? (
                          <button
                            type="button"
                            className="cbtn cbtn-ghost cbtn-sm"
                            disabled={busy}
                            onClick={() => void setStatut(e.id, "HORS_SERVICE")}
                          >
                            Hors service
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="cbtn cbtn-ghost cbtn-sm"
                          disabled={busy}
                          onClick={() => void setStatut(e.id, "RETIRE")}
                        >
                          Retirer
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CrmEntityModal
        open={modal}
        onClose={() => setModal(false)}
        title="Nouvel équipement"
        subtitle="Enregistrer un ascenseur, monte-charge ou autre équipement de levage."
        size="md"
        zIndex={60}
        footer={
          <>
            <button type="button" className="cbtn cbtn-primary" disabled={busy} onClick={() => void addEquipement()}>
              Enregistrer
            </button>
            <button type="button" className="cbtn cbtn-ghost" onClick={() => setModal(false)}>
              Annuler
            </button>
          </>
        }
      >
        <div className="crm-form-grid crm-form-grid--tight">
          <label className="crm-field crm-span-2">
            <span className="crm-label">Type</span>
            <select
              className="crm-select"
              value={form.type}
              onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as EquipementType }))}
            >
              {TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="crm-field">
            <span className="crm-label">Marque</span>
            <input className="crm-input" value={form.marque} onChange={(e) => setForm((p) => ({ ...p, marque: e.target.value }))} />
          </label>
          <label className="crm-field">
            <span className="crm-label">Modèle</span>
            <input className="crm-input" value={form.modele} onChange={(e) => setForm((p) => ({ ...p, modele: e.target.value }))} />
          </label>
          <label className="crm-field crm-span-2">
            <span className="crm-label">N° de série</span>
            <input
              className="crm-input font-mono"
              value={form.numeroSerie}
              onChange={(e) => setForm((p) => ({ ...p, numeroSerie: e.target.value }))}
            />
          </label>
          <label className="crm-field">
            <span className="crm-label">Année installation</span>
            <input
              className="crm-input"
              type="number"
              min={1950}
              max={2100}
              value={form.anneeInstallation}
              onChange={(e) => setForm((p) => ({ ...p, anneeInstallation: e.target.value }))}
            />
          </label>
          <label className="crm-field">
            <span className="crm-label">Capacité (kg)</span>
            <input
              className="crm-input"
              type="number"
              min={0}
              value={form.capaciteKg}
              onChange={(e) => setForm((p) => ({ ...p, capaciteKg: e.target.value }))}
            />
          </label>
          <label className="crm-field crm-span-2">
            <span className="crm-label">Étages desservis</span>
            <input
              className="crm-input"
              placeholder="ex. RDC → 18"
              value={form.etages}
              onChange={(e) => setForm((p) => ({ ...p, etages: e.target.value }))}
            />
          </label>
          <label className="crm-field crm-span-2">
            <span className="crm-label">Notes</span>
            <input className="crm-input" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
          </label>
        </div>
      </CrmEntityModal>
    </div>
  );
}
