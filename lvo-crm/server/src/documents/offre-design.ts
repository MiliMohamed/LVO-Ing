/**
 * Système de design de l'« Offre de Service » LVO — SOURCE UNIQUE.
 *
 * Toutes les valeurs ci-dessous sont relevées dans le XML des trames réelles
 * (`lvo-crm/doc/*.docx` : LVO-audit-26050, LVO-MM-26035_CHM, LVO-MOE-26026, LVO-MS-26037),
 * jamais estimées d'après un rendu PDF. Aucune couleur / taille / largeur ne doit être écrite
 * en dur ailleurs dans le renderer : tout passe par ce module.
 *
 * Unités OOXML :
 *  - couleurs : hex sans '#'
 *  - tailles de police (`sz`) : demi-points (sz19 = 9,5 pt)
 *  - largeurs de colonnes / marges de cellule : DXA (1/20 pt)
 *  - épaisseurs de bordure (`size`) : huitièmes de point (sz1 = 0,125 pt, sz6 = 0,75 pt)
 */
import { BorderStyle } from "docx";

// ─── Couleurs ────────────────────────────────────────────────────────────────
export const COLOR = {
  navy: "1A2B4C",
  orange: "FF6B00",
  /** Orange plus sombre des sous-titres du corps de mission. */
  orangeAccent: "EA4E00",
  text: "333333",
  muted: "8E9DAE",
  white: "FFFFFF",
  fillBlue: "E8EDF4",
  fillGrey1: "EEF2F7",
  fillGrey2: "FAFBFC",
  fillGrey3: "F4F6F9",
  fillOrangeLt: "FFF3E8",
} as const;

// ─── Police & tailles (demi-points) ──────────────────────────────────────────
export const FONT = "Arial";

export const SZ = {
  /** Titre de la bannière « OFFRE DE SERVICE » — 18 pt. */
  banner: 36,
  /** Nom du site dans l'encadré SITE — 16 pt. */
  siteName: 32,
  /** Titre de section niveau 1 (Titre1 des trames) — 13 pt. */
  title1: 26,
  /** Titre de section niveau 2 (Titre2 des trames) — 11 pt. */
  title2: 22,
  /** Sous-titres de bannière, adresse du site, montants mis en avant — 11 pt. */
  strong: 22,
  /** Texte courant des cellules de tableau — 9,5 pt. */
  cell: 19,
  /** Notes discrètes (TVA, validité) et libellé « SITE » — 9 pt. */
  note: 18,
  /** En-tête / pied de page courants — 8 pt. */
  runningHead: 16,
  /** Corps de mission (paragraphes, puces). */
  body: 20,
} as const;

// ─── Bordures ────────────────────────────────────────────────────────────────
/** Un jeu de filets applicable à une cellule (4 côtés). */
export type BorderSet = {
  top: { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string };
  bottom: { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string };
  left: { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string };
  right: { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string };
};

/** Marges internes d'une cellule (DXA). */
export type CellMargin = { top: number; bottom: number; left: number; right: number };

/** Filet interne standard de tous les tableaux de données : single sz1 #8E9DAE. */
export const CELL_BORDER = { style: BorderStyle.SINGLE, size: 1, color: COLOR.muted } as const;
export const CELL_BORDERS: BorderSet = {
  top: CELL_BORDER,
  bottom: CELL_BORDER,
  left: CELL_BORDER,
  right: CELL_BORDER,
} as const;

/** Cellule sans aucun filet (colonne d'espacement du tableau de signatures). */
export const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: COLOR.white } as const;
export const NO_BORDERS: BorderSet = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
} as const;

const box = (size: number, color: string): BorderSet => ({
  top: { style: BorderStyle.SINGLE, size, color },
  bottom: { style: BorderStyle.SINGLE, size, color },
  left: { style: BorderStyle.SINGLE, size, color },
  right: { style: BorderStyle.SINGLE, size, color },
});

