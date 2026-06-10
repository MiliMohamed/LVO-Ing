"use client";

import { useEffect, useState } from "react";

import { CrmEntityModal } from "@/components/crm/ui/CrmEntityModal";
import { apiFetch } from "@/lib/api";
import { CRM_COMMANDE_STATUTS, CRM_OFFRE_STATUTS } from "@/lib/crm-workflow";
import { LVO_MISSION_TYPES, primaryMissionFromSelection } from "@/lib/reference-lvo";
import { readToken } from "@/lib/token-storage";

export type CrmEntityEditPath = "/api/offres" | "/api/commandes" | "/api/factures";

type Props = {
  path: CrmEntityEditPath;
  row: Record<string, unknown> | null;
  onClose: () => void;
  onSaved: () => void;
};

function txt(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (v == null || v === "—") return "";
  return String(v);
}

function parseOffreMissionCodesFromRow(row: Record<string, unknown>): string[] {
  const raw = txt(row, "typeMissionsJson");
  if (raw.trim()) {
    try {
      const j = JSON.parse(raw) as unknown;
      if (Array.isArray(j)) return [...new Set(j.map((x) => String(x).toUpperCase()).filter(Boolean))];
    } catch {
      /* ignore */
    }
  }
  const tm = txt(row, "typeMission").trim().toUpperCase();
  return tm ? [tm] : ["MS"];
}

function parseCmdMissionCodesFromRow(row: Record<string, unknown>): string[] {
  const raw = txt(row, "typeMissionsJson");
  if (raw.trim()) {
    try {
      const j = JSON.parse(raw) as unknown;
      if (Array.isArray(j)) return [...new Set(j.map((x) => String(x).toUpperCase()).filter(Boolean))];
    } catch {
      /* ignore */
    }
  }
  const tm = txt(row, "typeMission").trim().toUpperCase();
  return tm ? [tm] : ["MS"];
}

