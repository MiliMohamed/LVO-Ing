/**
 * Construit le document Word "Offre de Service" à la charte LVO — port du renderer docx4j
 * (backend/.../documents/OffreDocumentRenderer.java) vers le package `docx` (Node), sans
 * template .docx séparé : le document (7 sections, en-tête/pied de page, images) est assemblé
 * programmatiquement.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Tab,
  TabStopType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";

import type { BorderSet, CellMargin } from "./offre-design.js";
import {
  BANNER_BORDERS,
  BANNER_MARGIN,
  CELL_BORDERS,
  CELL_MARGIN,
  COLOR,
  CONTENT_WIDTH,
  COUT_MARGIN,
  FONT,
  MISSION_BORDERS,
  MISSION_MARGIN,
  NO_BORDERS,
  POUR_COLS,
  SIGNATURE_COLS,
  SITE_BORDERS,
  SITE_MARGIN,
  SZ,
  TITLE1_UNDERLINE,
  tableColsFor,
} from "./offre-design.js";
import {
  CGV_BLOCKS,
  CGV_INTRODUCTION,
  COURRIER_DISCIPLINES,
  COURRIER_INTRO_PARAGRAPHS,
  COURRIER_OUTRO_PARAGRAPHS,
  LVO_SIGNATAIRE,
  LVO_SIGNATAIRE_FONCTION,
  type ContentBlock,
  type MissionBody,
} from "./offre-content.js";

export type MmHonorairesDetail = {
  nbAscenseurs: number;
  prixUnitaireMoisHt: number;
  totalAn: number;
  exerciceMontant: number;
  annee: number;
};

export type AuditHonorairesDetail = {
  /** "AUDIT TECHNIQUE ASCENSEUR" pour Audit, "CTQ ASCENSEUR" pour CTQ — même tableau, libellé
   * différent, cf. offre-mission-calc.ts. */
  libelle: string;
  nbAscenseurs: number;
  prixUnitaireHt: number;
  montantHt: number;
};

// Tous les jetons de design (couleurs, tailles, largeurs DXA, bordures, marges de cellule)
// viennent de `offre-design.ts`, relevés dans le XML des trames réelles. Les alias ci-dessous
// gardent les noms courts déjà utilisés dans ce fichier — aucune valeur en dur ici.
const NAVY = COLOR.navy;
const ORANGE = COLOR.orange;
const LIGHT_BLUE = COLOR.fillBlue;
const GREY_TEXT = COLOR.muted;
const GREY_VALUE = COLOR.text;
const HEADING_ORANGE = COLOR.orangeAccent;
const TYPE_LABEL_BG = COLOR.fillOrangeLt;
const LIGHT_GREY_BLUE = COLOR.fillGrey3;
const WHITE = COLOR.white;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.resolve(__dirname, "..", "..", "assets");

let _logo: Buffer | null = null;
let _cachet: Buffer | null = null;

export function readLogo(): Buffer {
  if (!_logo) _logo = fs.readFileSync(path.join(ASSETS_DIR, "logo-lvo.jpg"));
  return _logo;
}

export function readCachet(): Buffer | null {
  if (_cachet) return _cachet;
  try {
    _cachet = fs.readFileSync(path.join(ASSETS_DIR, "cachet.jpeg.jpg"));
    return _cachet;
  } catch {
    return null;
  }
}

export type OffreRenderData = {
  reference: string;
  /** Code du type de mission (A, CTQ, MM, MOE, MS…) — détermine les largeurs de colonnes des
   * tableaux chiffrés, qui diffèrent d'une trame à l'autre (cf. TABLE_COLS dans offre-design.ts). */
  typeMission: string;
  dateOffre: string;
  courrierVilleDate: string;
  siteNom: string;
  siteAdresse: string;
  sitePhoto: { data: Buffer; type: ImageType } | null;
  clientNom: string;
  clientDirection: string;
  clientRepresentant: string;
  /** Formule d'appel du courrier : « Monsieur », « Madame » ou « Madame, Monsieur » — déduite de
   * la civilité du destinataire (contact rattaché ou libellé saisi), cf. civiliteAppel(). */
  civiliteAppel: string;
  missionLabel: string;
  objet: string;
  honoraires: { libelle: string; montant: number }[];
  totalHt: number;
  echeancier: { phase: string; montant: number; modalite: string }[];
  delais: { prestation: string; delai: string }[];
  tva: number;
  validite: string;
  coutHoraire: number;
  coutJournalier: number;
  missionBody: MissionBody | null;
  /** Quand renseigné, `renderHonoraires` affiche le tableau spécifique Maintenance Management
   * (prix/mois/ascenseur, total/an, montant exercice en cours) au lieu du tableau générique. */
  mmHonoraires?: MmHonorairesDetail | null;
  /** Quand renseigné, `renderHonoraires` affiche le tableau spécifique Audit (prix HT / ascenseur
   * + ligne TOTAL) au lieu du tableau générique. */
  auditHonoraires?: AuditHonorairesDetail | null;
};

