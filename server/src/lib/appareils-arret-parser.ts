import * as XLSX from "xlsx";

// Selon l'interop ESM/CJS, XLSX.SSF peut se retrouver sous XLSX.default.SSF.
const SSF = ((XLSX as unknown as { SSF?: typeof XLSX.SSF }).SSF ??
  (XLSX as unknown as { default?: { SSF?: typeof XLSX.SSF } }).default?.SSF) as typeof XLSX.SSF;

export type ParsedAppareilArretRow = {
  numeroAppareil: string;
  clientNom: string;
  adresse: string | null;
  dateArret: string | null;
  cause: string | null;
  etape: string | null;
  piecesEnStock: boolean | null;
  devisNumero: string | null;
  devisDate: string | null;
  validationDate: string | null;
  osNumero: string | null;
  executionDate: string | null;
  remiseDate: string | null;
  commentaire: string | null;
};

export type ParseAppareilsArretResult = {
  weekStart: string;
  weekEnd: string;
  rows: ParsedAppareilArretRow[];
  errors: string[];
};

function normalizeLabel(v: unknown): string {
  if (v == null) return "";
  return String(v)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  return s.length > 0 ? s : null;
}

function parseDateCell(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  return cleanText(v);
}

function parsePiecesEnStock(v: unknown): boolean | null {
  const s = normalizeLabel(v);
  if (!s) return null;
  const hasOui = /\boui\b/.test(s);
  const hasNon = /\bnon\b/.test(s);
  if (hasOui && !hasNon) return true;
  if (hasNon && !hasOui) return false;
  return null;
}

type MappableField = Exclude<keyof ParsedAppareilArretRow, "numeroAppareil" | "clientNom" | "adresse">;

/** Détermine, à partir du libellé combiné (en-tête + sous-en-tête fusionnés), le champ associé à une colonne. */
function matchField(label: string): MappableField | null {
  if (!label) return null;
  if (label.includes("numero d'os") || label.includes("numero dos") || label.includes("n d'os")) return "osNumero";
  if (label.includes("devis") && label.includes("envoi")) return "devisDate";
  if (label.includes("devis") && (label.includes("numero") || label.includes("n°"))) return "devisNumero";
  if (label.includes("validation") && label.includes("client")) return "validationDate";
  if ((label.includes("piece") || label.includes("pièce")) && label.includes("stock")) return "piecesEnStock";
  if (label.includes("etape")) return "etape";
  if (label.includes("remise en service") && (label.includes("effective") || label.includes("execution"))) return "remiseDate";
  if (label.includes("intervention")) return "executionDate";
  if (label.includes("date de mise") && label.includes("arret")) return "dateArret";
  if (label === "cause" || label.includes("cause")) return "cause";
  if (label.includes("commentaire") || label.includes("observation")) return "commentaire";
  return null;
}

function findHeaderRow(rows: unknown[][]): number | null {
  const limit = Math.min(rows.length, 8);
  for (let i = 0; i < limit; i++) {
    const row = rows[i] ?? [];
    const hasClient = row.some((c) => normalizeLabel(c) === "client");
    const hasAscenseur = row.some((c) => /^(ascenseur|appareil)$/.test(normalizeLabel(c)));
    if (hasClient && hasAscenseur) return i;
  }
  return null;
}

function forwardFillMerges(row: unknown[], merges: XLSX.Range[], rowIndex: number): unknown[] {
  const filled = [...row];
  for (const merge of merges) {
    if (merge.s.r !== rowIndex) continue;
    const value = filled[merge.s.c];
    for (let c = merge.s.c + 1; c <= merge.e.c; c++) {
      if (filled[c] == null) filled[c] = value;
    }
  }
  return filled;
}

