"use client";

import { useEffect, useMemo, useState } from "react";

import { CrmEntityModal } from "@/components/crm/ui/CrmEntityModal";
import { OffreDocumentEditorModal } from "@/components/crm/OffreDocumentEditorModal";
import { apiFetch, apiFetchBlob } from "@/lib/api";
import { CRM_COMMANDE_STATUTS, CRM_OFFRE_STATUTS } from "@/lib/crm-workflow";
import { LVO_MISSION_TYPES, primaryMissionFromSelection } from "@/lib/reference-lvo";
import { readToken } from "@/lib/token-storage";
import { calcShapeOf, emptyMissionCalc, missionCalcShapeFor, validateMissionCalc } from "@/lib/mission-calc";
import type { EcheancePaiementRow, MissionCalc } from "@/lib/types";
import { MissionCalcFields } from "@/components/crm/forms/MissionCalcFields";

/** Types de mission outillés par le calcul auto (Audit/MM/MOE/MS) — cf. lib/mission-calc.ts. */
const MISSION_CALC_TYPES = new Set(["A", "CTQ", "MM", "MOE", "MS"]);

type OffreDocumentVersion = {
  version: number;
  reference: string;
  format: string;
  docType: string;
  createdAt: string;
  storage: string;
};

type EcheancierDraftRow = { id?: number; libelle: string; pourcentage: string; montantHt: string; dateEcheance: string };

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
  const [offreMissionCalc, setOffreMissionCalc] = useState<MissionCalc | null>(null);
  const [offreNbAscenseursSuggestion, setOffreNbAscenseursSuggestion] = useState<number | null>(null);
  const [offreParties, setOffreParties] = useState<{
    options: { clientNom: string; label: string; responsableContact: string | null }[];
  } | null>(null);
  const [cmdOffreNumero, setCmdOffreNumero] = useState<string | null>(null);
  const [echeancier, setEcheancier] = useState<EcheancePaiementRow[] | null>(null);
  const [echeancierDraft, setEcheancierDraft] = useState<EcheancierDraftRow[]>([]);
  const [echeancierBusy, setEcheancierBusy] = useState<string | null>(null);
  const [echeancierErr, setEcheancierErr] = useState<string | null>(null);
  const [echeancierWarning, setEcheancierWarning] = useState<string | null>(null);
  const [lockedEcheanceEdits, setLockedEcheanceEdits] = useState<Record<number, EcheancierDraftRow>>({});
  const [docHistory, setDocHistory] = useState<OffreDocumentVersion[]>([]);
  const [docBusy, setDocBusy] = useState<string | null>(null);
  const [docErr, setDocErr] = useState<string | null>(null);
  const [editingVersion, setEditingVersion] = useState<number | null>(null);

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

      const primaryTm = primaryMissionFromSelection(offreCodes);
      if (MISSION_CALC_TYPES.has(primaryTm)) {
        const rawCalc = txt(row, "missionCalcJson");
        let parsed: MissionCalc | null = null;
        if (rawCalc.trim()) {
          try {
            parsed = JSON.parse(rawCalc) as MissionCalc;
          } catch {
            parsed = null;
          }
        }
        setOffreMissionCalc(parsed ?? emptyMissionCalc(primaryTm));
      } else {
        setOffreMissionCalc(null);
      }
    } else if (path === "/api/commandes") {
      setForm({
        numeroCommande: txt(row, "numeroCommande"),
        dateCommande: txt(row, "dateCommande"),
        typeMission: txt(row, "typeMission"),
        statut: txt(row, "statut") || "EN_COURS",
        montantHt: String(row.montantHt ?? ""),
        montantFacture: String(row.montantFacture ?? ""),
        clientNom: txt(row, "clientNom"),
        siteNom: txt(row, "siteNom"),
        numeroClient: txt(row, "numeroClient"),
        gestionnaireNom: txt(row, "gestionnaireNom"),
        gestionnaireContact: txt(row, "gestionnaireContact"),
      });
      const codes = parseCmdMissionCodesFromRow(row);
      const pick: Record<string, boolean> = {};
      for (const t of LVO_MISSION_TYPES) pick[t] = codes.includes(t);
      setCmdMissionPick(pick);

      const offreId = row.offreId != null ? Number(row.offreId) : null;
      if (offreId && Number.isFinite(offreId)) {
        void (async () => {
          try {
            const list = (await apiFetch("/api/offres", { token: readToken() })) as { id: number; numeroOffre: string }[] | null;
            const match = Array.isArray(list) ? list.find((o) => o.id === offreId) : undefined;
            setCmdOffreNumero(match?.numeroOffre ?? null);
          } catch {
            setCmdOffreNumero(null);
          }
        })();
      } else {
        setCmdOffreNumero(null);
      }
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
      setOffreNbAscenseursSuggestion(null);
      return;
    }
    const siteNom = txt(row, "siteNom").trim();
    if (!siteNom) {
      setOffreParties(null);
      setOffreNbAscenseursSuggestion(null);
      return;
    }
    const token = readToken();
    let cancel = false;
    void (async () => {
      try {
        const siteList = (await apiFetch("/api/sites", { token })) as
          | { id: number; nom: string; equipementsCount?: number }[]
          | null;
        const site = Array.isArray(siteList) ? siteList.find((s) => s.nom === siteNom) : undefined;
        if (!cancel) setOffreNbAscenseursSuggestion(site?.equipementsCount ?? null);
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

  async function loadDocHistory(numeroOffre: string) {
    try {
      const list = (await apiFetch(
        `/api/documents/versions?reference=${encodeURIComponent(numeroOffre)}&docType=OFFRE`,
        { token: readToken() },
      )) as OffreDocumentVersion[] | null;
      setDocHistory(Array.isArray(list) ? list : []);
    } catch {
      setDocHistory([]);
    }
  }

  useEffect(() => {
    if (path !== "/api/offres" || !row) {
      setDocHistory([]);
      return;
    }
    const numeroOffre = txt(row, "numeroOffre").trim();
    if (!numeroOffre) {
      setDocHistory([]);
      return;
    }
    void loadDocHistory(numeroOffre);
  }, [path, row]);

  async function loadEcheancier(commandeId: number) {
    try {
      const list = (await apiFetch(`/api/commandes/${commandeId}/echeances`, { token: readToken() })) as EcheancePaiementRow[] | null;
      const rows = Array.isArray(list) ? list : [];
      setEcheancier(rows);
      // Seules les échéances encore modifiables (ni facturées ni payées) vivent dans le brouillon —
      // les lignes verrouillées ont leur propre brouillon (`lockedEcheanceEdits`), éditées/supprimées
      // une par une via PATCH/DELETE plutôt que par le PUT groupé (qui ne touche jamais aux lignes verrouillées).
      setEcheancierDraft(
        rows
          .filter((e) => e.statut !== "FACTUREE" && e.statut !== "PAYEE")
          .map((e) => ({
            id: e.id,
            libelle: e.libelle,
            pourcentage: e.pourcentage != null ? String(e.pourcentage) : "",
            montantHt: String(e.montantHt),
            dateEcheance: e.dateEcheance,
          })),
      );
      setLockedEcheanceEdits(
        Object.fromEntries(
          rows
            .filter((e) => e.statut === "FACTUREE" || e.statut === "PAYEE")
            .map((e) => [e.id, { id: e.id, libelle: e.libelle, pourcentage: "", montantHt: String(e.montantHt), dateEcheance: e.dateEcheance }]),
        ),
      );
    } catch {
      setEcheancier([]);
      setEcheancierDraft([]);
      setLockedEcheanceEdits({});
    }
  }

  useEffect(() => {
    if (path !== "/api/commandes" || !row) {
      setEcheancier(null);
      setEcheancierDraft([]);
      setLockedEcheanceEdits({});
      return;
    }
    const commandeId = Number(row.id);
    if (!Number.isFinite(commandeId)) return;
    void loadEcheancier(commandeId);
  }, [path, row]);

  const offrePrimaryMissionEdit = primaryMissionFromSelection(LVO_MISSION_TYPES.filter((t) => offreMissionPick[t]));

  // Valeur de calcul honoraires réellement utilisable pour le type de mission COURANT. `offreMissionCalc`
  // (state, chargé depuis `row` ou modifié via les cases à cocher) peut rester, le temps d'un rendu,
  // à la forme de l'ancien type juste après un changement de sélection — recalculer ici plutôt que via
  // un effet évite le rendu intermédiaire avec une forme d'objet incohérente (ex. lire `.phases` sur
  // un objet MS) qui provoquait un crash React ("uncontrolled input" / TypeError).
  const offreMissionCalcEffective = useMemo(() => {
    if (path !== "/api/offres" || !MISSION_CALC_TYPES.has(offrePrimaryMissionEdit)) return null;
    if (offreMissionCalc && calcShapeOf(offreMissionCalc) === missionCalcShapeFor(offrePrimaryMissionEdit)) return offreMissionCalc;
    return emptyMissionCalc(offrePrimaryMissionEdit, offreNbAscenseursSuggestion);
  }, [path, offrePrimaryMissionEdit, offreMissionCalc, offreNbAscenseursSuggestion]);

  if (!row) return null;

  const id = Number(row.id);
  if (!Number.isFinite(id)) return null;
  const numeroOffreActuel = txt(row, "numeroOffre").trim();

  async function downloadDoc(version: number, format: string) {
    try {
      const blob = await apiFetchBlob(`/api/offres/${id}/documents/${version}/download?format=${format}`, { token: readToken() });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `${numeroOffreActuel || "offre"}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (e) {
      setDocErr(e instanceof Error ? e.message : "Erreur de téléchargement");
    }
  }

  async function generateDocx() {
    setDocErr(null);
    setDocBusy("generate");
    try {
      await apiFetch(`/api/offres/${id}/documents`, { token: readToken(), method: "POST" });
      await loadDocHistory(numeroOffreActuel);
    } catch (e) {
      setDocErr(e instanceof Error ? e.message : "Échec de la génération du document");
    } finally {
      setDocBusy(null);
    }
  }

  async function convertirPdf(version: number) {
    setDocErr(null);
    setDocBusy(`valider-${version}`);
    try {
      await apiFetch(`/api/offres/${id}/documents/${version}/valider`, { token: readToken(), method: "POST" });
      await loadDocHistory(numeroOffreActuel);
    } catch (e) {
      setDocErr(e instanceof Error ? e.message : "Conversion PDF indisponible");
    } finally {
      setDocBusy(null);
    }
  }

  function updateEcheancierDraft(i: number, patch: Partial<EcheancierDraftRow>) {
    setEcheancierDraft((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function ajouterEcheancierDraftRow() {
    setEcheancierDraft((prev) => [
      ...prev,
      { libelle: `Échéance ${prev.length + 1}`, pourcentage: "", montantHt: "", dateEcheance: "" },
    ]);
  }

  function supprimerEcheancierDraftRow(i: number) {
    setEcheancierDraft((prev) => prev.filter((_, idx) => idx !== i));
  }

  function paiementComptant() {
    setEcheancierDraft([
      { libelle: "Paiement comptant", pourcentage: "", montantHt: form.montantHt ?? "", dateEcheance: new Date().toISOString().slice(0, 10) },
    ]);
  }

  async function sauvegarderEcheancier() {
    setEcheancierErr(null);
    setEcheancierWarning(null);
    setEcheancierBusy("save");
    try {
      const result = (await apiFetch(`/api/commandes/${id}/echeances`, {
        token: readToken(),
        method: "PUT",
        body: JSON.stringify({
          echeances: echeancierDraft.map((r) => ({
            libelle: r.libelle,
            pourcentage: r.pourcentage.trim() ? Number(r.pourcentage) : null,
            montantHt: Number(r.montantHt) || 0,
            dateEcheance: r.dateEcheance,
          })),
        }),
      })) as { rows: EcheancePaiementRow[]; warning?: string } | null;
      if (result?.warning) setEcheancierWarning(result.warning);
      await loadEcheancier(id);
    } catch (e) {
      setEcheancierErr(e instanceof Error ? e.message : "Échec de l'enregistrement de l'échéancier");
    } finally {
      setEcheancierBusy(null);
    }
  }

  async function marquerFacturee(echeanceId: number) {
    setEcheancierErr(null);
    setEcheancierBusy(`facturer-${echeanceId}`);
    try {
      await apiFetch(`/api/echeances/${echeanceId}/marquer-facturee`, { token: readToken(), method: "POST" });
      await loadEcheancier(id);
    } catch (e) {
      setEcheancierErr(e instanceof Error ? e.message : "Échec de la facturation");
    } finally {
      setEcheancierBusy(null);
    }
  }

  function updateLockedEcheanceEdit(echeanceId: number, patch: Partial<EcheancierDraftRow>) {
    setLockedEcheanceEdits((prev) => ({ ...prev, [echeanceId]: { ...prev[echeanceId], ...patch } }));
  }

  async function enregistrerEcheanceVerrouillee(echeanceId: number) {
    const edit = lockedEcheanceEdits[echeanceId];
    if (!edit) return;
    setEcheancierErr(null);
    setEcheancierWarning(null);
    setEcheancierBusy(`patch-${echeanceId}`);
    try {
      const result = (await apiFetch(`/api/echeances/${echeanceId}`, {
        token: readToken(),
        method: "PATCH",
        body: JSON.stringify({
          libelle: edit.libelle,
          montantHt: Number(edit.montantHt) || 0,
          dateEcheance: edit.dateEcheance,
        }),
      })) as { warning?: string } | null;
      if (result?.warning) setEcheancierWarning(result.warning);
      await loadEcheancier(id);
    } catch (e) {
      setEcheancierErr(e instanceof Error ? e.message : "Échec de la modification de l'échéance");
    } finally {
      setEcheancierBusy(null);
    }
  }

  async function supprimerEcheance(echeanceId: number) {
    setEcheancierErr(null);
    setEcheancierWarning(null);
    setEcheancierBusy(`delete-${echeanceId}`);
    try {
      const result = (await apiFetch(`/api/echeances/${echeanceId}`, { token: readToken(), method: "DELETE" })) as { warning?: string } | null;
      if (result?.warning) setEcheancierWarning(result.warning);
      await loadEcheancier(id);
    } catch (e) {
      setEcheancierErr(e instanceof Error ? e.message : "Échec de la suppression de l'échéance");
    } finally {
      setEcheancierBusy(null);
    }
  }

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

  function readOnlyField(key: string, label: string, opts?: { fallback?: string }) {
    return (
      <label className="crm-field">
        <span className="crm-label">{label}</span>
        <input className="crm-input" readOnly value={form[key]?.trim() ? form[key] : opts?.fallback ?? "—"} />
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
        if (MISSION_CALC_TYPES.has(primaryOffre)) {
          if (!offreMissionCalcEffective) {
            setLocalErr("Complétez les informations de la mission.");
            return;
          }
          const calcErr = validateMissionCalc(primaryOffre, offreMissionCalcEffective, form.dateOffre);
          if (calcErr) {
            setLocalErr(calcErr);
            return;
          }
        }
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
          missionCalc: MISSION_CALC_TYPES.has(primaryOffre) ? offreMissionCalcEffective : undefined,
        };
      } else if (path === "/api/commandes") {
        // La commande est figée à la création (référence, date, client, site, mission,
        // montant HT) : seuls statut, n° commande client et montant facturé sont envoyés —
        // cohérent avec l'allowlist serveur de PUT /commandes/:id. Le paiement échelonné se
        // gère désormais via la section « Échéancier de paiement » (EcheancePaiement), plus ici.
        body = {
          statut: form.statut?.trim() || "EN_COURS",
          numeroClient: form.numeroClient?.trim() || null,
          montantFacture: parseMoney(form.montantFacture ?? "0"),
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
    <>
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
          <button type="button" className="cbtn-icon cbtn-icon--ghost" title="Annuler" aria-label="Annuler" disabled={busy} onClick={onClose}>
            ✕
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {path === "/api/offres" ? (
            <>
              <div className="crm-stack">
                <p className="crm-stack-title">
                  <span className="crm-stack-title__icon" aria-hidden>▤</span> Référence &amp; statut
                </p>
                <div className="crm-form-grid crm-form-grid--tight">
                  {field("numeroOffre", "N° offre")}
                  {field("dateOffre", "Date offre", { type: "date" })}
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
                  {!MISSION_CALC_TYPES.has(offrePrimaryMissionEdit)
                    ? field("montantHt", "Montant HT (€)", { type: "text", placeholder: "0" })
                    : null}
                </div>
              </div>
              {MISSION_CALC_TYPES.has(offrePrimaryMissionEdit) && offreMissionCalcEffective ? (
                <MissionCalcFields
                  key={offrePrimaryMissionEdit}
                  typeMission={offrePrimaryMissionEdit}
                  value={offreMissionCalcEffective}
                  onChange={setOffreMissionCalc}
                  dateOffreIso={form.dateOffre}
                  nbAscenseursSuggestion={offreNbAscenseursSuggestion}
                />
              ) : null}
              <div className="crm-stack">
                <p className="crm-stack-title">
                  <span className="crm-stack-title__icon" aria-hidden>◎</span> Client, site &amp; gestionnaire
                </p>
                <div className="crm-form-grid crm-form-grid--tight">
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
                </div>
              </div>
              <div className="crm-stack">
                <p className="crm-stack-title">
                  <span className="crm-stack-title__icon" aria-hidden>✓</span> Mission
                </p>
                <div className="crm-field">
                  {missionCheckboxes(offreMissionPick, setOffreMissionPick, "edit-offre-m")}
                </div>
              </div>
              <div className="crm-stack">
                <p className="crm-stack-title">
                  <span className="crm-stack-title__icon" aria-hidden>⎘</span> Document (Word / PDF)
                </p>
                {docErr ? <p className="crm-alert crm-alert--error mb-2">{docErr}</p> : null}
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <button type="button" className="cbtn cbtn-orange" disabled={docBusy !== null} onClick={() => void generateDocx()}>
                    {docBusy === "generate" ? "Génération…" : "Générer l’offre (Word)"}
                  </button>
                </div>
                {docHistory.length ? (
                  <table className="ct">
                    <thead>
                      <tr>
                        <th>Version</th>
                        <th>Format</th>
                        <th>Date</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {docHistory.map((v) => (
                        <tr key={`${v.version}-${v.format}`}>
                          <td>{v.version}</td>
                          <td>{v.format.toUpperCase()}</td>
                          <td>{new Date(v.createdAt).toLocaleString("fr-FR")}</td>
                          <td style={{ display: "flex", gap: 6 }}>
                            <button type="button" className="cbtn cbtn-ghost cbtn-sm" onClick={() => void downloadDoc(v.version, v.format)}>
                              Télécharger
                            </button>
                            {v.format === "docx" ? (
                              <button type="button" className="cbtn cbtn-ghost cbtn-sm" onClick={() => setEditingVersion(v.version)}>
                                Modifier dans Word (navigateur)
                              </button>
                            ) : null}
                            {v.format === "docx" && !docHistory.some((x) => x.version === v.version && x.format === "pdf") ? (
                              <button
                                type="button"
                                className="cbtn cbtn-ghost cbtn-sm"
                                disabled={docBusy !== null}
                                onClick={() => void convertirPdf(v.version)}
                              >
                                {docBusy === `valider-${v.version}` ? "Conversion…" : "Convertir en PDF"}
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="crm-hint">Aucun document généré pour cette offre.</p>
                )}
              </div>
            </>
          ) : null}

          {path === "/api/commandes" ? (
            <>
              <p className="crm-hint">
                Une commande est figée une fois créée (comme un bon de commande) — seuls le
                statut, le n° commande client et le paiement restent modifiables.
              </p>
              <div className="crm-stack">
                <p className="crm-stack-title">
                  <span className="crm-stack-title__icon" aria-hidden>▦</span> Référence &amp; statut
                </p>
                <div className="crm-form-grid crm-form-grid--tight">
                  {readOnlyField("numeroCommande", "N° commande")}
                  {readOnlyField("dateCommande", "Date commande")}
                  <label className="crm-field">
                    <span className="crm-label">Statut commande</span>
                    <select className="crm-select" value={form.statut ?? "EN_COURS"} onChange={(e) => setField("statut", e.target.value)}>
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
                  {field("numeroClient", "N° commande client")}
                </div>
              </div>
              <div className="crm-stack">
                <p className="crm-stack-title">
                  <span className="crm-stack-title__icon" aria-hidden>◎</span> Offre, client, site &amp; gestionnaire
                </p>
                <div className="crm-form-grid crm-form-grid--tight">
                  {readOnlyField("offreNumero", "Offre liée", { fallback: cmdOffreNumero ?? "—" })}
                  {readOnlyField("clientNom", "Client")}
                  {readOnlyField("siteNom", "Site")}
                  {readOnlyField("gestionnaireNom", "Gestionnaire")}
                  {readOnlyField("gestionnaireContact", "Contact gestionnaire")}
                </div>
              </div>
              <div className="crm-stack">
                <p className="crm-stack-title">
                  <span className="crm-stack-title__icon" aria-hidden>✓</span> Mission &amp; montant
                </p>
                <div className="crm-form-grid crm-form-grid--tight">
                  <label className="crm-field crm-span-2">
                    <span className="crm-label">Types de mission</span>
                    <input
                      className="crm-input"
                      readOnly
                      value={Object.entries(cmdMissionPick).filter(([, v]) => v).map(([k]) => k).join(", ") || "—"}
                    />
                  </label>
                  {readOnlyField("montantHt", "Montant HT (€)")}
                  {field("montantFacture", "Montant déjà facturé (€)")}
                </div>
              </div>
              <div className="crm-stack">
                <p className="crm-stack-title">
                  <span className="crm-stack-title__icon" aria-hidden>📅</span> Échéancier de paiement
                </p>
                {echeancierErr ? <p className="crm-alert crm-alert--error mb-2">{echeancierErr}</p> : null}
                {echeancierWarning ? <p className="crm-alert crm-alert--warn mb-2">{echeancierWarning}</p> : null}
                {echeancier == null ? (
                  <p className="crm-hint">Chargement…</p>
                ) : (
                  <>
                    {(() => {
                      const verrouillees = echeancier.filter((e) => e.statut === "FACTUREE" || e.statut === "PAYEE");
                      if (!verrouillees.length) return null;
                      return (
                        <table className="ct mb-3">
                          <thead>
                            <tr>
                              <th>Libellé</th>
                              <th>Montant HT</th>
                              <th>Échéance</th>
                              <th>Statut</th>
                              <th>Facture</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {verrouillees.map((e) => {
                              const edit = lockedEcheanceEdits[e.id] ?? {
                                id: e.id,
                                libelle: e.libelle,
                                pourcentage: "",
                                montantHt: String(e.montantHt),
                                dateEcheance: e.dateEcheance,
                              };
                              return (
                                <tr key={e.id}>
                                  <td>
                                    <input
                                      className="crm-input"
                                      value={edit.libelle}
                                      onChange={(ev) => updateLockedEcheanceEdit(e.id, { libelle: ev.target.value })}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      className="crm-input"
                                      inputMode="decimal"
                                      style={{ width: 100 }}
                                      value={edit.montantHt}
                                      onChange={(ev) => updateLockedEcheanceEdit(e.id, { montantHt: ev.target.value })}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      className="crm-input"
                                      type="date"
                                      value={edit.dateEcheance}
                                      onChange={(ev) => updateLockedEcheanceEdit(e.id, { dateEcheance: ev.target.value })}
                                    />
                                  </td>
                                  <td>{e.statut}</td>
                                  <td>{e.factureId ? `#${e.factureId}` : "—"}</td>
                                  <td style={{ display: "flex", gap: 4 }}>
                                    <button
                                      type="button"
                                      className="cbtn cbtn-ghost cbtn-sm"
                                      disabled={echeancierBusy !== null}
                                      onClick={() => void enregistrerEcheanceVerrouillee(e.id)}
                                    >
                                      {echeancierBusy === `patch-${e.id}` ? "…" : "Enregistrer"}
                                    </button>
                                    <button
                                      type="button"
                                      className="cbtn cbtn-ghost cbtn-sm"
                                      disabled={echeancierBusy !== null}
                                      onClick={() => void supprimerEcheance(e.id)}
                                    >
                                      {echeancierBusy === `delete-${e.id}` ? "…" : "Supprimer"}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      );
                    })()}
                    <table className="ct">
                      <thead>
                        <tr>
                          <th>Libellé</th>
                          <th>Montant HT</th>
                          <th>Échéance</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {echeancierDraft.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="crm-hint">Aucune échéance.</td>
                          </tr>
                        ) : (
                          echeancierDraft.map((d, i) => (
                            <tr key={d.id ?? `new-${i}`}>
                              <td>
                                <input
                                  className="crm-input"
                                  value={d.libelle}
                                  onChange={(ev) => updateEcheancierDraft(i, { libelle: ev.target.value })}
                                />
                              </td>
                              <td>
                                <input
                                  className="crm-input"
                                  inputMode="decimal"
                                  style={{ width: 100 }}
                                  value={d.montantHt}
                                  onChange={(ev) => updateEcheancierDraft(i, { montantHt: ev.target.value })}
                                />
                              </td>
                              <td>
                                <input
                                  className="crm-input"
                                  type="date"
                                  value={d.dateEcheance}
                                  onChange={(ev) => updateEcheancierDraft(i, { dateEcheance: ev.target.value })}
                                />
                              </td>
                              <td style={{ display: "flex", gap: 4 }}>
                                {d.id != null ? (
                                  <button
                                    type="button"
                                    className="cbtn cbtn-ghost cbtn-sm"
                                    disabled={echeancierBusy !== null}
                                    onClick={() => void marquerFacturee(d.id!)}
                                  >
                                    {echeancierBusy === `facturer-${d.id}` ? "…" : "Marquer facturée"}
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="cbtn cbtn-ghost cbtn-sm"
                                  disabled={echeancierBusy !== null}
                                  onClick={() => supprimerEcheancierDraftRow(i)}
                                >
                                  Supprimer
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                      <button type="button" className="cbtn cbtn-ghost cbtn-sm" onClick={ajouterEcheancierDraftRow}>
                        + Ajouter une échéance
                      </button>
                      <button type="button" className="cbtn cbtn-ghost cbtn-sm" onClick={paiementComptant}>
                        Paiement comptant (1 versement)
                      </button>
                      <button
                        type="button"
                        className="cbtn cbtn-orange cbtn-sm"
                        disabled={echeancierBusy !== null}
                        onClick={() => void sauvegarderEcheancier()}
                      >
                        {echeancierBusy === "save" ? "Enregistrement…" : "Enregistrer l'échéancier"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : null}

          {path === "/api/factures" ? (
            <div className="crm-form-grid crm-form-grid--tight">
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
            </div>
          ) : null}
        </div>
    </CrmEntityModal>
    {editingVersion != null ? (
      <OffreDocumentEditorModal
        offreId={id}
        version={editingVersion}
        onClose={() => {
          setEditingVersion(null);
          void loadDocHistory(numeroOffreActuel);
        }}
      />
    ) : null}
    </>
  );
}