function money(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "0,00 €";
  return (
    v
      .toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .replace(/ | /g, " ") + " €"
  );
}

function textLines(text: string | null | undefined): TextRun[] {
  const lines = (text ?? "").split("\n");
  const runs: TextRun[] = [];
  lines.forEach((line, i) => {
    if (i > 0) runs.push(new TextRun({ text: "", break: 1 }));
    runs.push(new TextRun({ text: line, font: FONT }));
  });
  return runs;
}

function p(
  text: string,
  opts: {
    size?: number;
    bold?: boolean;
    color?: string;
    italics?: boolean;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    keepNext?: boolean;
  } = {},
): Paragraph {
  // Les trames justifient le corps de texte (w:jc val="both") — sans effet sur les lignes
  // uniques (titres, "Monsieur,"…), donc applicable par défaut.
  const { size = SZ.body, bold = false, color = "000000", italics = false, align = AlignmentType.BOTH, keepNext = false } = opts;
  const lines = (text ?? "").split("\n");
  const children: TextRun[] = [];
  lines.forEach((line, i) => {
    if (i > 0) children.push(new TextRun({ text: "", break: 1 }));
    children.push(new TextRun({ text: line, size, bold, color, italics, font: FONT }));
  });
  return new Paragraph({ children, alignment: align, spacing: { after: 120 }, keepNext });
}

/** Titre de section de premier niveau ("DÉTAILS DE NOTRE OFFRE DE SERVICE", "MONTANT DES
 * HONORAIRES", "DÉLAIS ET CALENDRIER PRÉVISIONNEL", "ORDRE DE MISSION — SIGNATURES",
 * "INFORMATIONS ET CONDITIONS GÉNÉRALES DE VENTES"…) — navy gras + filet orange en dessous,
 * relevé sur chaque paragraphe de style "Titre1" dans LVO-MM-26035_CHM.docx. */
function sectionTitleP(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 200 },
    border: { bottom: TITLE1_UNDERLINE },
    children: [new TextRun({ text, size: SZ.title1, bold: true, color: NAVY, font: FONT })],
  });
}

function emptyP(): Paragraph {
  return new Paragraph({ children: [] });
}

function pageBreak(): Paragraph {
  return new Paragraph({ children: [], pageBreakBefore: true });
}

function bulletP(text: string): Paragraph {
  return new Paragraph({
    indent: { left: 360 },
    spacing: { after: 60 },
    children: [new TextRun({ text: `• ${text}`, size: SZ.body, font: FONT })],
  });
}

function subBulletP(text: string): Paragraph {
  return new Paragraph({
    indent: { left: 720 },
    spacing: { after: 60 },
    children: [new TextRun({ text: `- ${text}`, size: SZ.cell, font: FONT })],
  });
}

function subheadingP(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 120, after: 60 },
    children: [new TextRun({ text, bold: true, size: SZ.body, color: HEADING_ORANGE, font: FONT })],
  });
}

/**
 * Encart de délai / mise en avant : dans les 4 trames c'est le MÊME encadré pêche à filet orange
 * que le libellé de type de mission (fond #FFF3E8, filets orange sz12 haut/bas et sz4 gauche/
 * droite, marges 180/280 DXA). `title` facultatif : ligne de titre orange gras au-dessus du texte
 * — les trames regroupent bien titre + valeur DANS la même case (ex. « DELAIS DE REMISE DU
 * RAPPORT » puis le délai, cf. LVO-audit-26050 et LVO-MS-26037).
 */
function calloutBox(text: string, title?: string): Table {
  const children: Paragraph[] = [];
  if (title) {
    children.push(
      new Paragraph({ children: [new TextRun({ text: title, bold: true, size: SZ.body, color: ORANGE, font: FONT })] }),
    );
  }
  children.push(new Paragraph({ children: textLinesSized(text, SZ.body, GREY_VALUE) }));
  return boxTable(TYPE_LABEL_BG, MISSION_BORDERS, MISSION_MARGIN, children);
}

/** Encart du libellé de type de mission ("Maintenance Management", "Audit Complet"…) en tête du
 * corps de mission — tableau 1×1, fond pêche #FFF3E8, filets orange sz12 haut/bas et sz4
 * gauche/droite, marges internes 180/280 DXA (relevé tel quel dans les 4 trames). */
function typeLabelBox(text: string): Table {
  return boxTable(TYPE_LABEL_BG, MISSION_BORDERS, MISSION_MARGIN, [
    new Paragraph({ children: [new TextRun({ text, bold: true, size: SZ.body, color: ORANGE, font: FONT })] }),
  ]);
}

/** Encadré centré à une cellule (bannière « OFFRE DE SERVICE », encadré SITE). */
function centeredBox(
  fill: string,
  borders: BorderSet,
  margins: CellMargin,
  lines: { text: string; size: number; bold?: boolean; color: string }[],
): Table {
  const children: TextRun[] = [];
  lines.forEach((l) => {
    if (!l.text) return;
    if (children.length > 0) children.push(new TextRun({ text: "", break: 1 }));
    children.push(new TextRun({ text: l.text, size: l.size, bold: l.bold ?? false, color: l.color, font: FONT }));
  });
  return boxTable(fill, borders, margins, [new Paragraph({ alignment: AlignmentType.CENTER, children })]);
}

