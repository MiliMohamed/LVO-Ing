/**
 * Calcul serveur automatique des honoraires/échéancier pour les 5 types de mission outillés
 * (Audit, CTQ, Maintenance Management, MOE, Mission Spéciale) à partir des paramètres de saisie
 * bruts envoyés par le client (`missionCalc`). Le résultat (montant HT, lignes honoraires, lignes
 * d'échéancier) est la seule source de vérité persistée pour ces 5 types — le montant HT n'est
 * plus une saisie libre côté client, il est dérivé ici.
 */

export type PhaseLine = { code: string; libelle: string; montantHt: number; inclus?: boolean };
export type EcheancierRow = { phase: string; montant: number; modalite: string };
export type DelaiLine = { prestation: string; delai: string };

export type AuditMissionCalc = { prixUnitaireHt: number; nbAscenseurs: number };
export type MmMissionCalc = { prixUnitaireMoisHt: number; nbAscenseurs: number };
export type MoePhaseCode = "AVANT_PROJET" | "DCE_AMT" | "DET" | "GPA";
/** LIBRE = montant saisi directement (historique) ; UNITAIRE = prixUnitaireHt × nbAscenseurs ;
 * POURCENTAGE = (pourcentage / 100) × prixUnitaireHt × nbAscenseurs. */
export type MoePhaseCalcMode = "LIBRE" | "UNITAIRE" | "POURCENTAGE";
export type MoePhaseCalc = {
  code: MoePhaseCode;
  selected: boolean;
  calcMode: MoePhaseCalcMode;
  montantHt: number;
  prixUnitaireHt: number;
  nbAscenseurs: number;
  pourcentage: number;
  echeancierTexte: string;
  delaiTexte: string;
};
export type MoeMissionCalc = { phases: MoePhaseCalc[] };
export type MsMissionCalc = { texteMissionHtml: string; montantHt: number; echeancierTexte: string; delaiTexte: string };

export type MissionCalc = AuditMissionCalc | MmMissionCalc | MoeMissionCalc | MsMissionCalc;

export type MmComputedDetail = {
  nbAscenseurs: number;
  prixUnitaireMoisHt: number;
  totalAn: number;
  exerciceMontant: number;
  annee: number;
};

export type AuditComputedDetail = {
  libelle: string;
  nbAscenseurs: number;
  prixUnitaireHt: number;
  montantHt: number;
};

export type MissionCalcResult =
  | {
      ok: true;
      montantHt: number;
      phasesLinesJson: string;
      echeancierRowsJson: string;
      delaisLignesJson: string | null;
      mmDetail: MmComputedDetail | null;
      auditDetail: AuditComputedDetail | null;
    }
  | { ok: false; error: string };

const MOE_PHASE_ORDER: MoePhaseCode[] = ["AVANT_PROJET", "DCE_AMT", "DET", "GPA"];
const MOE_PHASE_LABELS: Record<MoePhaseCode, string> = {
  AVANT_PROJET: "Phase 1 : AVANT-PROJET",
  DCE_AMT: "Phase 2 : Appel d'offres — DCE et AMT",
  DET: "Phase 3 : Exécution & Travaux — DET",
  GPA: "Phase 4 : Garantie de parfait achèvement",
};

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

/** Nombre de mois restants de l'année civile de `dateOffreIso`, de 1 (décembre) à 12 (janvier). */
function moisRestants(dateOffreIso: string | null): number {
  const d = dateOffreIso ? new Date(dateOffreIso) : new Date();
  if (Number.isNaN(d.getTime())) return 12;
  return 13 - (d.getMonth() + 1);
}

function anneeOffre(dateOffreIso: string | null): number {
  const d = dateOffreIso ? new Date(dateOffreIso) : new Date();
  return Number.isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
}

const ERR_TOTAL_ZERO = "Le montant total de l'offre doit être supérieur à 0.";

function result(
  montantHt: number,
  phasesLines: PhaseLine[],
  echeancierRows: EcheancierRow[],
  delaisLines: DelaiLine[] | null,
  mmDetail: MmComputedDetail | null = null,
  auditDetail: AuditComputedDetail | null = null,
): MissionCalcResult {
  if (!Number.isFinite(montantHt) || montantHt <= 0) return { ok: false, error: ERR_TOTAL_ZERO };
  return {
    ok: true,
    montantHt,
    phasesLinesJson: JSON.stringify(phasesLines),
    echeancierRowsJson: JSON.stringify(echeancierRows),
    delaisLignesJson: delaisLines ? JSON.stringify(delaisLines) : null,
    mmDetail,
    auditDetail,
  };
}

/** Libellé fixe repris tel quel du gabarit réel (LVOaudit26050_gymnase_de_Vincendo.docx) —
 * ne varie pas avec le nombre d'ascenseurs, contrairement au détail affiché à côté. CTQ (Contrôle
 * Technique Quinquennal) réutilise exactement la même logique de calcul et le même corps de
 * mission qu'Audit (cf. offre-content.ts), seul le libellé change — demande explicite. */
const AUDIT_LIKE_LIBELLE: Record<"A" | "CTQ", string> = {
  A: "AUDIT TECHNIQUE ASCENSEUR",
  CTQ: "CTQ ASCENSEUR",
};

