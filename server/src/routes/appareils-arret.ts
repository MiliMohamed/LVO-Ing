import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import express from "express";
import multer from "multer";
import ExcelJS from "exceljs";

import type { AuthedRequest } from "../middleware.js";
import {
  appareils,
  appareilsArretUploads,
  appareilsArretRows,
  type AppareilRow,
  type AppareilArretUploadRow,
  type AppareilArretRow,
} from "../store.js";
import { getMinio, MINIO_BUCKETS } from "../db.js";
import { schedulePersistStore } from "../store-persist.js";
import { parseAppareilsArretExcel } from "../lib/appareils-arret-parser.js";
import { sendMail, getAdminEmails, getClientEmails, renderMailHtml } from "../lib/mailer.js";
import { barChartSvg, pieChartSvg, type ChartSlice } from "../excel-charts.js";
import { NAVY, ORANGE, addBrandBanner, addImageFromSvg, styleHeaderRow, zebraStripe } from "../lib/excel-style.js";

const RED = "FFDC2626";
const GREEN = "FF16A34A";
const BLUE = "FF2563EB";

function nextId(arr: { id: number }[]): number {
  return Math.max(0, ...arr.map((x) => x.id), 0) + 1;
}

function fmtDateFr(v: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return new Date(`${v}T12:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  }
  return v;
}

/** Notifie l'admin (toujours) et chaque client concerné (un email par client) après un dépôt de tableau. */
function notifyAppareilsArretUpload(
  entreprise: string,
  upload: AppareilArretUploadRow,
  rows: AppareilArretRow[]
): void {
  const period = `du ${fmtDateFr(upload.weekStart)} au ${fmtDateFr(upload.weekEnd)}`;
  const clients = [...new Set(rows.map((r) => r.clientNom))];

  void sendMail({
    to: getAdminEmails(),
    subject: `[LVO] Nouveau tableau "Appareils à l'arrêt" — ${entreprise}`,
    html: renderMailHtml(
      "Nouveau tableau « Appareils à l'arrêt »",
      `<p><strong>${entreprise}</strong> a déposé son tableau hebdomadaire (${period}).</p>
       <p>${rows.length} appareil(s) signalé(s) pour ${clients.length} client(s) : ${clients.join(", ")}.</p>`
    ),
  });

  for (const clientNom of clients) {
    const emails = getClientEmails(clientNom);
    if (emails.length === 0) continue;
    const clientRows = rows.filter((r) => r.clientNom === clientNom);
    const items = clientRows
      .map((r) => `<li>${r.numeroAppareil}${r.adresse ? ` — ${r.adresse}` : ""}${r.cause ? ` (${r.cause})` : ""}</li>`)
      .join("");
    void sendMail({
      to: emails,
      subject: `[LVO] Appareils à l'arrêt — semaine ${period}`,
      html: renderMailHtml(
        "Vos appareils à l'arrêt",
        `<p>Votre ascensoriste <strong>${entreprise}</strong> a transmis le suivi des appareils à l'arrêt pour la semaine ${period}.</p>
         <ul>${items}</ul>
         <p>Consultez le détail (causes, devis, dates de remise en service) dans votre espace client.</p>`
      ),
    });
  }
}

// ─── Routes admin (CRM) — montées sur le routeur devisGroupementRouter ───────

export const appareilsArretRouter = express.Router();

// GET /api/appareils-arret — toutes les lignes, filtrables par semaine/client/ascensoriste
appareilsArretRouter.get("/appareils-arret", (req: AuthedRequest, res) => {
  const { weekStart, clientNom, entreprise } = req.query as Record<string, string | undefined>;
  let list = [...appareilsArretRows];
  if (weekStart) list = list.filter((r) => r.weekStart === weekStart);
  if (clientNom) list = list.filter((r) => r.clientNom === clientNom);
  if (entreprise) list = list.filter((r) => r.entreprise === entreprise);
  list.sort((a, b) => b.weekStart.localeCompare(a.weekStart) || a.clientNom.localeCompare(b.clientNom));
  res.json(list);
});

