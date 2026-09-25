"use client";

import { Editor } from "primereact/editor";
import { useEffect, useState } from "react";

import {
  computeMissionCalcTotal,
  computeMmDetail,
  DEFAULT_MOE_POURCENTAGE,
  MOE_PHASE_LABELS,
  MOE_PHASE_ORDER,
  moePhaseMontant,
  moneyFr,
} from "@/lib/mission-calc";
import type {
  AuditMissionCalc,
  MissionCalc,
  MmMissionCalc,
  MoeMissionCalc,
  MoePhaseCalc,
  MoePhaseCode,
  MsMissionCalc,
} from "@/lib/types";

type Props = Readonly<{
  typeMission: string;
  value: MissionCalc;
  onChange: (v: MissionCalc) => void;
  dateOffreIso?: string | null;
  /** Nombre d'ascenseurs actifs du site sélectionné (equipementsCount) — pré-remplit
   * `nbAscenseurs` (Audit/MM) tant que l'utilisateur ne l'a pas modifié à la main. */
  nbAscenseursSuggestion?: number | null;
}>;

/** Saisie conditionnelle du calcul honoraires/échéancier pour les 5 types de mission outillés
 * (Audit/CTQ/MM/MOE/MS) — miroir du calcul serveur, cf. lib/mission-calc.ts. Le total affiché est
 * indicatif : le serveur reste seul juge à la sauvegarde. */
