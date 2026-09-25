/**
 * Miroir client (affichage/feedback immédiat uniquement) du calcul serveur
 * `server/src/documents/offre-mission-calc.ts`. Le serveur reste seul juge à la sauvegarde —
 * ces fonctions ne servent qu'à afficher un total en temps réel et bloquer le bouton de
 * sauvegarde avant même l'aller-retour réseau.
 */
import type {
  AuditMissionCalc,
  MissionCalc,
  MmMissionCalc,
  MoeMissionCalc,
  MoePhaseCalc,
  MoePhaseCode,
  MsMissionCalc,
} from "./types";

export const DEFAULT_AUDIT_PRIX_HT = 750;
export const DEFAULT_MM_PRIX_MOIS_HT = 45;
export const DEFAULT_MOE_POURCENTAGE = 7;

export const MOE_PHASE_LABELS: Record<MoePhaseCode, string> = {
  AVANT_PROJET: "Avant-Projet",
  DCE_AMT: "Appel d'offres — DCE et AMT",
  DET: "Exécution & Travaux — DET",
  GPA: "Garantie de parfait achèvement",
};

export const MOE_PHASE_ORDER: MoePhaseCode[] = ["AVANT_PROJET", "DCE_AMT", "DET", "GPA"];

/** Audit et CTQ (Contrôle Technique Quinquennal) partagent exactement la même forme de saisie
 * (prix unitaire × nb ascenseurs) — seul le libellé affiché diffère côté document. */
const AUDIT_LIKE_TYPES = new Set(["A", "CTQ"]);

export function emptyMissionCalc(typeMission: string, nbAscenseursSuggestion?: number | null): MissionCalc {
  const tm = typeMission.toUpperCase();
  if (AUDIT_LIKE_TYPES.has(tm)) {
    return { prixUnitaireHt: DEFAULT_AUDIT_PRIX_HT, nbAscenseurs: nbAscenseursSuggestion || 1 } satisfies AuditMissionCalc;
  }
  switch (tm) {
    case "MM":
      return { prixUnitaireMoisHt: DEFAULT_MM_PRIX_MOIS_HT, nbAscenseurs: nbAscenseursSuggestion || 1 } satisfies MmMissionCalc;
    case "MOE":
      return {
        phases: MOE_PHASE_ORDER.map((code) => ({
          code,
          selected: false,
          calcMode: "LIBRE",
          montantHt: 0,
          prixUnitaireHt: 0,
          nbAscenseurs: nbAscenseursSuggestion || 1,
          pourcentage: DEFAULT_MOE_POURCENTAGE,
          montantTravauxHt: 0,
          echeancierTexte: "",
          delaiTexte: "",
        })),
      } satisfies MoeMissionCalc;
    case "MS":
      return { texteMissionHtml: MS_HTML_SKELETON, montantHt: 0, echeancierTexte: "", delaiTexte: "" } satisfies MsMissionCalc;
    default:
      return { texteMissionHtml: MS_HTML_SKELETON, montantHt: 0, echeancierTexte: "", delaiTexte: "" } satisfies MsMissionCalc;
  }
}

/** Squelette de départ pour l'éditeur riche MS — sur le modèle des offres MS réelles
 * (ex. « Phase : Assistance aux opérations de réception »), entièrement modifiable/supprimable. */
const MS_HTML_SKELETON =
  "<h3>Phase : [Titre de la mission]</h3><ul><li>[Première prestation]</li><li>[Deuxième prestation]</li></ul>";

function moisRestants(dateOffreIso: string | null | undefined): number {
  const d = dateOffreIso ? new Date(dateOffreIso) : new Date();
  if (Number.isNaN(d.getTime())) return 12;
  return 13 - (d.getMonth() + 1);
}

function anneeOffre(dateOffreIso: string | null | undefined): number {
  const d = dateOffreIso ? new Date(dateOffreIso) : new Date();
  return Number.isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
}

export function computeMmDetail(calc: MmMissionCalc, dateOffreIso: string | null | undefined) {
  const prixUnitaireMoisHt = Number(calc.prixUnitaireMoisHt) || 0;
  const nbAscenseurs = Number(calc.nbAscenseurs) || 0;
  const totalAn = Math.round(prixUnitaireMoisHt * 12 * nbAscenseurs * 100) / 100;
  const mois = moisRestants(dateOffreIso);
  const annee = anneeOffre(dateOffreIso);
  const exerciceMontant = Math.round(prixUnitaireMoisHt * nbAscenseurs * mois * 100) / 100;
  return { nbAscenseurs, prixUnitaireMoisHt, totalAn, exerciceMontant, annee };
}