function renderBlock(b: ContentBlock): Paragraph | Table {
  switch (b.type) {
    case "heading":
      return p(b.text, { size: SZ.title2, bold: true, color: HEADING_ORANGE });
    case "subheading":
      return subheadingP(b.text);
    case "paragraph":
      return p(b.text, { size: SZ.body });
    case "bullet":
      return bulletP(b.text);
    case "subbullet":
      return subBulletP(b.text);
    case "boxed":
      return calloutBox(b.text);
    case "typeLabel":
      return typeLabelBox(b.text);
    case "richParagraph":
      return new Paragraph({
        spacing: { after: 120 },
        alignment: AlignmentType.BOTH,
        children: b.runs.map((r) =>
          r.text === "\n"
            ? new TextRun({ text: "", break: 1 })
            : new TextRun({ text: r.text, bold: !!r.bold, italics: !!r.italic, size: SZ.body, font: FONT }),
        ),
      });
  }
}

/**
 * Rend une suite de blocs de contenu. Un `heading` immédiatement suivi d'un `boxed` est fusionné
 * en UN SEUL encadré (titre orange + valeur dans la même case), comme dans les trames — ex.
 * « DÉLAIS DE REMISE DU RAPPORT » + le délai (LVO-audit-26050), « DELAIS ASSISTANCE AUX
 * OPERATIONS DE RECEPTION » + « Selon planning maitre d'ouvrage » (LVO-MS-26037).
 */
function renderBlocks(blocks: ContentBlock[]): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const next = blocks[i + 1];
    if (b.type === "heading" && next?.type === "boxed") {
      out.push(calloutBox(next.text, b.text));
      i++;
      continue;
    }
    out.push(renderBlock(b));
  }
  return out;
}

type ImageType = "jpg" | "png" | "gif" | "bmp";

function imageParagraph(
  data: Buffer,
  widthPx: number,
  heightPx: number,
  type: ImageType = "jpg",
  opts: { keepNext?: boolean } = {},
): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    keepNext: opts.keepNext ?? false,
    children: [
      new ImageRun({
        data,
        transformation: { width: widthPx, height: heightPx },
        type,
      }),
    ],
  });
}

/** Décode une image "data:image/<mime>;base64,…" (format déjà utilisé pour la photo de site,
 * cf. imageDataUrl) vers un buffer directement embarquable dans le docx. */
export function decodeDataUrlImage(dataUrl: string | null | undefined): { data: Buffer; type: ImageType } | null {
  if (!dataUrl) return null;
  const m = /^data:image\/(\w+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!m) return null;
  const mime = m[1].toLowerCase();
  const type: ImageType | null = mime === "jpeg" || mime === "jpg" ? "jpg" : mime === "png" ? "png" : mime === "gif" ? "gif" : mime === "bmp" ? "bmp" : null;
  if (!type) return null;
  try {
    return { data: Buffer.from(m[2], "base64"), type };
  } catch {
    return null;
  }
}

function textLinesSized(text: string, size: number, color: string = GREY_VALUE, bold = false): TextRun[] {
  const lines = (text ?? "").split("\n");
  const runs: TextRun[] = [];
  lines.forEach((line, i) => {
    if (i > 0) runs.push(new TextRun({ text: "", break: 1 }));
    runs.push(new TextRun({ text: line, size, color, bold, font: FONT }));
  });
  return runs;
}

/**
 * Cellule de donnée générique. Applique systématiquement la géométrie relevée dans les trames :
 * filets `single sz1 #8E9DAE`, marges internes 100/150 DXA et alignement vertical centré.
 * `width` est une largeur DXA issue de `offre-design.ts` (jamais un pourcentage : les trames
 * fixent des largeurs absolues, différentes selon le type de mission).
 */
function tc(
  text: string,
  opts: { fill?: string; color?: string; bold?: boolean; size?: number; width?: number } = {},
): TableCell {
  const { fill, color = GREY_VALUE, bold = false, size = SZ.cell, width } = opts;
  return new TableCell({
    borders: CELL_BORDERS,
    margins: CELL_MARGIN,
    verticalAlign: VerticalAlign.CENTER,
    ...(width ? { width: { size: width, type: WidthType.DXA } } : {}),
    ...(fill ? { shading: { type: ShadingType.CLEAR, fill } } : {}),
    children: [new Paragraph({ children: textLinesSized(text, size, color, bold) })],
  });
}

/** Cellule d'en-tête de tableau : fond navy, texte blanc gras 9,5 pt. */
function tcHeader(text: string, width?: number): TableCell {
  return tc(text, { fill: NAVY, color: WHITE, bold: true, width });
}

function tr(cells: TableCell[]): TableRow {
  return new TableRow({ children: cells });
}

