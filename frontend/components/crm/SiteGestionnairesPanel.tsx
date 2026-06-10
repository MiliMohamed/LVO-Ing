"use client";

import { useCallback, useEffect, useState } from "react";

import { CrmEntityModal } from "@/components/crm/ui/CrmEntityModal";
import { apiFetch } from "@/lib/api";
import { readToken } from "@/lib/token-storage";
import type { ClientRow, SiteGestionnaireRow } from "@/lib/types";

export function SiteGestionnairesPanel({ siteId, onChanged }: { siteId: number; onChanged: () => void }) {
  const [rows, setRows] = useState<SiteGestionnaireRow[] | null>(null);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(false);
  const [newClientNom, setNewClientNom] = useState("");
  const [newPrincipal, setNewPrincipal] = useState(false);
  const [newNotes, setNewNotes] = useState("");

  const load = useCallback(() => {
    const token = readToken();
    void (async () => {
      try {
        const [g, cl] = await Promise.all([
          apiFetch(`/api/sites/${siteId}/gestionnaires`, { token }) as Promise<SiteGestionnaireRow[] | null>,
          apiFetch("/api/clients", { token }) as Promise<ClientRow[] | null>,
        ]);
        setRows(Array.isArray(g) ? g : []);
        setClients(Array.isArray(cl) ? cl : []);
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

  const today = new Date().toISOString().slice(0, 10);
  function isActive(g: SiteGestionnaireRow) {
    return !g.dateFin || g.dateFin >= today;
  }

  async function addGestionnaire() {
    if (!newClientNom.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(`/api/sites/${siteId}/gestionnaires`, {
        token: readToken(),
        method: "POST",
        body: JSON.stringify({
          clientNom: newClientNom.trim(),
          isPrincipal: newPrincipal,
          notes: newNotes.trim() || null,
        }),
      });
      setModal(false);
      setNewClientNom("");
      setNewPrincipal(false);
      setNewNotes("");
      load();
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function terminer(id: number) {
    if (!globalThis.confirm("Clôturer ce gestionnaire (date de fin = aujourd’hui) ?")) return;
    setBusy(true);
    try {
      await apiFetch(`/api/sites/${siteId}/gestionnaires/${id}`, {
        token: readToken(),
        method: "DELETE",
      });
      load();
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function promouvoir(id: number) {
    setBusy(true);
    try {
      await apiFetch(`/api/sites/${siteId}/gestionnaires/${id}/promouvoir`, {
        token: readToken(),
        method: "POST",
      });
      load();
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-[var(--g200)] pt-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[var(--navy)]">Gestionnaires du site (Phase 6)</h3>
        <button type="button" className="cbtn cbtn-ghost cbtn-sm" disabled={busy} onClick={() => setModal(true)}>
          + Ajouter
        </button>
      </div>
      <p className="crm-hint mb-2">
        Un seul principal actif à la fois. Historique conservé (pas de suppression dure).
      </p>
      {err ? <p className="crm-alert crm-alert--error mb-2">{err}</p> : null}
      <div className="tw max-h-48 overflow-y-auto">
        <table className="ct">
          <thead>
            <tr>
              <th>Client</th>
              <th>Rôle</th>
              <th>Début / fin</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((g) => (
              <tr key={g.id}>
                <td>{g.clientNom}</td>
                <td>{g.isPrincipal && isActive(g) ? "Principal" : isActive(g) ? "Secondaire" : "—"}</td>
                <td className="whitespace-nowrap">
                  {g.dateDebut}
                  {g.dateFin ? ` → ${g.dateFin}` : ""}
                </td>
                <td>
                  {isActive(g) ? (
                    <div className="flex flex-wrap gap-1">
                      {!g.isPrincipal ? (
                        <button type="button" className="cbtn cbtn-ghost cbtn-sm" disabled={busy} onClick={() => void promouvoir(g.id)}>
                          Promouvoir
                        </button>
                      ) : null}
                      <button type="button" className="cbtn cbtn-ghost cbtn-sm" disabled={busy} onClick={() => void terminer(g.id)}>
                        Clôturer
                      </button>
                    </div>
                  ) : (
                    <span className="text-[var(--g500)]">Terminé</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CrmEntityModal
        open={modal}
        onClose={() => setModal(false)}
        title="Nouveau gestionnaire"
        subtitle="Rattacher un client au site avec rôle principal ou secondaire."
        size="sm"
        zIndex={60}
        footer={
          <>
            <button type="button" className="cbtn cbtn-primary" disabled={busy} onClick={() => void addGestionnaire()}>
              Ajouter
            </button>
            <button type="button" className="cbtn cbtn-ghost" onClick={() => setModal(false)}>
              Annuler
            </button>
          </>
        }
      >
        <div className="crm-form-grid crm-form-grid--tight">
          <label className="crm-field crm-span-2">
            <span className="crm-label">Client</span>
            <select
              className="crm-select"
              value={newClientNom}
              onChange={(e) => setNewClientNom(e.target.value)}
            >
              <option value="">—</option>
              {clients.map((c) => (
                <option key={c.id} value={c.raisonSociale}>
                  {c.raisonSociale}
                </option>
              ))}
            </select>
          </label>
          <label className="crm-field-check crm-span-2">
            <input type="checkbox" checked={newPrincipal} onChange={(e) => setNewPrincipal(e.target.checked)} />
            Principal (démet l’ancien principal)
          </label>
          <label className="crm-field crm-span-2">
            <span className="crm-label">Notes</span>
            <input className="crm-input" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
          </label>
        </div>
      </CrmEntityModal>
    </div>
  );
}
