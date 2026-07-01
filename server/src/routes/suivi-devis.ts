import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import * as XLSX from "xlsx";

export const suiviDevisRouter = express.Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EXCEL_PATH = path.resolve(__dirname, "..", "..", "uploads", "Suivi des devis Groupement.xlsx");

// Noms des colonnes dans l'ordre du fichier Excel (col B à Q)
const SHEET_YEARS = ["annee 2023", "annee 2024", "Annee 2025", "Annee 2026"];

export type SuiviDevisRow = {
  id: string;
  annee: number;
  numeroDevis: string | null;
  entreprise: string | null;
  dateDevis: string | null;
  numeroAppareil: string | null;
  client: string | null;
  batiment: string | null;
  montantHt: number | null;
  objet: string | null;
  cause: string | null;
  ascenseurArret: boolean | null;
  avisLvo: string | null;
  estimatifLvoHt: number | null;
  devisNegocie: string | null;
  numeroDevisNegocie: string | null;
  economie: number | null;
  observations: string | null;
};

function parseDate(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function parseNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return isFinite(n) ? n : null;
}

function parseStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function parseArret(v: unknown): boolean | null {
  if (v == null) return null;
  const s = String(v).toLowerCase().trim();
  if (s === "oui" || s === "yes" || s === "true" || s === "1") return true;
  if (s === "non" || s === "no" || s === "false" || s === "0") return false;
  return null;
}

function loadSheet(wb: XLSX.WorkBook, sheetName: string, annee: number): SuiviDevisRow[] {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  const result: SuiviDevisRow[] = [];
  let idx = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] as (unknown)[];
    // Col A=0 (vide), B=1 (devis), C=2 (entreprise)... jusqu'à Q=16
    const numeroDevis = parseStr(r[1]);
    const entreprise = parseStr(r[2]);
    const dateDevis = parseDate(r[3]);
    const numeroAppareil = parseStr(r[4]);
    const client = parseStr(r[5]);
    const batiment = parseStr(r[6]);
    const montantHt = parseNum(r[7]);
    const objet = parseStr(r[8]);
    const cause = parseStr(r[9]);
    const ascenseurArret = parseArret(r[10]);
    const avisLvo = parseStr(r[11]);
    const estimatifLvoHt = parseNum(r[12]);
    const devisNegocie = parseStr(r[13]);
    const numeroDevisNegocie = parseStr(r[14]);
    const economie = parseNum(r[15]);
    const observations = parseStr(r[16]);

    // Skip totalement vides
    if (!numeroDevis && !entreprise && !montantHt && !objet) continue;

    result.push({
      id: `${annee}-${++idx}`,
      annee,
      numeroDevis,
      entreprise,
      dateDevis,
      numeroAppareil,
      client,
      batiment,
      montantHt,
      objet,
      cause,
      ascenseurArret,
      avisLvo,
      estimatifLvoHt,
      devisNegocie,
      numeroDevisNegocie,
      economie,
      observations,
    });
  }
  return result;
}

let cache: { ts: number; data: Record<number, SuiviDevisRow[]> } | null = null;
const CACHE_TTL = 60_000; // 1 min

function loadAll(): Record<number, SuiviDevisRow[]> {
  if (cache && Date.now() - cache.ts < CACHE_TTL) return cache.data;
  if (!fs.existsSync(EXCEL_PATH)) {
    console.warn("[suivi-devis] Fichier Excel introuvable :", EXCEL_PATH);
    return {};
  }
  const wb = XLSX.readFile(EXCEL_PATH, { cellDates: false, dense: false });
  const data: Record<number, SuiviDevisRow[]> = {};
  const years = [2023, 2024, 2025, 2026];
  for (let i = 0; i < SHEET_YEARS.length; i++) {
    data[years[i]] = loadSheet(wb, SHEET_YEARS[i], years[i]);
  }
  cache = { ts: Date.now(), data };
  return data;
}

// GET /api/suivi-devis — toutes les années
suiviDevisRouter.get("/suivi-devis", (_req, res) => {
  try {
    const data = loadAll();
    const totals: Record<number, { count: number; totalHt: number; totalEco: number }> = {};
    for (const [yr, rows] of Object.entries(data)) {
      const y = Number(yr);
      totals[y] = {
        count: rows.length,
        totalHt: rows.reduce((s, r) => s + (r.montantHt ?? 0), 0),
        totalEco: rows.reduce((s, r) => s + (r.economie ?? 0), 0),
      };
    }
    res.json({ rows: data, totals });
  } catch (e) {
    console.error("[suivi-devis] Erreur lecture Excel :", e);
    res.status(500).json({ error: "Erreur lecture fichier Excel" });
  }
});

// GET /api/suivi-devis/:annee — une année
suiviDevisRouter.get("/suivi-devis/:annee", (req, res) => {
  const annee = Number(req.params.annee);
  if (!SHEET_YEARS.some((_, i) => [2023, 2024, 2025, 2026][i] === annee)) {
    res.status(400).json({ error: "Année invalide (2023–2026)" });
    return;
  }
  try {
    const data = loadAll();
    res.json({ rows: data[annee] ?? [], annee });
  } catch (e) {
    console.error("[suivi-devis] Erreur lecture Excel :", e);
    res.status(500).json({ error: "Erreur lecture fichier Excel" });
  }
});