function mondayOf(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function detectWeek(rawRows: unknown[][], parsedDates: string[]): { weekStart: string; weekEnd: string } {
  for (const row of rawRows.slice(0, 3)) {
    for (const cell of row) {
      if (typeof cell !== "string") continue;
      const m = cell.match(/le\s*:?\s*(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/i);
      if (m) {
        const [, dd, mm, yyRaw] = m;
        const yyyy = yyRaw.length === 2 ? Number(yyRaw) + 2000 : Number(yyRaw);
        const d = new Date(yyyy, Number(mm) - 1, Number(dd));
        const monday = mondayOf(d);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return { weekStart: toIsoDate(monday), weekEnd: toIsoDate(sunday) };
      }
    }
  }

  const validDates = parsedDates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const latest = validDates[validDates.length - 1];
  const ref = latest ? new Date(`${latest}T12:00:00`) : new Date();
  const monday = mondayOf(ref);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { weekStart: toIsoDate(monday), weekEnd: toIsoDate(sunday) };
}

export function parseAppareilsArretExcel(buffer: Buffer): ParseAppareilsArretResult {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const errors: string[] = [];

  if (!ws) {
    return { weekStart: toIsoDate(mondayOf(new Date())), weekEnd: "", rows: [], errors: ["Feuille introuvable dans le fichier"] };
  }

  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });
  const headerRowIdx = findHeaderRow(rawRows);
  if (headerRowIdx == null) {
    return {
      weekStart: toIsoDate(mondayOf(new Date())),
      weekEnd: toIsoDate(mondayOf(new Date())),
      rows: [],
      errors: ["En-tête non reconnue (colonnes Client / Ascenseur introuvables)"],
    };
  }

  const merges = (ws["!merges"] ?? []) as XLSX.Range[];
  const headerRow1 = forwardFillMerges(rawRows[headerRowIdx] ?? [], merges, headerRowIdx);
  const headerRow2 = rawRows[headerRowIdx + 1] ?? [];
  const dataStartIdx = headerRowIdx + 2;

  const numCols = Math.max(headerRow1.length, headerRow2.length, 20);
  const colIndex: Partial<Record<MappableField, number>> = {};
  let clientCol = -1;
  let ascenseurCol = -1;
  let adresseCol = -1;

  for (let c = 0; c < numCols; c++) {
    const single = normalizeLabel(headerRow1[c]);
    if (single === "client") clientCol = c;
    else if (/^(ascenseur|appareil)$/.test(single)) ascenseurCol = c;
    else if (/^adresses?$/.test(single)) adresseCol = c;
  }

  for (let c = 0; c < numCols; c++) {
    if (c === clientCol || c === ascenseurCol || c === adresseCol) continue;
    const combined = `${normalizeLabel(headerRow1[c])} ${normalizeLabel(headerRow2[c])}`.trim();
    const field = matchField(combined);
    if (field) colIndex[field] = c;
  }

  if (clientCol === -1 || ascenseurCol === -1) {
    return { weekStart: "", weekEnd: "", rows: [], errors: ["Colonnes Client / Ascenseur introuvables"] };
  }

  const rows: ParsedAppareilArretRow[] = [];
  const dateCandidates: string[] = [];

  for (let r = dataStartIdx; r < rawRows.length; r++) {
    const row = rawRows[r] ?? [];
    const clientNom = cleanText(row[clientCol]);
    const numeroAppareil = cleanText(row[ascenseurCol]);
    if (!clientNom || !numeroAppareil) continue;

    try {
      const dateArret = colIndex.dateArret != null ? parseDateCell(row[colIndex.dateArret]) : null;
      if (dateArret) dateCandidates.push(dateArret);

      rows.push({
        numeroAppareil,
        clientNom,
        adresse: adresseCol !== -1 ? cleanText(row[adresseCol]) : null,
        dateArret,
        cause: colIndex.cause != null ? cleanText(row[colIndex.cause]) : null,
        etape: colIndex.etape != null ? cleanText(row[colIndex.etape]) : null,
        piecesEnStock: colIndex.piecesEnStock != null ? parsePiecesEnStock(row[colIndex.piecesEnStock]) : null,
        devisNumero: colIndex.devisNumero != null ? cleanText(row[colIndex.devisNumero]) : null,
        devisDate: colIndex.devisDate != null ? parseDateCell(row[colIndex.devisDate]) : null,
        validationDate: colIndex.validationDate != null ? parseDateCell(row[colIndex.validationDate]) : null,
        osNumero: colIndex.osNumero != null ? cleanText(row[colIndex.osNumero]) : null,
        executionDate: colIndex.executionDate != null ? parseDateCell(row[colIndex.executionDate]) : null,
        remiseDate: colIndex.remiseDate != null ? parseDateCell(row[colIndex.remiseDate]) : null,
        commentaire: colIndex.commentaire != null ? cleanText(row[colIndex.commentaire]) : null,
      });
    } catch (e) {
      errors.push(`Ligne ${r + 1} : ${(e as Error).message}`);
    }
  }

  const { weekStart, weekEnd } = detectWeek(rawRows, dateCandidates);
  return { weekStart, weekEnd, rows, errors };
}