/** Tableau de données : largeur totale et grille de colonnes en DXA, comme dans les trames. */
function dataTable(rows: TableRow[], cols: readonly number[]): Table {
  return new Table({
    rows,
    width: { size: cols.reduce((s, c) => s + c, 0), type: WidthType.DXA },
    columnWidths: [...cols],
  });
}

/**
 * Encadré pleine largeur à une seule cellule (bannière « OFFRE DE SERVICE », encadré SITE,
 * encart du type de mission, encart coût horaire). Dans les trames ce sont bien des tableaux
 * 1×1 — et non des paragraphes ombrés — avec leurs propres filets et marges internes.
 */
function boxTable(fill: string, borders: BorderSet, margins: CellMargin, children: Paragraph[]): Table {
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill },
            borders,
            margins,
            children,
          }),
        ],
      }),
    ],
  });
}

/**
 * `highlightLastN` : nombre de lignes finales à mettre en évidence en orange/blanc — reprend le
 * style des lignes TOTAL observé dans les gabarits réels LVO (fond FF6B00, texte blanc gras).
 * `dataRowStyle` : style des lignes non mises en évidence — "navy-bg" pour une ligne de contenu
 * chiffré (fond bleu clair, texte navy gras — tableau honoraires) ; "plain" pour une valeur
 * descriptive libre sans fond (tableau délais, gris normal des deux côtés — relevé tel quel dans
 * LVO-MM-26035_CHM.docx).
 */
/**
 * Tableau à 2 colonnes (honoraires, délais). `cols` = largeurs DXA propres au type de mission.
 * `highlightLastN` : lignes TOTAL finales — libellé sur fond blanc, montant sur fond orange en
 * blanc gras 11 pt (relevé dans les 4 trames). `dataRowStyle` : "navy-bg" pour une ligne chiffrée
 * (fond bleu clair, navy gras), "plain" pour une valeur descriptive (tableau délais).
 */
function twoColTable(
  headerLeft: string,
  headerRight: string,
  rows: [string, string][],
  cols: readonly number[],
  highlightLastN = 0,
  dataRowStyle: "navy-bg" | "plain" = "plain",
): Table {
  const trs: TableRow[] = [tr([tcHeader(headerLeft, cols[0]), tcHeader(headerRight, cols[1])])];
  rows.forEach(([a, b], i) => {
    const isHighlighted = highlightLastN > 0 && i >= rows.length - highlightLastN;
    if (isHighlighted) {
      trs.push(
        tr([
          tc(a, { fill: WHITE, color: GREY_VALUE, width: cols[0] }),
          tc(b, { fill: ORANGE, color: WHITE, bold: true, size: SZ.strong, width: cols[1] }),
        ]),
      );
    } else if (dataRowStyle === "navy-bg") {
      trs.push(
        tr([
          tc(a, { fill: LIGHT_BLUE, color: NAVY, bold: true, width: cols[0] }),
          tc(b, { fill: LIGHT_BLUE, color: NAVY, bold: true, width: cols[1] }),
        ]),
      );
    } else {
      trs.push(tr([tc(a, { fill: WHITE, width: cols[0] }), tc(b, { fill: WHITE, width: cols[1] })]));
    }
  });
  return dataTable(trs, cols);
}

/** Lignes de contenu : fond bleu clair, colonnes 1 (phase) et 2 (montant) navy gras, colonne 3
 * (modalité libre) en gris ; ligne TOTAL : colonne 1 fond navy/blanc gras, colonne 2 fond orange/
 * blanc gras, colonne 3 fond gris clair et vide. Relevé dans les 4 trames. */
function threeColTable(
  h1: string,
  h2: string,
  h3: string,
  rows: [string, string, string][],
  cols: readonly number[],
  highlightLastN = 0,
): Table {
  const trs: TableRow[] = [tr([tcHeader(h1, cols[0]), tcHeader(h2, cols[1]), tcHeader(h3, cols[2])])];
  rows.forEach(([a, b, c], i) => {
    const isHighlighted = highlightLastN > 0 && i >= rows.length - highlightLastN;
    if (isHighlighted) {
      trs.push(
        tr([
          tc(a, { fill: NAVY, color: WHITE, bold: true, width: cols[0] }),
          tc(b, { fill: ORANGE, color: WHITE, bold: true, width: cols[1] }),
          tc(c, { fill: LIGHT_GREY_BLUE, width: cols[2] }),
        ]),
      );
    } else {
      trs.push(
        tr([
          tc(a, { fill: LIGHT_BLUE, color: NAVY, bold: true, width: cols[0] }),
          tc(b, { fill: LIGHT_BLUE, color: NAVY, bold: true, width: cols[1] }),
          tc(c, { fill: LIGHT_BLUE, color: GREY_VALUE, bold: false, width: cols[2] }),
        ]),
      );
    }
  });
  return dataTable(trs, cols);
}

