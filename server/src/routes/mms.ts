import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import express, { Router } from "express";

import { crmOrExploitationMiddleware } from "../middleware.js";
import type { AuthedRequest } from "../middleware.js";
import { mmsRapports } from "../store.js";
import type { MmsRapportRow } from "../store.js";
import { getMinio, MINIO_BUCKETS } from "../db.js";
import { schedulePersistStore } from "../store-persist.js";

export const mmsRouter = Router();

// Répertoire local (fallback pour fichiers existants avant migration MinIO)
const MMS_UPLOADS_ROOT = path.resolve("uploads", "mms");

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._\-À-ɏ]/g, "_");
}

/** Détermine si un chemin est une clé MinIO (pas un chemin absolu local) */
function isMinioKey(p: string): boolean {
  return !path.isAbsolute(p) && !p.startsWith("./") && !p.startsWith(".\\");
}

/** Upload vers MinIO ou local selon disponibilité */
async function storeFile(id: number, prefix: string, name: string, buf: Buffer, contentType: string): Promise<string> {
  const key = `${id}/${prefix}-${randomUUID()}-${name}`;
  try {
    await getMinio().putObject(MINIO_BUCKETS.mms, key, buf, buf.length, { "Content-Type": contentType });
    return key;
  } catch (e) {
    // Fallback local si MinIO indisponible
    const dir = path.join(MMS_UPLOADS_ROOT, String(id));
    fs.mkdirSync(dir, { recursive: true });
    const localPath = path.join(dir, `${prefix}-${randomUUID()}-${name}`);
    fs.writeFileSync(localPath, buf);
    console.warn("[mms] MinIO indisponible, fallback local :", (e as Error).message);
    return localPath;
  }
}

/** Télécharge depuis MinIO ou local selon le type de chemin */
async function readFile(storedKey: string): Promise<Buffer | null> {
  try {
    if (isMinioKey(storedKey)) {
      const stream = await getMinio().getObject(MINIO_BUCKETS.mms, storedKey);
      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on("data", (c: Buffer) => chunks.push(c));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", reject);
      });
    }
    // Chemin local
    if (fs.existsSync(storedKey)) return fs.readFileSync(storedKey);
    return null;
  } catch {
    return null;
  }
}

/** Supprime depuis MinIO ou local */
async function deleteFile(storedKey: string): Promise<void> {
  try {
    if (isMinioKey(storedKey)) {
      await getMinio().removeObject(MINIO_BUCKETS.mms, storedKey);
    } else if (fs.existsSync(storedKey)) {
      fs.unlinkSync(storedKey);
    }
  } catch { /* ignore */ }
}

// Accessible avec un token CRM ou un token Admin Exploitation (Maintenance ascenseurs / MMS).
mmsRouter.use(crmOrExploitationMiddleware([""]) as express.RequestHandler);

/** GET /api/mms/rapports?prestataire=&trimestre=&annee= */
mmsRouter.get("/rapports", (_req, res) => {
  res.json(
    [...mmsRapports]
      .sort((a, b) => b.annee - a.annee || b.trimestre.localeCompare(a.trimestre))
      .map(({ excelPath, wordPath, pdfPath, ...meta }) => ({
        ...meta,
        hasExcel: Boolean(excelPath),
        hasWord: Boolean(wordPath),
        hasPdf: Boolean(pdfPath),
      })),
  );
});

type SaveBody = {
  prestataire: string;
  client: string;
  trimestre: string;
  annee: number;
  indicateurs: {
    nb_appareils: number;
    nb_interventions: number;
    nb_pannes_retenues: number;
    nb_visites_maintenance: number;
    penalite_totale: number;
  };
  fichiers: {
    excel_nom: string;
    excel_base64: string;
    word_nom: string;
    word_base64: string;
    pdf_nom?: string | null;
    pdf_base64?: string | null;
  };
};