/** Montant HT effectif d'une phase MOE selon son mode de calcul — miroir de
 * `moePhaseMontant` côté serveur (offre-mission-calc.ts). */
export function moePhaseMontant(p: MoePhaseCalc): number {
  switch (p.calcMode) {
    case "UNITAIRE":
      return Math.round((Number(p.prixUnitaireHt) || 0) * (Number(p.nbAscenseurs) || 0) * 100) / 100;
    case "POURCENTAGE": {
      const base =
        p.montantTravauxHt != null
          ? Number(p.montantTravauxHt) || 0
          : (Number(p.prixUnitaireHt) || 0) * (Number(p.nbAscenseurs) || 0);
      return Math.round(((Number(p.pourcentage) || 0) / 100) * base * 100) / 100;
    }
    default:
      return Number(p.montantHt) || 0;
  }
}

export function computeMissionCalcTotal(
  typeMission: string,
  calc: MissionCalc,
  dateOffreIso?: string | null,
): number {
  const tm = typeMission.toUpperCase();
  if (AUDIT_LIKE_TYPES.has(tm)) {
    const c = calc as AuditMissionCalc;
    return Math.round((Number(c.prixUnitaireHt) || 0) * (Number(c.nbAscenseurs) || 0) * 100) / 100;
  }
  switch (tm) {
    case "MM":
      return computeMmDetail(calc as MmMissionCalc, dateOffreIso).totalAn;
    case "MOE": {
      const c = calc as MoeMissionCalc;
      return Math.round(c.phases.filter((p) => p.selected).reduce((s, p) => s + moePhaseMontant(p), 0) * 100) / 100;
    }
    case "MS":
      return Math.round((Number((calc as MsMissionCalc).montantHt) || 0) * 100) / 100;
    default:
      return 0;
  }
}

/** Miroir des garde-fous serveur — total <= 0, ou MOE sans phase sélectionnée. */
export function validateMissionCalc(typeMission: string, calc: MissionCalc, dateOffreIso?: string | null): string | null {
  const tm = typeMission.toUpperCase();
  if (tm === "MOE") {
    const c = calc as MoeMissionCalc;
    if (!c.phases.some((p) => p.selected && moePhaseMontant(p) > 0)) {
      return "Sélectionnez au moins une phase MOE avec un montant.";
    }
  }
  const total = computeMissionCalcTotal(tm, calc, dateOffreIso);
  if (!(total > 0)) return "Le montant total de l'offre doit être supérieur à 0.";
  return null;
}

/** Forme réelle d'un `MissionCalc` (discriminée par la présence d'un champ propre à chaque
 * forme) — Audit et CTQ partagent la même forme "AUDIT_LIKE". Permet de détecter un objet resté
 * à la forme de l'ancien type pendant le rendu qui suit immédiatement un changement de type de
 * mission, avant que l'effet de réinitialisation n'ait eu le temps de mettre à jour le state
 * (React ne re-rend qu'après coup). Sans cette détection, le composant lirait par ex.
 * `calc.phases` sur un objet MS et plante. */
export type MissionCalcShape = "AUDIT_LIKE" | "MM" | "MOE" | "MS";

export function calcShapeOf(calc: MissionCalc | null | undefined): MissionCalcShape | null {
  if (!calc) return null;
  if ("prixUnitaireHt" in calc) return "AUDIT_LIKE";
  if ("prixUnitaireMoisHt" in calc) return "MM";
  if ("phases" in calc) return "MOE";
  if ("texteMissionHtml" in calc) return "MS";
  return null;
}

export function missionCalcShapeFor(typeMission: string): MissionCalcShape {
  const tm = typeMission.toUpperCase();
  if (AUDIT_LIKE_TYPES.has(tm)) return "AUDIT_LIKE";
  if (tm === "MM") return "MM";
  if (tm === "MOE") return "MOE";
  return "MS";
}

export function moneyFr(v: number): string {
  return `${(Number(v) || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