/** Bannière « OFFRE DE SERVICE » : filet orange sz6 sur les 4 côtés. */
export const BANNER_BORDERS = box(6, COLOR.orange);
/** Encadré SITE : filet navy sz6 sur les 4 côtés. */
export const SITE_BORDERS = box(6, COLOR.navy);
/** Encart du type de mission : filet orange épais haut/bas (sz12), fin gauche/droite (sz4). */
export const MISSION_BORDERS: BorderSet = {
  top: { style: BorderStyle.SINGLE, size: 12, color: COLOR.orange },
  bottom: { style: BorderStyle.SINGLE, size: 12, color: COLOR.orange },
  left: { style: BorderStyle.SINGLE, size: 4, color: COLOR.orange },
  right: { style: BorderStyle.SINGLE, size: 4, color: COLOR.orange },
} as const;
/** Filet orange sous les titres de section de niveau 1. */
export const TITLE1_UNDERLINE = { style: BorderStyle.SINGLE, size: 6, color: COLOR.orange, space: 4 } as const;

// ─── Marges internes de cellule (DXA) ────────────────────────────────────────
export const CELL_MARGIN: CellMargin = { top: 100, bottom: 100, left: 150, right: 150 };
export const BANNER_MARGIN: CellMargin = { top: 160, bottom: 160, left: 300, right: 300 };
export const SITE_MARGIN: CellMargin = { top: 220, bottom: 220, left: 300, right: 300 };
export const MISSION_MARGIN: CellMargin = { top: 180, bottom: 180, left: 280, right: 280 };
export const COUT_MARGIN: CellMargin = { top: 120, bottom: 120, left: 200, right: 200 };

// ─── Largeurs (DXA) ──────────────────────────────────────────────────────────
/** Largeur utile d'une page A4 avec marges 1440 : 11906 − 2×1440. */
export const CONTENT_WIDTH = 9026;

/** Bloc « POUR / REPRÉSENTÉ PAR / … » de la page de garde. */
export const POUR_COLS = [2551, 6787] as const;

/** Tableau de signatures : 2 colonnes + colonne d'espacement centrale sans filet. */
export const SIGNATURE_COLS = [4252, 320, 4490] as const;

/**
 * Largeurs de colonnes des 3 tableaux chiffrés, relevées trame par trame — elles diffèrent
 * volontairement selon le type de mission (longueur des libellés).
 */
export const TABLE_COLS: Record<
  "A" | "CTQ" | "MM" | "MOE" | "MS",
  { honoraires: readonly number[]; echeancier: readonly number[]; delais: readonly number[] }
> = {
  // LVO-audit-26050_gymnase de Vincendo.docx
  A: { honoraires: [5155, 3871], echeancier: [3685, 1739, 3602], delais: [2816, 6210] },
  // CTQ : largeurs relevées dans LVO-CTQ-26033 — identiques à la trame Audit.
  CTQ: { honoraires: [5155, 3871], echeancier: [3685, 1739, 3602], delais: [2816, 6210] },
  // LVO-MM-26035_CHM.docx
  MM: { honoraires: [4855, 4171], echeancier: [3664, 1577, 3785], delais: [2608, 6418] },
  // LVO-MOE-26026_ Stade en eau vive.docx
  MOE: { honoraires: [6215, 2811], echeancier: [4110, 1556, 3547], delais: [3972, 5054] },
  // LVO-MS-26037_SEMADER - Rico Carpaye.docx
  MS: { honoraires: [6898, 2128], echeancier: [4646, 1490, 2890], delais: [2053, 6973] },
};

/** Type de mission sans trame chiffrée propre (ET, legacy…) : repli sur la géométrie MM. */
export function tableColsFor(typeMission: string): (typeof TABLE_COLS)["MM"] {
  const tm = typeMission.toUpperCase();
  return (TABLE_COLS as Record<string, (typeof TABLE_COLS)["MM"]>)[tm] ?? TABLE_COLS.MM;
}

// ─── Valeurs métier figées (identiques sur les 4 trames) ─────────────────────
export const COUT_HORAIRE_HT = 175;
export const COUT_JOURNALIER_HT = 1225;
export const MENTION_VALIDITE = "Offre valable 3 mois — Révisable selon l'indice SYNTEC.";