function parseMoney(s: string): number {
  const n = Number(String(s).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function CrmEntityEditModal({ path, row, onClose, onSaved }: Props) {
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [cmdMissionPick, setCmdMissionPick] = useState<Record<string, boolean>>({});
  const [offreMissionPick, setOffreMissionPick] = useState<Record<string, boolean>>({});
  const [offreParties, setOffreParties] = useState<{
    options: { clientNom: string; label: string; responsableContact: string | null }[];
  } | null>(null);

  useEffect(() => {
    if (!row) return;
    setLocalErr(null);
    if (path === "/api/offres") {
      const gestNom = txt(row, "gestionnaireNom") || txt(row, "gestionnaireEmail");
      setForm({
        numeroOffre: txt(row, "numeroOffre"),
        typeMission: txt(row, "typeMission"),
        statut: txt(row, "statut"),
        montantHt: String(row.montantHt ?? ""),
        dateOffre: txt(row, "dateOffre"),
        clientNom: txt(row, "clientNom"),
        siteNom: txt(row, "siteNom"),
        consultantEmail: txt(row, "consultantEmail"),
        gestionnaireNom: gestNom,
        gestionnaireContact: txt(row, "gestionnaireContact"),
        tauxTva: row.tauxTva != null ? String(row.tauxTva) : "",
        phasesMode: txt(row, "phasesMode") || "SELECTION",
        missionsJson: txt(row, "missionsJson"),
        echeancierFacturationJson: txt(row, "echeancierFacturationJson"),
        echeancierExecutionJson: txt(row, "echeancierExecutionJson"),
      });
      const offreCodes = parseOffreMissionCodesFromRow(row);
      const offrePick: Record<string, boolean> = {};
      for (const t of LVO_MISSION_TYPES) offrePick[t] = offreCodes.includes(t);
      setOffreMissionPick(offrePick);
    } else if (path === "/api/commandes") {
      setForm({
        numeroCommande: txt(row, "numeroCommande"),
        dateCommande: txt(row, "dateCommande"),
        typeMission: txt(row, "typeMission"),
        statut: txt(row, "statut") || "EN_ATTENTE",
        montantHt: String(row.montantHt ?? ""),
        montantFacture: String(row.montantFacture ?? ""),
        clientNom: txt(row, "clientNom"),
        siteNom: txt(row, "siteNom"),
        numeroClient: txt(row, "numeroClient"),
      });
      const codes = parseCmdMissionCodesFromRow(row);
      const pick: Record<string, boolean> = {};
      for (const t of LVO_MISSION_TYPES) pick[t] = codes.includes(t);
      setCmdMissionPick(pick);
    } else {
      setForm({
        numeroFacture: txt(row, "numeroFacture"),
        dateFacture: txt(row, "dateFacture"),
        numeroCommande: txt(row, "numeroCommande"),
        clientNom: txt(row, "clientNom"),
        montantHt: String(row.montantHt ?? ""),
        frais: String(row.frais ?? ""),
        modeReglement: txt(row, "modeReglement"),
        commandeId: row.commandeId != null ? String(row.commandeId) : "",
        statutFacturation: txt(row, "statutFacturation") || "CREEE",
      });
    }
  }, [row, path]);

  useEffect(() => {
    if (path !== "/api/offres" || !row) {
      setOffreParties(null);
      return;
    }
    const siteNom = txt(row, "siteNom").trim();
    if (!siteNom) {
      setOffreParties(null);
      return;
    }
    const token = readToken();
    let cancel = false;
    void (async () => {
      try {
        const siteList = (await apiFetch("/api/sites", { token })) as { id: number; nom: string }[] | null;
        const site = Array.isArray(siteList) ? siteList.find((s) => s.nom === siteNom) : undefined;
        if (!site || cancel) return;
        const d = (await apiFetch(`/api/sites/${site.id}/offre-destinataires`, { token })) as {
          options: { clientNom: string; label: string; responsableContact: string | null }[];
        } | null;
        if (!cancel && d?.options) setOffreParties({ options: d.options });
      } catch {
        if (!cancel) setOffreParties(null);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [path, row]);

  if (!row) return null;

  const id = Number(row.id);
  if (!Number.isFinite(id)) return null;

  function setField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function field(key: string, label: string, opts?: { type?: string; placeholder?: string }) {
    return (
      <label className="crm-field">
        <span className="crm-label">{label}</span>
        <input
          className="crm-input"
          type={opts?.type ?? "text"}
          value={form[key] ?? ""}
          placeholder={opts?.placeholder}
          onChange={(e) => setField(key, e.target.value)}
        />
      </label>
    );
  }

  async function save() {
    setLocalErr(null);
    setBusy(true);
    try {
      let body: Record<string, unknown> = {};
      if (path === "/api/offres") {
        const selectedOffre = LVO_MISSION_TYPES.filter((t) => offreMissionPick[t]);
        if (!selectedOffre.length) {
          setLocalErr("Sélectionnez au moins un type de mission.");
          return;
        }
        const primaryOffre = primaryMissionFromSelection(selectedOffre);
        body = {
          numeroOffre: form.numeroOffre?.trim(),
          typeMission: primaryOffre,
          typeMissions: selectedOffre,
          typeMissionsJson: JSON.stringify(selectedOffre),
          statut: form.statut?.trim(),
          montantHt: parseMoney(form.montantHt ?? "0"),
          dateOffre: form.dateOffre?.trim() || null,
          clientNom: form.clientNom?.trim(),
          siteNom: form.siteNom?.trim(),
          consultantEmail: form.consultantEmail?.trim() || null,
          gestionnaireNom: form.gestionnaireNom?.trim() || null,
          gestionnaireContact: form.gestionnaireContact?.trim() || null,
          gestionnaireEmail: null,
          tauxTva: form.tauxTva?.trim() ? parseMoney(form.tauxTva) : undefined,
          phasesMode: form.phasesMode?.trim() || "SELECTION",
          missionsJson: form.missionsJson?.trim() || null,
          echeancierFacturationJson: form.echeancierFacturationJson?.trim() || null,
          echeancierExecutionJson: form.echeancierExecutionJson?.trim() || null,
        };
      } else if (path === "/api/commandes") {
        const selected = LVO_MISSION_TYPES.filter((t) => cmdMissionPick[t]);
        if (!selected.length) {
          setLocalErr("Sélectionnez au moins un type de mission.");
          return;
        }
        const primary = primaryMissionFromSelection(selected);
        body = {
          numeroCommande: form.numeroCommande?.trim(),
          dateCommande: form.dateCommande?.trim() || null,
          typeMission: primary,
          typeMissionsJson: JSON.stringify(selected),
          statut: form.statut?.trim() || "EN_ATTENTE",
          montantHt: parseMoney(form.montantHt ?? "0"),
          montantFacture: parseMoney(form.montantFacture ?? "0"),
          clientNom: form.clientNom?.trim(),
          siteNom: form.siteNom?.trim(),
          numeroClient: form.numeroClient?.trim() || null,
        };
      } else {
        const cmdId = form.commandeId?.trim() ? Number(form.commandeId) : 0;
        body = {
          numeroFacture: form.numeroFacture?.trim(),
          dateFacture: form.dateFacture?.trim() || null,
          numeroCommande: form.numeroCommande?.trim(),
          clientNom: form.clientNom?.trim(),
          montantHt: parseMoney(form.montantHt ?? "0"),
          frais: parseMoney(form.frais ?? "0"),
          modeReglement: form.modeReglement?.trim() || "VIREMENT",
          commandeId: Number.isFinite(cmdId) && cmdId > 0 ? cmdId : undefined,
          statutFacturation: form.statutFacturation?.trim() || "CREEE",
        };
      }
      const payload = JSON.parse(JSON.stringify(body)) as Record<string, unknown>;
      for (const k of Object.keys(payload)) {
        if (payload[k] === undefined) delete payload[k];
      }
      await apiFetch(`${path}/${id}`, {
        token: readToken(),
        method: "PUT",
        body: JSON.stringify(payload),
      });
      onSaved();
      onClose();
    } catch (e) {
      setLocalErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  const title =
    path === "/api/offres" ? "Modifier l’offre" : path === "/api/commandes" ? "Modifier la commande" : "Modifier la facture";

  function missionCheckboxes(
    pick: Record<string, boolean>,
    setPick: (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => void,
    keyPrefix: string,
  ) {
    return (
      <div className="crm-checkbox-grid">
        {LVO_MISSION_TYPES.map((t) => (
          <label key={`${keyPrefix}-${t}`} className="crm-field-check">
            <input
              type="checkbox"
              checked={!!pick[t]}
              onChange={() => {
                setPick((prev) => {
                  const next = { ...prev, [t]: !prev[t] };
                  const any = LVO_MISSION_TYPES.some((x) => next[x]);
                  if (!any) return { ...prev, [t]: true };
                  return next;
                });
              }}
            />
            {t}
          </label>
        ))}
      </div>
    );
  }

  return (
    <CrmEntityModal
      open
      onClose={onClose}
      title={`${title} #${id}`}
      subtitle="Mettez à jour les champs puis enregistrez."
      titleId="crm-edit-title"
      size="xl"
      error={localErr}
      footer={
        <>
          <button type="button" className="cbtn cbtn-primary" disabled={busy} onClick={() => void save()}>
            Enregistrer
          </button>
          <button type="button" className="cbtn cbtn-ghost" disabled={busy} onClick={onClose}>
            Annuler
          </button>
        </>
      }
    >
      <div className="crm-form-grid crm-form-grid--tight">
          {path === "/api/offres" ? (
            <>
              {field("numeroOffre", "N° offre")}
              <div className="crm-field crm-span-2">
                <span className="crm-label">Types de mission (sélection multiple)</span>
                {missionCheckboxes(offreMissionPick, setOffreMissionPick, "edit-offre-m")}
              </div>
              <label className="crm-field">
                <span className="crm-label">Statut</span>
                <select className="crm-select" value={form.statut ?? "ENVOYEE"} onChange={(e) => setField("statut", e.target.value)}>
                  {CRM_OFFRE_STATUTS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                  {!CRM_OFFRE_STATUTS.some((o) => o.value === form.statut) && form.statut ? (
                    <option value={form.statut}>{form.statut} (valeur actuelle)</option>
                  ) : null}
                </select>
              </label>
              {field("montantHt", "Montant HT (€)", { type: "text", placeholder: "0" })}
              {field("dateOffre", "Date offre", { type: "date" })}
              {field("clientNom", "Client")}
              {field("siteNom", "Site")}
              {field("consultantEmail", "Consultant (email)")}
              <label className="crm-field crm-span-2">
                <span className="crm-label">Gestionnaire (syndic / prestataire / propriétaire)</span>
                <select
                  className="crm-select"
                  value={form.gestionnaireNom ?? ""}
                  disabled={!offreParties?.options.length}
                  onChange={(e) => {
                    const nom = e.target.value;
                    const opt = offreParties?.options.find((o) => o.clientNom === nom);
                    setField("gestionnaireNom", nom);
                    if (opt?.responsableContact) setField("gestionnaireContact", opt.responsableContact);
                  }}
                >
                  <option value="">—</option>
                  {(offreParties?.options ?? []).map((o) => (
                    <option key={o.clientNom} value={o.clientNom}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              {field("gestionnaireContact", "Contact gestionnaire (personne)")}
              {field("tauxTva", "TVA (%)", { type: "number" })}
              <label className="crm-field crm-span-2">
                <span className="crm-label">Mode phases</span>
                <select
                  className="crm-select"
                  value={form.phasesMode ?? "SELECTION"}
                  onChange={(e) => setField("phasesMode", e.target.value)}
                >
                  <option value="SELECTION">Sélection</option>
                  <option value="ALL">Tout le référentiel</option>
                  <option value="CUSTOM">Personnalisé</option>
                </select>
              </label>
              <label className="crm-field crm-span-2">
                <span className="crm-label">Missions (JSON)</span>
                <textarea
                  className="crm-textarea crm-textarea--mono min-h-24"
                  value={form.missionsJson ?? ""}
                  onChange={(e) => setField("missionsJson", e.target.value)}
                />
              </label>
              <label className="crm-field crm-span-2">
                <span className="crm-label">Échéancier facturation (JSON)</span>
                <textarea
                  className="crm-textarea crm-textarea--mono min-h-20"
                  value={form.echeancierFacturationJson ?? ""}
                  onChange={(e) => setField("echeancierFacturationJson", e.target.value)}
                />
              </label>
              <label className="crm-field crm-span-2">
                <span className="crm-label">Échéancier exécution (JSON)</span>
                <textarea
                  className="crm-textarea crm-textarea--mono min-h-20"
                  value={form.echeancierExecutionJson ?? ""}
                  onChange={(e) => setField("echeancierExecutionJson", e.target.value)}
                />
              </label>
            </>
          ) : null}

          {path === "/api/commandes" ? (
            <>
              {field("numeroCommande", "N° commande")}
              {field("dateCommande", "Date commande", { type: "date" })}
              <div className="crm-field crm-span-2">
                <span className="crm-label">Types de mission</span>
                {missionCheckboxes(cmdMissionPick, setCmdMissionPick, "edit-cmd-m")}
              </div>
              <label className="crm-field">
                <span className="crm-label">Statut commande</span>
                <select className="crm-select" value={form.statut ?? "EN_ATTENTE"} onChange={(e) => setField("statut", e.target.value)}>
                  {CRM_COMMANDE_STATUTS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                  {!CRM_COMMANDE_STATUTS.some((o) => o.value === form.statut) && form.statut ? (
                    <option value={form.statut}>{form.statut} (valeur actuelle)</option>
                  ) : null}
                </select>
              </label>
              {field("montantHt", "Montant HT (€)")}
              {field("montantFacture", "Montant déjà facturé (€)")}
              {field("clientNom", "Client")}
              {field("siteNom", "Site")}
              {field("numeroClient", "N° commande client")}
            </>
          ) : null}

          {path === "/api/factures" ? (
            <>
              {field("numeroFacture", "N° facture")}
              {field("dateFacture", "Date facture", { type: "date" })}
              {field("numeroCommande", "N° commande")}
              {field("commandeId", "ID commande", { type: "number" })}
              {field("clientNom", "Client")}
              {field("montantHt", "Montant HT (€)")}
              {field("frais", "Frais (€)")}
              {field("modeReglement", "Mode règlement")}
              <label className="crm-field crm-span-2">
                <span className="crm-label">Statut métier</span>
                <select
                  className="crm-select"
                  value={form.statutFacturation ?? "CREEE"}
                  onChange={(e) => setField("statutFacturation", e.target.value)}
                >
                  <option value="CREEE">Créée</option>
                  <option value="ENVOYEE">Envoyée</option>
                  <option value="ANNULEE">Annulée</option>
                  <option value="PAYEE">Payée</option>
                </select>
              </label>
            </>
          ) : null}
        </div>
    </CrmEntityModal>
  );
}