/** Bloc « POUR / REPRÉSENTÉ PAR / … » de la page de garde : 2 colonnes 2551/6787 DXA, teintes
 * alternées (EEF2F7/E8EDF4 pour les libellés, FAFBFC/FFFFFF pour les valeurs) — relevé dans les
 * 4 trames. */
function infoTable(d: OffreRenderData): Table {
  const rows: [string, string][] = [
    ["POUR", [d.clientNom, d.clientDirection].filter(Boolean).join("\n")],
    ["REPRÉSENTÉ PAR", d.clientRepresentant || ""],
    ["DOSSIER ÉTABLI PAR", LVO_SIGNATAIRE],
    ["DATE", d.dateOffre],
    ["RÉFÉRENCE", d.reference],
  ];
  const trs = rows.map(([label, value], i) => {
    const labelFill = i % 2 === 0 ? COLOR.fillGrey1 : LIGHT_BLUE;
    const valueFill = i % 2 === 0 ? COLOR.fillGrey2 : WHITE;
    return tr([
      tc(label, { fill: labelFill, color: NAVY, bold: true, width: POUR_COLS[0] }),
      tc(value, { fill: valueFill, color: GREY_VALUE, width: POUR_COLS[1] }),
    ]);
  });
  return dataTable(trs, POUR_COLS);
}

/** Fine barre navy tout en haut de la première page — un paragraphe vide (espace, corps 2pt)
 * ombré en navy, exactement comme dans les gabarits réels LVO (LVO-MM-26035_CHM.docx,
 * LVO-MOE-26026, LVO-MS-26037 : tous les 3 commencent par cet élément avant même le logo). */
function topBarP(): Paragraph {
  return new Paragraph({
    shading: { type: ShadingType.CLEAR, fill: NAVY },
    children: [new TextRun({ text: " ", size: 4, font: FONT })],
  });
}

// ── Sections ──────────────────────────────────────────────────────────────────

function renderPageDeGarde(d: OffreRenderData): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  out.push(topBarP());
  out.push(imageParagraph(readLogo(), 220, 100));
  out.push(emptyP());
  out.push(p("Experts spécialisés en Études et Conseils Ascenseurs", { size: SZ.strong, color: GREY_TEXT, align: AlignmentType.CENTER }));
  out.push(emptyP());
  out.push(
    centeredBox(ORANGE, BANNER_BORDERS, BANNER_MARGIN, [
      { text: "OFFRE DE SERVICE", size: SZ.banner, bold: true, color: WHITE },
      { text: "Mission Bureau d'Études Ascenseurs", size: SZ.strong, color: WHITE },
      { text: d.missionLabel, size: SZ.strong, bold: true, color: WHITE },
    ]),
  );
  out.push(emptyP());
  out.push(
    centeredBox(LIGHT_BLUE, SITE_BORDERS, SITE_MARGIN, [
      { text: "SITE", size: SZ.note, bold: true, color: GREY_TEXT },
      { text: d.siteNom, size: SZ.siteName, bold: true, color: NAVY },
      { text: d.siteAdresse, size: SZ.strong, color: GREY_TEXT },
    ]),
  );
  out.push(emptyP());
  if (d.sitePhoto) {
    out.push(imageParagraph(d.sitePhoto.data, 260, 150, d.sitePhoto.type));
  } else {
    out.push(calloutBox("[Photo du site — À COMPLÉTER]"));
  }
  out.push(emptyP());
  out.push(infoTable(d));
  return out;
}

function renderCourrier(d: OffreRenderData): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  out.push(p(d.courrierVilleDate, { size: SZ.body }));
  out.push(emptyP());
  out.push(p(d.clientNom, { size: SZ.body, bold: true }));
  if (d.clientDirection) out.push(p(d.clientDirection, { size: SZ.body }));
  out.push(emptyP());
  out.push(p(`À l'attention de ${d.clientRepresentant || ""}`, { size: SZ.body, color: GREY_VALUE }));
  out.push(emptyP());
  out.push(p(`Réf : ${d.reference}`, { size: SZ.body, bold: true }));
  out.push(p(`Objet : ${d.objet}`, { size: SZ.body, bold: true }));
  out.push(emptyP());
  out.push(p(`Mission : ${d.missionLabel}`, { size: SZ.body, bold: true }));
  out.push(emptyP());
  out.push(p(`${d.civiliteAppel},`, { size: SZ.body }));
  out.push(emptyP());
  for (const para of COURRIER_INTRO_PARAGRAPHS) {
    out.push(p(para, { size: SZ.body }));
    out.push(emptyP());
  }
  for (const disc of COURRIER_DISCIPLINES) out.push(bulletP(disc));
  out.push(emptyP());
  for (const para of COURRIER_OUTRO_PARAGRAPHS) {
    out.push(p(para.replace("{{CIVILITE}}", d.civiliteAppel), { size: SZ.body }));
    out.push(emptyP());
  }
  const cachet = readCachet();
  out.push(p(LVO_SIGNATAIRE, { size: SZ.body, bold: true, color: NAVY, keepNext: true }));
  if (cachet) out.push(imageParagraph(cachet, 170, 170, "jpg", { keepNext: true }));
  out.push(p(LVO_SIGNATAIRE_FONCTION, { size: SZ.note, color: GREY_TEXT }));
  return out;
}