/** POST /api/mms/rapports */
mmsRouter.post("/rapports", express.json({ limit: "50mb" }), async (req: AuthedRequest, res) => {
  const body = req.body as SaveBody;
  if (!body.prestataire || !body.trimestre || !body.annee || !body.fichiers?.excel_base64) {
    res.status(400).json({ error: "Champs requis manquants (prestataire, trimestre, annee, excel_base64)" });
    return;
  }

  const id = Math.max(0, ...mmsRapports.map((r) => r.id)) + 1;

  const excelBuf = Buffer.from(body.fichiers.excel_base64, "base64");
  const wordBuf  = Buffer.from(body.fichiers.word_base64, "base64");
  const excelName = sanitize(body.fichiers.excel_nom || `MMS_${body.prestataire}_${body.trimestre}_${body.annee}.xlsx`);
  const wordName  = sanitize(body.fichiers.word_nom  || `CR_${body.prestataire}_${body.trimestre}_${body.annee}.docx`);

  const [excelKey, wordKey] = await Promise.all([
    storeFile(id, "excel", excelName, excelBuf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    storeFile(id, "word",  wordName,  wordBuf,  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
  ]);

  let pdfKey: string | null = null;
  let pdfName: string | null = null;
  let pdfSize: number | null = null;
  if (body.fichiers.pdf_base64) {
    const pdfBuf = Buffer.from(body.fichiers.pdf_base64, "base64");
    pdfName = sanitize(body.fichiers.pdf_nom || `CR_${body.prestataire}_${body.trimestre}_${body.annee}.pdf`);
    pdfKey  = await storeFile(id, "pdf", pdfName, pdfBuf, "application/pdf");
    pdfSize = pdfBuf.length;
  }

  const userId = Number(req.auth?.userId ?? 0);
  const row: MmsRapportRow = {
    id,
    prestataire:      String(body.prestataire),
    client:           String(body.client ?? ""),
    trimestre:        String(body.trimestre),
    annee:            Number(body.annee),
    createdAt:        new Date().toISOString(),
    createdByUserId:  userId,
    nbAppareils:      Number(body.indicateurs?.nb_appareils         ?? 0),
    nbInterventions:  Number(body.indicateurs?.nb_interventions      ?? 0),
    nbPannes:         Number(body.indicateurs?.nb_pannes_retenues    ?? 0),
    nbVisites:        Number(body.indicateurs?.nb_visites_maintenance ?? 0),
    penaliteTotale:   Number(body.indicateurs?.penalite_totale       ?? 0),
    excelNom:         excelName,
    wordNom:          wordName,
    pdfNom:           pdfName,
    excelPath:        excelKey,
    wordPath:         wordKey,
    pdfPath:          pdfKey,
    excelSizeBytes:   excelBuf.length,
    wordSizeBytes:    wordBuf.length,
    pdfSizeBytes:     pdfSize,
  };
  mmsRapports.push(row);
  schedulePersistStore();
  res.status(201).json({ id });
});

/** GET /api/mms/rapports/:id/download/:type */
mmsRouter.get("/rapports/:id/download/:type", async (req, res) => {
  const id     = Number(req.params.id);
  const rapport = mmsRapports.find((r) => r.id === id);
  if (!rapport) { res.status(404).json({ error: "Rapport introuvable" }); return; }

  const fileType = req.params.type as "excel" | "word" | "pdf";
  const storedKey = fileType === "excel" ? rapport.excelPath : fileType === "word" ? rapport.wordPath : rapport.pdfPath;
  const fileName  = fileType === "excel" ? rapport.excelNom  : fileType === "word" ? rapport.wordNom  : rapport.pdfNom;

  if (!storedKey || !fileName) { res.status(404).json({ error: "Fichier introuvable" }); return; }

  const buf = await readFile(storedKey);
  if (!buf) { res.status(404).json({ error: "Fichier manquant" }); return; }

  const contentTypes: Record<string, string> = {
    excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    word:  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pdf:   "application/pdf",
  };
  res.setHeader("Content-Type", contentTypes[fileType] ?? "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
  res.send(buf);
});

/** DELETE /api/mms/rapports/:id */
mmsRouter.delete("/rapports/:id", async (req: AuthedRequest, res) => {
  const id  = Number(req.params.id);
  const idx = mmsRapports.findIndex((r) => r.id === id);
  if (idx === -1) { res.status(404).json({ error: "Rapport introuvable" }); return; }

  const rapport = mmsRapports[idx];
  await Promise.allSettled([
    rapport.excelPath ? deleteFile(rapport.excelPath) : Promise.resolve(),
    rapport.wordPath  ? deleteFile(rapport.wordPath)  : Promise.resolve(),
    rapport.pdfPath   ? deleteFile(rapport.pdfPath)   : Promise.resolve(),
  ]);
  mmsRapports.splice(idx, 1);
  schedulePersistStore();
  res.json({ ok: true });
});