// GET /api/appareils-arret/weeks — semaines distinctes disponibles
appareilsArretRouter.get("/appareils-arret/weeks", (_req: AuthedRequest, res) => {
  const weeks = [...new Set(appareilsArretRows.map((r) => r.weekStart))].sort((a, b) => b.localeCompare(a));
  res.json(weeks);
});

// ─── Export Excel (détail + statistiques par ascensoriste / date / motif) ───

function countBy(rows: AppareilArretRow[], pick: (r: AppareilArretRow) => string | null): ChartSlice[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = pick(r) ?? "Non renseigné";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

type SyntheseData = {
  total: number;
  enArret: number;
  enFonction: number;
  pctArret: number;
  pctFonction: number;
  parEntreprise: { entreprise: string; total: number; arret: number; pct: number }[];
  parCause: ChartSlice[];
};

/** Synthèse calculée sur l'état courant des appareils (enArret), pas sur le journal hebdomadaire. */
function buildSyntheseData(appareilsScope: AppareilRow[], rows: AppareilArretRow[]): SyntheseData {
  const total = appareilsScope.length;
  const enArretList = appareilsScope.filter((a) => a.enArret);
  const enArret = enArretList.length;
  const enFonction = total - enArret;

  const byEntreprise = new Map<string, { total: number; arret: number }>();
  for (const a of appareilsScope) {
    const key = a.entreprise ?? "Non renseigné";
    const e = byEntreprise.get(key) ?? { total: 0, arret: 0 };
    e.total += 1;
    if (a.enArret) e.arret += 1;
    byEntreprise.set(key, e);
  }
  const parEntreprise = [...byEntreprise.entries()]
    .map(([entreprise, v]) => ({ entreprise, total: v.total, arret: v.arret, pct: v.total > 0 ? (v.arret / v.total) * 100 : 0 }))
    .sort((a, b) => b.arret - a.arret);

  // Cause la plus récente connue pour chaque appareil actuellement à l'arrêt.
  const latestRowByAppareil = new Map<number, AppareilArretRow>();
  for (const r of rows) {
    if (r.appareilId == null) continue;
    const cur = latestRowByAppareil.get(r.appareilId);
    if (!cur || r.weekStart > cur.weekStart) latestRowByAppareil.set(r.appareilId, r);
  }
  const causeCounts = new Map<string, number>();
  for (const a of enArretList) {
    const cause = latestRowByAppareil.get(a.id)?.cause?.trim() || "Non renseigné";
    causeCounts.set(cause, (causeCounts.get(cause) ?? 0) + 1);
  }
  const parCause = [...causeCounts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

  return {
    total,
    enArret,
    enFonction,
    pctArret: total > 0 ? (enArret / total) * 100 : 0,
    pctFonction: total > 0 ? (enFonction / total) * 100 : 0,
    parEntreprise,
    parCause,
  };
}

async function addSyntheseSheet(
  workbook: ExcelJS.Workbook,
  logoImageId: number,
  genDate: string,
  subtitle: string,
  syn: SyntheseData
): Promise<void> {
  const ws = workbook.addWorksheet("Synthèse", { properties: { tabColor: { argb: RED } } });
  ws.columns = Array.from({ length: 10 }, () => ({ width: 14 }));
  addBrandBanner(ws, logoImageId, "Synthèse — Appareils à l'arrêt", `${subtitle} — Généré le ${genDate}`, "J");

  const HEADER_ROW = 4;
  let r = HEADER_ROW;

  function kpiRow(label: string, count: number, pctLabel: string, pct: number | null, fill: string) {
    ws.mergeCells(`C${r}:D${r}`);
    const countCell = ws.getCell(`C${r}`);
    countCell.value = count;
    countCell.font = { bold: true, size: 14 };
    countCell.alignment = { horizontal: "center", vertical: "middle" };

    ws.mergeCells(`E${r}:G${r}`);
    const labelCell = ws.getCell(`E${r}`);
    labelCell.value = label;
    labelCell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    labelCell.alignment = { horizontal: "center", vertical: "middle" };
    countCell.fill = labelCell.fill;

    if (pct != null) {
      const pctCell = ws.getCell(`H${r}`);
      pctCell.value = pct / 100;
      pctCell.numFmt = "0.00%";
      pctCell.font = { bold: true };
      pctCell.alignment = { horizontal: "center" };
    } else {
      ws.getCell(`H${r}`).value = pctLabel;
      ws.getCell(`H${r}`).font = { bold: true };
    }
    ws.getRow(r).height = 20;
    r += 1;
  }

  ws.getCell(`H${HEADER_ROW - 1}`).value = "% app. arrêt";
  ws.getCell(`H${HEADER_ROW - 1}`).font = { bold: true, color: { argb: NAVY } };

  kpiRow("Appareils au total", syn.total, "", null, BLUE);
  kpiRow("Appareils à l'arrêt SOIT", syn.enArret, "", syn.pctArret, RED);
  kpiRow("Appareils en fonction SOIT", syn.enFonction, "", syn.pctFonction, GREEN);

  r += 1;
  const entHeaderRow = r;
  ws.getRow(r).values = ["Ascensoriste", "À l'arrêt", "", "Total", "", "% à l'arrêt"];
  styleHeaderRow(ws.getRow(r), 6);
  r += 1;
  for (const e of syn.parEntreprise) {
    ws.getCell(`A${r}`).value = `Appareil à l'arrêt ${e.entreprise}`;
    ws.getCell(`B${r}`).value = e.arret;
    ws.getCell(`C${r}`).value = "SUR";
    ws.getCell(`C${r}`).alignment = { horizontal: "center" };
    ws.getCell(`D${r}`).value = e.total;
    ws.getCell(`F${r}`).value = e.pct / 100;
    ws.getCell(`F${r}`).numFmt = "0.00%";
    r += 1;
  }
  zebraStripe(ws, entHeaderRow + 1, r - 1, 6);

  r += 1;
  const causeHeaderRow = r;
  for (const c of syn.parCause) {
    ws.getCell(`A${r}`).value = "dont";
    ws.getCell(`A${r}`).font = { bold: true };
    ws.getCell(`B${r}`).value = c.value;
    ws.getCell(`B${r}`).font = { bold: true };
    ws.getCell(`B${r}`).alignment = { horizontal: "center" };
    ws.getCell(`C${r}`).value = `à l'arrêt : ${c.label}`;
    r += 1;
  }
  if (syn.parCause.length > 0) zebraStripe(ws, causeHeaderRow, r - 1, 3);

  // Représentations graphiques (camembert) des pourcentages, en complément des tableaux.
  await addImageFromSvg(
    workbook,
    ws,
    pieChartSvg("Appareils à l'arrêt / en fonction", [
      { label: "À l'arrêt", value: syn.enArret, color: "#dc2626" },
      { label: "En fonction", value: syn.enFonction, color: "#16a34a" },
    ]),
    0,
    r + 1
  );
  await addImageFromSvg(
    workbook,
    ws,
    pieChartSvg(
      "Répartition des appareils à l'arrêt par ascensoriste",
      syn.parEntreprise.filter((e) => e.arret > 0).map((e) => ({ label: e.entreprise, value: e.arret }))
    ),
    5,
    r + 1
  );
}

async function buildAppareilsArretWorkbook(
  rows: AppareilArretRow[],
  appareilsScope: AppareilRow[],
  opts: { title: string; subtitle: string; includeClientColumn: boolean }
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "LVO Ingénierie";
  workbook.created = new Date();

  const logoBuffer = fs.readFileSync(path.resolve("assets", "logo-lvo.jpg"));
  const logoImageId = workbook.addImage({ buffer: logoBuffer as unknown as ExcelJS.Buffer, extension: "jpeg" });
  const genDate = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const HEADER_ROW = 4;

  // ── Feuille Synthèse ────────────────────────────────────────────────────
  const syn = buildSyntheseData(appareilsScope, rows);
  await addSyntheseSheet(workbook, logoImageId, genDate, opts.subtitle, syn);

  // ── Feuille Détail ──────────────────────────────────────────────────────
  const wsDetail = workbook.addWorksheet("Détail", { properties: { tabColor: { argb: NAVY } } });
  const detailCols = [
    ...(opts.includeClientColumn ? [{ key: "clientNom", width: 16, header: "Client" }] : []),
    { key: "entreprise", width: 18, header: "Ascensoriste" },
    { key: "numeroAppareil", width: 14, header: "Appareil" },
    { key: "adresse", width: 26, header: "Adresse" },
    { key: "dateArret", width: 14, header: "Date d'arrêt" },
    { key: "cause", width: 22, header: "Motif de panne" },
    { key: "etape", width: 18, header: "Étape" },
    { key: "devisNumero", width: 14, header: "N° devis" },
    { key: "osNumero", width: 14, header: "N° OS" },
    { key: "remiseDate", width: 16, header: "Remise en service" },
    { key: "commentaire", width: 30, header: "Commentaire" },
  ];
  wsDetail.columns = detailCols.map((c) => ({ key: c.key, width: c.width }));
  addBrandBanner(wsDetail, logoImageId, opts.title, `${opts.subtitle} — Généré le ${genDate} — ${rows.length} appareil(s)`, "K");
  wsDetail.getRow(HEADER_ROW).values = detailCols.map((c) => c.header);
  styleHeaderRow(wsDetail.getRow(HEADER_ROW), detailCols.length);
  for (const r of rows) {
    wsDetail.addRow({
      clientNom: r.clientNom,
      entreprise: r.entreprise,
      numeroAppareil: r.numeroAppareil,
      adresse: r.adresse ?? "",
      dateArret: r.dateArret ?? "",
      cause: r.cause ?? "",
      etape: r.etape ?? "",
      devisNumero: r.devisNumero ?? "",
      osNumero: r.osNumero ?? "",
      remiseDate: r.remiseDate ?? "",
      commentaire: r.commentaire ?? "",
    });
  }
  const detailLastRow = HEADER_ROW + rows.length;
  zebraStripe(wsDetail, HEADER_ROW + 1, detailLastRow, detailCols.length);
  const lastColLetter = String.fromCharCode(64 + detailCols.length);
  wsDetail.autoFilter = { from: `A${HEADER_ROW}`, to: `${lastColLetter}${detailLastRow}` };
  wsDetail.views = [{ state: "frozen", ySplit: HEADER_ROW }];

  // ── Feuille Statistiques ────────────────────────────────────────────────
  const wsStats = workbook.addWorksheet("Statistiques", { properties: { tabColor: { argb: ORANGE } } });
  wsStats.columns = Array.from({ length: 12 }, () => ({ width: 12 }));
  addBrandBanner(wsStats, logoImageId, "Statistiques — Appareils à l'arrêt", `${opts.subtitle} — Généré le ${genDate}`, "F");

  const byAscensoriste = countBy(rows, (r) => r.entreprise);
  const byMotif = countBy(rows, (r) => r.cause);
  const byDate = countBy(rows, (r) => r.dateArret).sort((a, b) => a.label.localeCompare(b.label));

  let cursor = HEADER_ROW;

  function addStatTable(title: string, data: ChartSlice[]): number {
    const headerRow = cursor;
    wsStats.getCell(`A${headerRow - 1}`).value = title;
    wsStats.getCell(`A${headerRow - 1}`).font = { bold: true, size: 12, color: { argb: NAVY } };
    wsStats.getRow(headerRow).values = ["Libellé", "Nombre d'appareils"];
    styleHeaderRow(wsStats.getRow(headerRow), 2);
    data.forEach((d, i) => {
      wsStats.getRow(headerRow + 1 + i).values = [d.label, d.value];
    });
    zebraStripe(wsStats, headerRow + 1, headerRow + data.length, 2);
    return headerRow;
  }

  const ascHeaderRow = addStatTable("Par ascensoriste", byAscensoriste);
  cursor = ascHeaderRow + Math.max(byAscensoriste.length, 1) + 3;
  const motifHeaderRow = addStatTable("Par motif de panne", byMotif);
  cursor = motifHeaderRow + Math.max(byMotif.length, 1) + 3;
  const dateHeaderRow = addStatTable("Par date d'arrêt", byDate);
  cursor = dateHeaderRow + Math.max(byDate.length, 1) + 3;

  await addImageFromSvg(workbook, wsStats, barChartSvg("Appareils à l'arrêt par ascensoriste", byAscensoriste), 3, ascHeaderRow - 1);
  await addImageFromSvg(workbook, wsStats, barChartSvg("Appareils à l'arrêt par motif de panne", byMotif), 3, motifHeaderRow - 1);
  await addImageFromSvg(workbook, wsStats, barChartSvg("Appareils à l'arrêt par date", byDate), 3, dateHeaderRow - 1);

  return workbook;
}

// GET /api/appareils-arret/export-excel — export Excel admin (détail + stats), filtrable comme la liste
appareilsArretRouter.get("/appareils-arret/export-excel", async (req: AuthedRequest, res) => {
  try {
    const { weekStart, clientNom, entreprise } = req.query as Record<string, string | undefined>;
    let list = [...appareilsArretRows];
    if (weekStart) list = list.filter((r) => r.weekStart === weekStart);
    if (clientNom) list = list.filter((r) => r.clientNom === clientNom);
    if (entreprise) list = list.filter((r) => r.entreprise === entreprise);
    list.sort((a, b) => b.weekStart.localeCompare(a.weekStart) || a.clientNom.localeCompare(b.clientNom));

    let scope = [...appareils];
    if (clientNom) scope = scope.filter((a) => a.clientNom === clientNom);
    if (entreprise) scope = scope.filter((a) => a.entreprise === entreprise);

    const subtitle = weekStart ? `Semaine du ${fmtDateFr(weekStart)}` : "Toutes semaines";
    const workbook = await buildAppareilsArretWorkbook(list, scope, {
      title: "LVO Ingénierie — Appareils à l'arrêt",
      subtitle,
      includeClientColumn: true,
    });

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="appareils-arret-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (e) {
    console.error("[appareils-arret/export-excel] Erreur génération :", e);
    res.status(500).json({ error: "Erreur lors de la génération du fichier Excel : " + (e as Error).message });
  }
});

// ─── Upload (multer memory) ──────────────────────────────────────────────────

export const appareilsArretUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
});