function computeAuditLike(code: "A" | "CTQ", calc: AuditMissionCalc): MissionCalcResult {
  const prixUnitaireHt = n(calc.prixUnitaireHt);
  const nbAscenseurs = n(calc.nbAscenseurs);
  const montantHt = Math.round(prixUnitaireHt * nbAscenseurs * 100) / 100;
  const libelle = AUDIT_LIKE_LIBELLE[code];
  const auditDetail: AuditComputedDetail = { libelle, nbAscenseurs, prixUnitaireHt, montantHt };
  return result(
    montantHt,
    [{ code, libelle, montantHt }],
    [{ phase: libelle, montant: montantHt, modalite: "À l'envoi du rapport" }],
    [
      { prestation: "Relevé sur site", delai: "Suivant demande du maître d'ouvrage et charge de travail" },
      { prestation: "Transmission du rapport", delai: "3 semaines maximum après relevé sur site" },
    ],
    null,
    auditDetail,
  );
}

function computeMm(calc: MmMissionCalc, dateOffreIso: string | null): MissionCalcResult {
  const prixUnitaireMoisHt = n(calc.prixUnitaireMoisHt);
  const nbAscenseurs = n(calc.nbAscenseurs);
  const totalAn = Math.round(prixUnitaireMoisHt * 12 * nbAscenseurs * 100) / 100;
  const mois = moisRestants(dateOffreIso);
  const annee = anneeOffre(dateOffreIso);
  const exerciceMontant = Math.round(prixUnitaireMoisHt * nbAscenseurs * mois * 100) / 100;
  const libelle = `MAINTENANCE MANAGEMENT\n${nbAscenseurs} Ascenseurs`;
  const mmDetail: MmComputedDetail = { nbAscenseurs, prixUnitaireMoisHt, totalAn, exerciceMontant, annee };
  return result(
    totalAn,
    [{ code: "MM", libelle, montantHt: totalAn }],
    [
      {
        phase: `MAINTENANCE MANAGEMENT ${annee}`,
        montant: exerciceMontant,
        modalite: "50 % à l'envoi du rapport 1er semestre\n50 % à l'envoi du rapport 2e semestre",
      },
    ],
    [{ prestation: "Rapport semestriel", delai: "15 jours à partir de l'envoi des données prestataires" }],
    mmDetail,
  );
}

/** Montant HT effectif d'une phase MOE selon son mode de calcul — LIBRE reprend la saisie
 * directe (comportement historique), UNITAIRE et POURCENTAGE le dérivent du nombre d'ascenseurs. */
function moePhaseMontant(p: MoePhaseCalc): number {
  switch (p.calcMode) {
    case "UNITAIRE":
      return Math.round(n(p.prixUnitaireHt) * n(p.nbAscenseurs) * 100) / 100;
    case "POURCENTAGE":
      return Math.round(((n(p.pourcentage) / 100) * n(p.prixUnitaireHt) * n(p.nbAscenseurs)) * 100) / 100;
    default:
      return n(p.montantHt);
  }
}

function computeMoe(calc: MoeMissionCalc): MissionCalcResult {
  const byCode = new Map(calc.phases.map((p) => [p.code, p]));
  const selected = MOE_PHASE_ORDER.map((code) => byCode.get(code)).filter(
    (p): p is MoePhaseCalc => !!p && p.selected && moePhaseMontant(p) > 0,
  );
  if (!selected.length) {
    return { ok: false, error: "Sélectionnez au moins une phase MOE avec un montant." };
  }
  const montantHt = Math.round(selected.reduce((s, p) => s + moePhaseMontant(p), 0) * 100) / 100;
  const phasesLines: PhaseLine[] = selected.map((p) => ({
    code: p.code,
    libelle: MOE_PHASE_LABELS[p.code],
    montantHt: moePhaseMontant(p),
  }));
  const echeancierRows: EcheancierRow[] = selected.map((p) => ({
    phase: MOE_PHASE_LABELS[p.code],
    montant: moePhaseMontant(p),
    modalite: p.echeancierTexte || "",
  }));
  const delaisLines: DelaiLine[] = selected.map((p) => ({
    prestation: MOE_PHASE_LABELS[p.code],
    delai: p.delaiTexte || "",
  }));
  return result(montantHt, phasesLines, echeancierRows, delaisLines);
}

function computeMs(calc: MsMissionCalc): MissionCalcResult {
  const montantHt = Math.round(n(calc.montantHt) * 100) / 100;
  return result(
    montantHt,
    [{ code: "MS", libelle: "Mission Spéciale", montantHt }],
    [{ phase: "Mission Spéciale", montant: montantHt, modalite: calc.echeancierTexte || "" }],
    calc.delaiTexte?.trim() ? [{ prestation: "Mission Spéciale", delai: calc.delaiTexte.trim() }] : null,
  );
}

export function computeOffreFromMissionCalc(
  typeMission: "A" | "CTQ" | "MM" | "MOE" | "MS",
  missionCalc: unknown,
  dateOffreIso: string | null,
): MissionCalcResult {
  const calc = (missionCalc ?? {}) as Record<string, unknown>;
  switch (typeMission) {
    case "A":
    case "CTQ":
      return computeAuditLike(typeMission, calc as unknown as AuditMissionCalc);
    case "MM":
      return computeMm(calc as unknown as MmMissionCalc, dateOffreIso);
    case "MOE":
      return computeMoe({ phases: Array.isArray(calc.phases) ? (calc.phases as MoePhaseCalc[]) : [] });
    case "MS":
      return computeMs(calc as unknown as MsMissionCalc);
  }
}