export function MissionCalcFields({ typeMission, value, onChange, dateOffreIso, nbAscenseursSuggestion }: Props) {
  const tm = typeMission.toUpperCase();
  const [nbTouched, setNbTouched] = useState(false);

  useEffect(() => {
    if (nbTouched) return;
    if (!nbAscenseursSuggestion || nbAscenseursSuggestion <= 0) return;
    if (tm !== "A" && tm !== "CTQ" && tm !== "MM") return;
    const c = value as AuditMissionCalc | MmMissionCalc;
    if (c.nbAscenseurs !== nbAscenseursSuggestion) onChange({ ...c, nbAscenseurs: nbAscenseursSuggestion });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nbAscenseursSuggestion, tm, nbTouched]);

  if (tm === "A" || tm === "CTQ") {
    const c = value as AuditMissionCalc;
    const total = computeMissionCalcTotal(tm, c);
    return (
      <div className="crm-stack crm-span-2">
        <p className="crm-stack-title">
          <span className="crm-stack-title__icon" aria-hidden>€</span> {tm === "CTQ" ? "CTQ" : "Audit"} — honoraires
        </p>
        <div className="crm-form-grid crm-form-grid--tight">
          <label className="crm-field">
            <span className="crm-label">Nombre d&apos;ascenseurs</span>
            <input
              className="crm-input"
              type="number"
              min={0}
              step={1}
              value={c.nbAscenseurs}
              onChange={(e) => {
                setNbTouched(true);
                onChange({ ...c, nbAscenseurs: Math.max(0, Math.trunc(Number(e.target.value)) || 0) });
              }}
            />
          </label>
          <label className="crm-field">
            <span className="crm-label">Prix unitaire HT / ascenseur (€)</span>
            <input
              className="crm-input"
              type="number"
              min={0}
              step="0.01"
              value={c.prixUnitaireHt}
              onChange={(e) => onChange({ ...c, prixUnitaireHt: Number(e.target.value) || 0 })}
            />
          </label>
        </div>
        <p className="crm-hint mt-1">
          Total HT : <strong>{moneyFr(total)}</strong> — échéancier : 100 % à l&apos;envoi du rapport.
        </p>
      </div>
    );
  }

  if (tm === "MM") {
    const c = value as MmMissionCalc;
    const detail = computeMmDetail(c, dateOffreIso);
    return (
      <div className="crm-stack crm-span-2">
        <p className="crm-stack-title">
          <span className="crm-stack-title__icon" aria-hidden>€</span> Maintenance Management — honoraires
        </p>
        <div className="crm-form-grid crm-form-grid--tight">
          <label className="crm-field">
            <span className="crm-label">Nombre d&apos;ascenseurs</span>
            <input
              className="crm-input"
              type="number"
              min={0}
              step={1}
              value={c.nbAscenseurs}
              onChange={(e) => {
                setNbTouched(true);
                onChange({ ...c, nbAscenseurs: Math.max(0, Math.trunc(Number(e.target.value)) || 0) });
              }}
            />
          </label>
          <label className="crm-field">
            <span className="crm-label">Prix unitaire HT / mois / ascenseur (€)</span>
            <input
              className="crm-input"
              type="number"
              min={0}
              step="0.01"
              value={c.prixUnitaireMoisHt}
              onChange={(e) => onChange({ ...c, prixUnitaireMoisHt: Number(e.target.value) || 0 })}
            />
          </label>
        </div>
        <p className="crm-hint mt-1">
          Total / an : <strong>{moneyFr(detail.totalAn)}</strong> — Pour l&apos;exercice {detail.annee} :{" "}
          <strong>{moneyFr(detail.exerciceMontant)}</strong> — échéancier : 50 % à l&apos;envoi du rapport 1er
          semestre / 50 % à l&apos;envoi du rapport 2e semestre.
        </p>
      </div>
    );
  }

  if (tm === "MOE") {
    const c = value as MoeMissionCalc;
    const total = computeMissionCalcTotal(tm, c);
    const updatePhase = (code: MoePhaseCode, patch: Partial<MoePhaseCalc>) =>
      onChange({ phases: c.phases.map((p) => (p.code === code ? { ...p, ...patch } : p)) });
    return (
      <div className="crm-stack crm-span-2">
        <p className="crm-stack-title">
          <span className="crm-stack-title__icon" aria-hidden>€</span> MOE — phases &amp; honoraires
        </p>
        <p className="crm-hint" style={{ marginBottom: 10 }}>
          Cochez une ou plusieurs phases — seules les phases cochées apparaissent dans le document généré.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {MOE_PHASE_ORDER.map((code) => {
            const phase = c.phases.find((p) => p.code === code);
            if (!phase) return null;
            // Le choix du mode de calcul (prix / % du montant des travaux) ne s'applique qu'à la
            // phase DET — les 3 autres phases gardent l'ancienne logique (montant libre).
            const allowCalcMode = code === "DET";
            const effectiveCalcMode = allowCalcMode ? phase.calcMode : "LIBRE";
            return (
              <div key={code} style={{ border: "1px solid #e2e2e2", borderRadius: 8, padding: 10 }}>
                <label className="crm-field-check">
                  <input
                    type="checkbox"
                    checked={phase.selected}
                    onChange={(e) => updatePhase(code, { selected: e.target.checked })}
                  />
                  {MOE_PHASE_LABELS[code]}
                </label>
                {phase.selected ? (
                  <div className="crm-form-grid crm-form-grid--tight" style={{ marginTop: 8 }}>
                    {allowCalcMode ? (
                      <label className="crm-field crm-span-2">
                        <span className="crm-label">Mode de calcul du montant</span>
                        <select
                          className="crm-select"
                          value={phase.calcMode}
                          onChange={(e) => {
                            const calcMode = e.target.value as MoePhaseCalc["calcMode"];
                            updatePhase(
                              code,
                              calcMode === "POURCENTAGE"
                                ? {
                                    calcMode,
                                    montantTravauxHt: phase.montantTravauxHt ?? 0,
                                    pourcentage: phase.pourcentage || DEFAULT_MOE_POURCENTAGE,
                                  }
                                : { calcMode },
                            );
                          }}
                        >
                          <option value="LIBRE">Prix</option>
                          <option value="POURCENTAGE">% du montant des travaux</option>
                          {/* Mode historique : visible uniquement sur les offres déjà enregistrées ainsi. */}
                          {phase.calcMode === "UNITAIRE" ? (
                            <option value="UNITAIRE">Prix unitaire × nb ascenseurs</option>
                          ) : null}
                        </select>
                      </label>
                    ) : null}
                    {effectiveCalcMode === "LIBRE" ? (
                      <label className="crm-field">
                        <span className="crm-label">Montant HT (€)</span>
                        <input
                          className="crm-input"
                          type="number"
                          min={0}
                          step="0.01"
                          value={phase.montantHt}
                          onChange={(e) =>
                            updatePhase(code, {
                              montantHt: Number(e.target.value) || 0,
                              ...(allowCalcMode ? null : { calcMode: "LIBRE" }),
                            })
                          }
                        />
                      </label>
                    ) : effectiveCalcMode === "POURCENTAGE" ? (
                      <>
                        <label className="crm-field">
                          <span className="crm-label">Montant des travaux HT (€)</span>
                          <input
                            className="crm-input"
                            type="number"
                            min={0}
                            step="0.01"
                            value={phase.montantTravauxHt ?? ""}
                            onChange={(e) => updatePhase(code, { montantTravauxHt: Number(e.target.value) || 0 })}
                          />
                        </label>
                        <label className="crm-field">
                          <span className="crm-label">Pourcentage (%)</span>
                          <input
                            className="crm-input"
                            type="number"
                            min={0}
                            step="0.1"
                            value={phase.pourcentage}
                            onChange={(e) => updatePhase(code, { pourcentage: Number(e.target.value) || 0 })}
                          />
                        </label>
                        <p className="crm-hint crm-span-2 m-0">
                          Montant calculé : <strong>{moneyFr(moePhaseMontant(phase))}</strong>
                        </p>
                      </>
                    ) : (
                      <>
                        <label className="crm-field">
                          <span className="crm-label">Nombre d&apos;ascenseurs</span>
                          <input
                            className="crm-input"
                            type="number"
                            min={0}
                            step={1}
                            value={phase.nbAscenseurs}
                            onChange={(e) => updatePhase(code, { nbAscenseurs: Math.max(0, Math.trunc(Number(e.target.value)) || 0) })}
                          />
                        </label>
                        <label className="crm-field">
                          <span className="crm-label">Prix unitaire HT / ascenseur (€)</span>
                          <input
                            className="crm-input"
                            type="number"
                            min={0}
                            step="0.01"
                            value={phase.prixUnitaireHt}
                            onChange={(e) => updatePhase(code, { prixUnitaireHt: Number(e.target.value) || 0 })}
                          />
                        </label>
                        <p className="crm-hint crm-span-2 m-0">
                          Montant calculé : <strong>{moneyFr(moePhaseMontant(phase))}</strong>
                        </p>
                      </>
                    )}
                    <label className="crm-field">
                      <span className="crm-label">Délai prévisionnel</span>
                      <input
                        className="crm-input"
                        value={phase.delaiTexte}
                        onChange={(e) => updatePhase(code, { delaiTexte: e.target.value })}
                        placeholder="suivant planning du Maître d'Ouvrage"
                      />
                    </label>
                    <label className="crm-field crm-span-2">
                      <span className="crm-label">Échéancier de facturation (une ligne par échéance)</span>
                      <textarea
                        className="crm-input"
                        rows={2}
                        value={phase.echeancierTexte}
                        onChange={(e) => updatePhase(code, { echeancierTexte: e.target.value })}
                        placeholder="À l'envoi du rapport"
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <p className="crm-hint mt-1">
          Total HT : <strong>{moneyFr(total)}</strong>
        </p>
      </div>
    );
  }

  // MS — Mission Spéciale
  const c = value as MsMissionCalc;
  const total = computeMissionCalcTotal(tm, c);
  return (
    <div className="crm-stack crm-span-2">
      <p className="crm-stack-title">
        <span className="crm-stack-title__icon" aria-hidden>€</span> Mission Spéciale
      </p>
      <label className="crm-field crm-span-2">
        <span className="crm-label">Texte de la mission</span>
        <Editor
          value={c.texteMissionHtml}
          onTextChange={(e) => onChange({ ...c, texteMissionHtml: e.htmlValue || "" })}
          style={{ height: 220 }}
        />
      </label>
      <div className="crm-form-grid crm-form-grid--tight" style={{ marginTop: 8 }}>
        <label className="crm-field">
          <span className="crm-label">Montant HT (€)</span>
          <input
            className="crm-input"
            type="number"
            min={0}
            step="0.01"
            value={c.montantHt}
            onChange={(e) => onChange({ ...c, montantHt: Number(e.target.value) || 0 })}
          />
        </label>
        <label className="crm-field crm-span-2">
          <span className="crm-label">Échéancier de facturation</span>
          <textarea
            className="crm-input"
            rows={2}
            value={c.echeancierTexte}
            onChange={(e) => onChange({ ...c, echeancierTexte: e.target.value })}
            placeholder="ex. 50 % à la commande, 50 % à la livraison"
          />
        </label>
        <label className="crm-field crm-span-2">
          <span className="crm-label">Délai prévisionnel (facultatif)</span>
          <input
            className="crm-input"
            value={c.delaiTexte}
            onChange={(e) => onChange({ ...c, delaiTexte: e.target.value })}
            placeholder="ex. Selon planning maître d'ouvrage"
          />
        </label>
      </div>
      <p className="crm-hint mt-1">
        Total HT : <strong>{moneyFr(total)}</strong>
      </p>
    </div>
  );
}