function renderDetails(d: OffreRenderData): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  out.push(sectionTitleP("DÉTAILS DE NOTRE OFFRE DE SERVICE"));
  out.push(emptyP());
  out.push(
    p(
      `LVO-INGENIERIE convient de fournir ses services d'assistance, d'étude et de conseil pour ` +
        `les équipements de transports mécaniques du ${d.siteNom} situé ${d.siteAdresse}, comme indiqué ci-après.`,
      { size: SZ.body },
    ),
  );
  out.push(emptyP());
  if (d.missionBody) {
    out.push(...renderBlocks(d.missionBody.blocks));
    out.push(emptyP());
  } else {
    // Types de mission sans corps rédigé figé (ex. ET, legacy) : pas de texte inventé —
    // on affiche la structure attendue (Phase 1 / Phase 2 / délai) en [À COMPLÉTER].
    out.push(p("Phase 1 : [À COMPLÉTER]", { size: SZ.title2, bold: true, color: NAVY }));
    out.push(p("[À COMPLÉTER]", { size: SZ.body }));
    out.push(calloutBox("[À COMPLÉTER]"));
    out.push(p("Phase 2 : [À COMPLÉTER]", { size: SZ.title2, bold: true, color: NAVY }));
    out.push(p("[À COMPLÉTER]", { size: SZ.body }));
    out.push(calloutBox("[À COMPLÉTER]"));
    out.push(emptyP());
  }
  return out;
}

function renderHonoraires(d: OffreRenderData): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  out.push(sectionTitleP("MONTANT DES HONORAIRES"));
  out.push(emptyP());
  out.push(p("Tableau de l'offre", { size: SZ.title2, bold: true, color: NAVY }));
  const cols = tableColsFor(d.typeMission);
  if (d.mmHonoraires) {
    // Cellule par cellule d'après LVO-MM-26035_CHM.docx : ligne de contenu fond bleu clair navy
    // gras ; "TOTAL / an" fond blanc texte gris 9,5 pt ; "Pour l'exercice" fond blanc gris gras
    // 11 pt ; montants fond orange, blanc gras 11 pt.
    const mm = d.mmHonoraires;
    out.push(
      dataTable(
        [
          tr([tcHeader("PRESTATION", cols.honoraires[0]), tcHeader("MONTANT HT", cols.honoraires[1])]),
          tr([
            tc(`MAINTENANCE MANAGEMENT\n${mm.nbAscenseurs} Ascenseurs`, {
              fill: LIGHT_BLUE,
              color: NAVY,
              bold: true,
              width: cols.honoraires[0],
            }),
            tc(`${money(mm.prixUnitaireMoisHt)} HT/Mois/Ascenseur`, {
              fill: LIGHT_BLUE,
              color: NAVY,
              bold: true,
              width: cols.honoraires[1],
            }),
          ]),
          tr([
            tc("TOTAL / an", { fill: WHITE, color: GREY_VALUE, width: cols.honoraires[0] }),
            tc(`${money(mm.totalAn)} HT`, {
              fill: ORANGE,
              color: WHITE,
              bold: true,
              size: SZ.strong,
              width: cols.honoraires[1],
            }),
          ]),
          tr([
            tc(`Pour l'exercice ${mm.annee},`, {
              fill: WHITE,
              color: GREY_VALUE,
              bold: true,
              size: SZ.strong,
              width: cols.honoraires[0],
            }),
            tc(`${money(mm.exerciceMontant)} HT`, {
              fill: ORANGE,
              color: WHITE,
              bold: true,
              size: SZ.strong,
              width: cols.honoraires[1],
            }),
          ]),
        ],
        cols.honoraires,
      ),
    );
  } else if (d.auditHonoraires) {
    const audit = d.auditHonoraires;
    out.push(
      twoColTable(
        "PRESTATION",
        "MONTANT HT",
        [
          [audit.libelle, `${money(audit.prixUnitaireHt)} HT / Ascenseur`],
          ["TOTAL", `${money(audit.montantHt)} HT`],
        ],
        cols.honoraires,
        1,
        "navy-bg",
      ),
    );
  } else {
    out.push(
      twoColTable(
        "PRESTATION",
        "MONTANT HT",
        [...d.honoraires.map((h) => [h.libelle, money(h.montant)] as [string, string]), ["TOTAL", `${money(d.totalHt)} HT`]],
        cols.honoraires,
        1,
        "navy-bg",
      ),
    );
  }
  out.push(emptyP());
  // Encart coût : dans les trames, les 3 lignes (coût horaire/journalier, TVA, validité) sont
  // DANS la même cellule sur fond #F4F6F9 — pas des paragraphes séparés sous l'encart.
  out.push(
    boxTable(LIGHT_GREY_BLUE, CELL_BORDERS, COUT_MARGIN, [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `Coût horaire LVO-INGENIERIE : ${money(d.coutHoraire)} HT       |       Coût Journalier : ${money(d.coutJournalier)} HT`,
            size: SZ.cell,
            bold: true,
            color: NAVY,
            font: FONT,
          }),
        ],
      }),
      new Paragraph({
        children: [new TextRun({ text: `TVA applicable : ${d.tva} %`, size: SZ.note, color: GREY_TEXT, font: FONT })],
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Offre valable ${d.validite} — Révisable selon l'indice SYNTEC.`,
            size: SZ.note,
            color: GREY_TEXT,
            font: FONT,
          }),
        ],
      }),
    ]),
  );
  out.push(emptyP());
  out.push(p("Échéancier de facturation", { size: SZ.title2, bold: true, color: NAVY }));
  const echeancierTotal = d.echeancier.reduce((s, e) => s + (Number(e.montant) || 0), 0);
  out.push(
    threeColTable(
      "PHASE",
      "MONTANT HT",
      "FACTURATION — ÉCHÉANCIER",
      d.echeancier.length
        ? [
            ...d.echeancier.map((e) => [e.phase, money(e.montant), e.modalite] as [string, string, string]),
            ["TOTAL", `${money(echeancierTotal)}`, ""],
          ]
        : [["[À COMPLÉTER]", "[À COMPLÉTER]", "[À COMPLÉTER]"]],
      cols.echeancier,
      d.echeancier.length ? 1 : 0,
    ),
  );
  return out;
}