async function storeOriginalFile(buf: Buffer, name: string, contentType: string): Promise<string> {
  const safeName = `${randomUUID()}-${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const key = `appareils-arret/${safeName}`;
  try {
    await getMinio().putObject(MINIO_BUCKETS.clientDocs, key, buf, buf.length, { "Content-Type": contentType });
    return key;
  } catch (e) {
    const dir = path.resolve("uploads", "appareils-arret");
    fs.mkdirSync(dir, { recursive: true });
    const localPath = path.join(dir, safeName);
    fs.writeFileSync(localPath, buf);
    console.warn("[appareils-arret] MinIO indisponible, fallback local :", (e as Error).message);
    return localPath;
  }
}

function isMinioKey(p: string): boolean {
  return !path.isAbsolute(p) && !p.startsWith("./") && !p.startsWith(".\\");
}

async function readOriginalFile(storedKey: string): Promise<Buffer | null> {
  try {
    if (isMinioKey(storedKey)) {
      const stream = await getMinio().getObject(MINIO_BUCKETS.clientDocs, storedKey);
      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on("data", (c: Buffer) => chunks.push(c));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", reject);
      });
    }
    if (fs.existsSync(storedKey)) return fs.readFileSync(storedKey);
    return null;
  } catch {
    return null;
  }
}

// ─── Routes ascensoriste ──────────────────────────────────────────────────────

type AscReq = express.Request & { ascensoriste?: { id: number; entreprise: string; nom: string; prenom: string } };

export function registerAscensoristeAppareilsArretRoutes(
  app: express.Express,
  ascensoristeAuthMiddleware: express.RequestHandler
): void {
  app.post(
    "/api/ascensoriste/appareils-arret/upload",
    ascensoristeAuthMiddleware,
    appareilsArretUpload.single("file"),
    async (req: AscReq, res) => {
      const file = (req as express.Request & { file?: Express.Multer.File }).file;
      if (!file) { res.status(400).json({ error: "Fichier Excel requis" }); return; }
      const ascensoriste = req.ascensoriste!;

      let parsed;
      try {
        parsed = parseAppareilsArretExcel(file.buffer);
      } catch (e) {
        res.status(400).json({ error: "Fichier illisible : " + (e as Error).message });
        return;
      }
      if (parsed.rows.length === 0) {
        res.status(400).json({ error: "Aucune ligne exploitable trouvée dans le fichier", details: parsed.errors });
        return;
      }

      const documentUrl = await storeOriginalFile(file.buffer, file.originalname, file.mimetype);
      const now = new Date().toISOString();

      const upload: AppareilArretUploadRow = {
        id: nextId(appareilsArretUploads),
        ascensoristeId: ascensoriste.id,
        entreprise: ascensoriste.entreprise,
        fileName: file.originalname,
        documentUrl,
        weekStart: parsed.weekStart,
        weekEnd: parsed.weekEnd,
        rowsCount: parsed.rows.length,
        rowsErrors: parsed.errors.length,
        createdAt: now,
      };
      appareilsArretUploads.push(upload);

      const createdRows: AppareilArretRow[] = [];
      for (const row of parsed.rows) {
        let appareil = appareils.find(
          (a) => a.numero === row.numeroAppareil && a.entreprise === ascensoriste.entreprise
        );
        if (!appareil) {
          appareil = {
            id: nextId(appareils),
            numero: row.numeroAppareil,
            label: null,
            clientNom: row.clientNom,
            siteNom: null,
            entreprise: ascensoriste.entreprise,
            enArret: true,
            createdAt: now,
          } satisfies AppareilRow;
          appareils.push(appareil);
        } else {
          appareil.clientNom = row.clientNom;
          appareil.enArret = true;
        }

        const arretRow: AppareilArretRow = {
          id: nextId(appareilsArretRows),
          uploadId: upload.id,
          ascensoristeId: ascensoriste.id,
          entreprise: ascensoriste.entreprise,
          appareilId: appareil.id,
          numeroAppareil: row.numeroAppareil,
          clientNom: row.clientNom,
          adresse: row.adresse,
          dateArret: row.dateArret,
          cause: row.cause,
          etape: row.etape,
          piecesEnStock: row.piecesEnStock,
          devisNumero: row.devisNumero,
          devisDate: row.devisDate,
          validationDate: row.validationDate,
          osNumero: row.osNumero,
          executionDate: row.executionDate,
          remiseDate: row.remiseDate,
          commentaire: row.commentaire,
          weekStart: parsed.weekStart,
          weekEnd: parsed.weekEnd,
          createdAt: now,
        };
        appareilsArretRows.push(arretRow);
        createdRows.push(arretRow);
      }

      schedulePersistStore();
      notifyAppareilsArretUpload(ascensoriste.entreprise, upload, createdRows);
      res.status(201).json({
        upload,
        rowsCount: parsed.rows.length,
        rowsErrors: parsed.errors.length,
        errors: parsed.errors,
      });
    }
  );

  app.get("/api/ascensoriste/appareils-arret", ascensoristeAuthMiddleware, (req: AscReq, res) => {
    const ascensoristeId = req.ascensoriste!.id;
    const uploads = appareilsArretUploads
      .filter((u) => u.ascensoristeId === ascensoristeId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json(uploads);
  });

  app.get(
    "/api/ascensoriste/appareils-arret/:uploadId/download",
    ascensoristeAuthMiddleware,
    async (req: AscReq, res) => {
      const id = Number(req.params.uploadId);
      const ascensoriste = req.ascensoriste!;
      const upload = appareilsArretUploads.find((u) => u.id === id && u.ascensoristeId === ascensoriste.id);
      if (!upload) { res.status(404).json({ error: "Fichier introuvable" }); return; }
      const buf = await readOriginalFile(upload.documentUrl);
      if (!buf) { res.status(404).json({ error: "Fichier introuvable sur le stockage" }); return; }
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(upload.fileName)}"`);
      res.send(buf);
    }
  );

  // GET /api/ascensoriste/appareils-arret/export-excel — export Excel (synthèse + détail + stats), sur ses propres appareils
  app.get("/api/ascensoriste/appareils-arret/export-excel", ascensoristeAuthMiddleware, async (req: AscReq, res) => {
    try {
      const ascensoriste = req.ascensoriste!;
      const own = appareilsArretRows.filter((r) => r.entreprise === ascensoriste.entreprise);
      const weekStart = req.query.weekStart as string | undefined;
      const rows = weekStart ? own.filter((r) => r.weekStart === weekStart) : own;
      rows.sort((a, b) => b.weekStart.localeCompare(a.weekStart) || a.numeroAppareil.localeCompare(b.numeroAppareil));

      const scope = appareils.filter((a) => a.entreprise === ascensoriste.entreprise);
      const subtitle = weekStart
        ? `${ascensoriste.entreprise} — Semaine du ${fmtDateFr(weekStart)}`
        : `${ascensoriste.entreprise} — Toutes semaines`;
      const workbook = await buildAppareilsArretWorkbook(rows, scope, {
        title: "LVO Ingénierie — Appareils à l'arrêt",
        subtitle,
        includeClientColumn: true,
      });

      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="appareils-arret-${new Date().toISOString().slice(0, 10)}.xlsx"`);
      res.send(Buffer.from(buffer));
    } catch (e) {
      console.error("[ascensoriste/appareils-arret/export-excel] Erreur génération :", e);
      res.status(500).json({ error: "Erreur lors de la génération du fichier Excel : " + (e as Error).message });
    }
  });
}

// ─── Routes client ────────────────────────────────────────────────────────────

type ClientReq = express.Request & { clientContact?: { id: number; entreprise: string; nom: string; prenom: string } };

export function registerClientAppareilsArretRoutes(
  app: express.Express,
  clientAuthMiddleware: express.RequestHandler
): void {
  app.get("/api/client/appareils-arret", clientAuthMiddleware, (req: ClientReq, res) => {
    const entreprise = req.clientContact!.entreprise;
    const own = appareilsArretRows.filter((r) => r.clientNom === entreprise);
    const weeks = [...new Set(own.map((r) => r.weekStart))].sort((a, b) => b.localeCompare(a));

    const requested = (req.query.weekStart as string | undefined) ?? weeks[0];
    const rows = requested ? own.filter((r) => r.weekStart === requested) : [];
    rows.sort((a, b) => a.numeroAppareil.localeCompare(b.numeroAppareil));

    res.json({ weeks, weekStart: requested ?? null, rows });
  });

  // GET /api/client/appareils-arret/export-excel — export Excel client (détail + stats), sur ses propres données
  app.get("/api/client/appareils-arret/export-excel", clientAuthMiddleware, async (req: ClientReq, res) => {
    try {
      const entreprise = req.clientContact!.entreprise;
      const own = appareilsArretRows.filter((r) => r.clientNom === entreprise);
      const weekStart = req.query.weekStart as string | undefined;
      const rows = weekStart ? own.filter((r) => r.weekStart === weekStart) : own;
      rows.sort((a, b) => b.weekStart.localeCompare(a.weekStart) || a.numeroAppareil.localeCompare(b.numeroAppareil));

      const scope = appareils.filter((a) => a.clientNom === entreprise);
      const subtitle = weekStart ? `${entreprise} — Semaine du ${fmtDateFr(weekStart)}` : `${entreprise} — Toutes semaines`;
      const workbook = await buildAppareilsArretWorkbook(rows, scope, {
        title: "LVO Ingénierie — Appareils à l'arrêt",
        subtitle,
        includeClientColumn: false,
      });

      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="appareils-arret-${new Date().toISOString().slice(0, 10)}.xlsx"`);
      res.send(Buffer.from(buffer));
    } catch (e) {
      console.error("[client/appareils-arret/export-excel] Erreur génération :", e);
      res.status(500).json({ error: "Erreur lors de la génération du fichier Excel : " + (e as Error).message });
    }
  });
}