function renderDelais(d: OffreRenderData): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  out.push(sectionTitleP("DÉLAIS ET CALENDRIER PRÉVISIONNEL"));
  out.push(emptyP());
  const rows: [string, string][] = d.delais.length
    ? d.delais.map((l) => [l.prestation, l.delai] as [string, string])
    : [["[À COMPLÉTER]", "[À COMPLÉTER]"]];
  out.push(twoColTable("PRESTATION", "DÉLAI PRÉVISIONNEL", rows, tableColsFor(d.typeMission).delais));
  return out;
}

/**
 * Tableau de signatures : 2 colonnes séparées par une colonne d'espacement de 320 DXA SANS filet
 * (relevé identique sur les 4 trames), 6 lignes — en-tête, « Accepté par », « Fonction », « Date »,
 * « Signature & cachet », puis une ligne vide qui accueille le cachet côté LVO.
 */
function renderSignatures(d: OffreRenderData): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  out.push(sectionTitleP("ORDRE DE MISSION — SIGNATURES"));
  out.push(emptyP());

  const [wLeft, wGap, wRight] = SIGNATURE_COLS;
  const spacer = () =>
    new TableCell({
      width: { size: wGap, type: WidthType.DXA },
      borders: NO_BORDERS,
      margins: CELL_MARGIN,
      verticalAlign: VerticalAlign.CENTER,
      shading: { type: ShadingType.CLEAR, fill: WHITE },
      children: [new Paragraph({ children: [] })],
    });

  /** Ligne « libellé client | espace | libellé LVO » avec le fond alterné des trames. */
  const sigRow = (
    left: string,
    right: string,
    fill: string,
    opts: { rightPlain?: boolean; rightChildren?: Paragraph[] } = {},
  ) =>
    tr([
      tc(left, { fill, color: NAVY, bold: true, width: wLeft }),
      spacer(),
      opts.rightChildren
        ? new TableCell({
            width: { size: wRight, type: WidthType.DXA },
            borders: CELL_BORDERS,
            margins: CELL_MARGIN,
            verticalAlign: VerticalAlign.CENTER,
            shading: { type: ShadingType.CLEAR, fill },
            children: opts.rightChildren,
          })
        : tc(right, {
            fill,
            color: opts.rightPlain ? GREY_VALUE : NAVY,
            bold: !opts.rightPlain,
            width: wRight,
          }),
    ]);

  const cachet = readCachet();
  out.push(
    dataTable(
      [
        tr([tcHeader("LE CLIENT", wLeft), spacer(), tcHeader("LVO-INGENIERIE", wRight)]),
        sigRow("Accepté par :", `Accepté par :  Mr ${LVO_SIGNATAIRE}`, LIGHT_BLUE),
        sigRow("Fonction :", `Fonction : ${LVO_SIGNATAIRE_FONCTION}`, WHITE, { rightPlain: true }),
        sigRow("Date :", `Date :  ${d.dateOffre}`, LIGHT_BLUE, { rightPlain: true }),
        sigRow("Signature & cachet", "Signature & cachet", WHITE),
        sigRow("", "", WHITE, {
          rightChildren: cachet ? [imageParagraph(cachet, 170, 170)] : [new Paragraph({ children: [] })],
        }),
      ],
      SIGNATURE_COLS,
    ),
  );
  return out;
}

function renderCgv(d: OffreRenderData): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  out.push(sectionTitleP("INFORMATIONS ET CONDITIONS GÉNÉRALES DE VENTES"));
  out.push(emptyP());
  out.push(p("Introduction", { size: SZ.title2, bold: true, color: NAVY }));
  out.push(p(CGV_INTRODUCTION, { size: SZ.note }));
  out.push(emptyP());
  for (const b of CGV_BLOCKS) {
    const block = b.type === "paragraph" ? { ...b, text: b.text.replace("{{TVA}}", String(d.tva)) } : b;
    out.push(renderBlock(block));
  }
  return out;
}

/** En-tête riche (logo + adresse) utilisée sur toutes les pages SAUF la page de garde — courrier,
 * détails, honoraires, délais, signatures et CGV. Confirmé par la position réelle du saut de
 * section dans LVO-MM-26035_CHM.docx (et LVO-MOE-26026, LVO-MS-26037) : il tombe juste après le
 * tableau d'informations de la page de garde, pas juste avant les CGV comme d'abord supposé —
 * la page de garde est seule dans sa section (sans en-tête/pied de page), tout le reste partage
 * cette section unique avec cet en-tête. */
function pageHeader(): Header {
  const table = new Table({
    width: { size: 9026, type: WidthType.DXA },
    borders: { ...NO_BORDERS, insideHorizontal: NO_BORDERS.top, insideVertical: NO_BORDERS.top },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 3500, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                children: [new ImageRun({ data: readLogo(), transformation: { width: 150, height: 75 }, type: "jpg" })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 5526, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: "Centre d'affaires CADJEE — 62 Bd du Chaudron", size: SZ.runningHead, color: GREY_TEXT, font: FONT })],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: "97491 Saint-Denis La Réunion  |  Tél : 06 92 05 39 52", size: SZ.runningHead, color: GREY_TEXT, font: FONT })],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: "hatem.lembarki@lvo-ing.com", size: SZ.runningHead, color: ORANGE, font: FONT })],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const ruleP = new Paragraph({
    spacing: { before: 80, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: NAVY, space: 0 } },
    children: [],
  });

  return new Header({ children: [table, ruleP] });
}

/** Pied de page riche (référence + n° de page), sur les mêmes pages que `pageHeader` (tout sauf
 * la page de garde). Reprend le filet gris + tabulation centre/droite vus dans les gabarits réels
 * (pas de "/ total pages", juste "Page N"). */
function pageFooter(d: OffreRenderData): Footer {
  return new Footer({
    children: [
      new Paragraph({
        spacing: { before: 80 },
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: GREY_TEXT, space: 0 } },
        tabStops: [
          { type: TabStopType.CENTER, position: 4500 },
          { type: TabStopType.RIGHT, position: 9026 },
        ],
        children: [
          new TextRun({
            children: [
              `LVO-INGENIERIE — ${d.reference} — Offre de Service — ${d.siteNom}`,
              new Tab(),
              "Page ",
              PageNumber.CURRENT,
            ],
            size: SZ.runningHead,
            color: GREY_TEXT,
            font: FONT,
          }),
        ],
      }),
    ],
  });
}

export async function renderOffreDocx(d: OffreRenderData): Promise<Buffer> {
  // Corps du document à partir du courrier (inclus jusqu'aux CGV) — toutes ces pages partagent
  // le même en-tête/pied de page riches (cf. cgvHeader/cgvFooter). Seule la page de garde en est
  // dépourvue. Confirmé par la position réelle du saut de section dans LVO-MM-26035_CHM.docx :
  // il tombe juste après le tableau d'informations de la page de garde, avant le courrier —
  // pas juste avant les CGV comme précédemment supposé.
  const restBody: (Paragraph | Table)[] = [
    ...renderCourrier(d),
    pageBreak(),
    ...renderDetails(d),
    pageBreak(),
    ...renderHonoraires(d),
    pageBreak(),
    ...renderDelais(d),
    pageBreak(),
    ...renderSignatures(d),
    pageBreak(),
    ...renderCgv(d),
  ];

  const doc = new Document({
    // Police par défaut du document — filet de sécurité pour que tout texte qui n'aurait pas
    // explicitement `font: "Arial"` (ex. rendu interne d'un champ Word comme le numéro de page)
    // reste cohérent avec le reste du document plutôt que de retomber sur la police par défaut
    // de docx/Word (Calibri).
    styles: {
      default: {
        document: {
          run: { font: FONT },
        },
      },
    },
    sections: [
      {
        // Page de garde seule : aucun en-tête/pied de page, marges "serrées" — conforme aux
        // gabarits réels.
        properties: {
          page: { margin: { top: 1440, bottom: 993, left: 1440, right: 1440 } },
        },
        children: renderPageDeGarde(d),
      },
      {
        // Courrier → CGV : marges plus généreuses (pour laisser la place à l'en-tête riche)
        // + en-tête/pied de page dédiés (cf. cgvHeader/cgvFooter) sur toutes ces pages.
        properties: {
          page: { margin: { top: 1700, bottom: 1134, left: 1440, right: 1440 } },
        },
        headers: { default: pageHeader() },
        footers: { default: pageFooter(d) },
        children: restBody,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
