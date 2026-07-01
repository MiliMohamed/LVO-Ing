import fs from "node:fs";
import path from "node:path";
import { PassThrough } from "node:stream";
import { randomUUID } from "node:crypto";

import { ZipArchive } from "archiver";

import type { SiteArborescenceNodeRow } from "./store.js";
import { siteArborescenceNodes } from "./store.js";
import { getMinio, MINIO_BUCKETS } from "./db.js";

const LEVEL1_FOLDERS = [
  "1-Offre",
  "2-commande & facturation",
  "3-doc Client",
  "4-Avant-Projet",
  "5-Consultation & Analyse",
  "6-exécution",
] as const;

const CONCEPTION_SUBFOLDERS = ["5.1-DCE", "5.2-analyse"] as const;

const EXECUTION_SUBFOLDERS = [
  "6.1-Amiante",
  "6.2-Courriers",
  "6.3-CR",
  "6.4-DAT",
  "6.5-Marché",
  "6.6-Penalites",
  "6.7-Photos",
  "6.8-Planning",
  "6.9-PV Sit.",
  "6.10-Sous-trait.",
  "6.11-SPS-BC",
  "6.12-Visas",
] as const;

export type SiteArborescenceTreeNode = {
  id: number;
  parentId: number | null;
  nom: string;
  nodeType: "FOLDER" | "FILE";
  sortOrder: number;
  sizeBytes: number | null;
  contentType: string | null;
  createdAt: string;
  children: SiteArborescenceTreeNode[];
};

function nextNodeId(): number {
  return Math.max(0, ...siteArborescenceNodes.map((n) => n.id)) + 1;
}

function hasArborescence(siteId: number): boolean {
  return siteArborescenceNodes.some((n) => n.siteId === siteId);
}

function saveFolder(siteId: number, parentId: number | null, nom: string, sortOrder: number): SiteArborescenceNodeRow {
  const row: SiteArborescenceNodeRow = {
    id: nextNodeId(),
    siteId,
    parentId,
    nodeType: "FOLDER",
    nom,
    sortOrder,
    storedPath: null,
    contentType: null,
    sizeBytes: null,
    uploadedByUserId: null,
    createdAt: new Date().toISOString(),
  };
  siteArborescenceNodes.push(row);
  return row;
}

export function provisionSiteArborescence(siteId: number): void {
  if (hasArborescence(siteId)) return;

  const level1: SiteArborescenceNodeRow[] = [];
  LEVEL1_FOLDERS.forEach((name, i) => {
    level1.push(saveFolder(siteId, null, name, i));
  });

  const conception = level1[4];
  const execution = level1[5];
  CONCEPTION_SUBFOLDERS.forEach((name, i) => saveFolder(siteId, conception.id, name, i));
  EXECUTION_SUBFOLDERS.forEach((name, i) => saveFolder(siteId, execution.id, name, i));
}

export function ensureSiteArborescence(siteId: number): void {
  provisionSiteArborescence(siteId);
}

export function buildArborescenceTree(siteId: number): SiteArborescenceTreeNode[] {
  const nodes = siteArborescenceNodes.filter((n) => n.siteId === siteId);
  const byParent = new Map<number | null, SiteArborescenceNodeRow[]>();
  for (const n of nodes) {
    const list = byParent.get(n.parentId) ?? [];
    list.push(n);
    byParent.set(n.parentId, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.nom.localeCompare(b.nom, "fr"));
  }

  function walk(parentId: number | null): SiteArborescenceTreeNode[] {
    return (byParent.get(parentId) ?? []).map((n) => ({
      id: n.id,
      parentId: n.parentId,
      nom: n.nom,
      nodeType: n.nodeType,
      sortOrder: n.sortOrder,
      sizeBytes: n.sizeBytes,
      contentType: n.contentType,
      createdAt: n.createdAt,
      children: n.nodeType === "FOLDER" ? walk(n.id) : [],
    }));
  }

  return walk(null);
}

export function listArborescenceChildren(siteId: number, parentId: number | null) {
  return siteArborescenceNodes
    .filter((n) => n.siteId === siteId && n.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.nom.localeCompare(b.nom, "fr"))
    .map((n) => ({
      id: n.id,
      parentId: n.parentId,
      nom: n.nom,
      nodeType: n.nodeType,
      sortOrder: n.sortOrder,
      sizeBytes: n.sizeBytes,
      contentType: n.contentType,
      childCount:
        n.nodeType === "FOLDER"
          ? siteArborescenceNodes.filter((c) => c.siteId === siteId && c.parentId === n.id).length
          : 0,
      createdAt: n.createdAt,
    }));
}

export function findArborescenceNode(siteId: number, nodeId: number): SiteArborescenceNodeRow | undefined {
  return siteArborescenceNodes.find((n) => n.id === nodeId && n.siteId === siteId);
}

export function sitesUploadRoot(): string {
  return path.resolve("uploads", "sites");
}

/** Détermine si une valeur est une clé MinIO (pas un chemin absolu local) */
function isMinioKey(p: string): boolean {
  return !path.isAbsolute(p) && !p.startsWith("./") && !p.startsWith(".\\");
}

/**
 * Enregistre un fichier uploadé :
 *  1. Tentative vers MinIO (prioritaire)
 *  2. Fallback vers le disque local si MinIO indisponible
 */
export async function saveUploadedFile(
  siteId: number,
  folderId: number,
  originalName: string,
  buffer: Buffer,
  contentType: string | null,
  uploadedByUserId: number | null,
): Promise<SiteArborescenceNodeRow> {
  const folder = findArborescenceNode(siteId, folderId);
  if (!folder || folder.nodeType !== "FOLDER") {
    throw new Error("Dossier introuvable");
  }

  const safeName  = sanitizeFileName(originalName);
  const objectKey = `sites/${siteId}/${randomUUID()}-${safeName}`;
  let storedPath: string;

  try {
    await getMinio().putObject(
      MINIO_BUCKETS.sites,
      objectKey,
      buffer,
      buffer.length,
      { "Content-Type": contentType ?? "application/octet-stream" },
    );
    storedPath = objectKey;
  } catch (e) {
    // Fallback local
    const dir = path.join(sitesUploadRoot(), String(siteId));
    fs.mkdirSync(dir, { recursive: true });
    storedPath = path.join(dir, `${randomUUID()}-${safeName}`);
    fs.writeFileSync(storedPath, buffer);
    console.warn("[arborescence] MinIO indisponible, fallback local :", (e as Error).message);
  }

  const row: SiteArborescenceNodeRow = {
    id: nextNodeId(),
    siteId,
    parentId: folderId,
    nodeType: "FILE",
    nom: safeName,
    sortOrder: 0,
    storedPath,
    contentType,
    sizeBytes: buffer.length,
    uploadedByUserId,
    createdAt: new Date().toISOString(),
  };
  siteArborescenceNodes.push(row);
  return row;
}

/** Télécharge un fichier depuis MinIO ou le disque local */
export async function downloadArborescenceFile(node: SiteArborescenceNodeRow): Promise<Buffer | null> {
  if (!node.storedPath) return null;
  try {
    if (isMinioKey(node.storedPath)) {
      const stream = await getMinio().getObject(MINIO_BUCKETS.sites, node.storedPath);
      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on("data", (c: Buffer) => chunks.push(c));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", reject);
      });
    }
    if (fs.existsSync(node.storedPath)) return fs.readFileSync(node.storedPath);
    return null;
  } catch {
    return null;
  }
}

export async function deleteArborescenceFile(siteId: number, fileId: number): Promise<void> {
  const file = findArborescenceNode(siteId, fileId);
  if (!file || file.nodeType !== "FILE") {
    throw new Error("Fichier introuvable");
  }
  if (file.storedPath) {
    try {
      if (isMinioKey(file.storedPath)) {
        await getMinio().removeObject(MINIO_BUCKETS.sites, file.storedPath);
      } else {
        fs.unlinkSync(file.storedPath);
      }
    } catch { /* ignore */ }
  }
  const idx = siteArborescenceNodes.findIndex((n) => n.id === fileId);
  if (idx >= 0) siteArborescenceNodes.splice(idx, 1);
}

export function sanitizeFileName(name: string): string {
  const trimmed = (name || "fichier").trim().replace(/[\\/]/g, "-");
  return trimmed.length > 200 ? trimmed.slice(0, 200) : trimmed;
}

export function siteZipRootName(siteId: number, siteNom?: string | null): string {
  const raw  = (siteNom || `site-${siteId}`).trim();
  const safe = raw.replace(/[\\/:*?"<>|]/g, "-").trim();
  if (!safe) return `site-${siteId}`;
  return safe.length > 120 ? safe.slice(0, 120) : safe;
}

function buildNodeZipPath(
  node: SiteArborescenceNodeRow,
  nodeMap: Map<number, SiteArborescenceNodeRow>,
  rootName: string,
  asDirectory = false,
): string {
  const parts = [node.nom];
  let current = node.parentId != null ? nodeMap.get(node.parentId) : undefined;
  while (current) {
    parts.unshift(current.nom);
    current = current.parentId != null ? nodeMap.get(current.parentId) : undefined;
  }
  parts.unshift(rootName);
  const joined = parts.join("/");
  return asDirectory ? `${joined}/` : joined;
}

export async function downloadAllAsZip(siteId: number, siteNom?: string | null): Promise<Buffer> {
  const nodes    = siteArborescenceNodes.filter((n) => n.siteId === siteId);
  const nodeMap  = new Map(nodes.map((n) => [n.id, n]));
  const rootName = siteZipRootName(siteId, siteNom);

  return new Promise((resolve, reject) => {
    const passthrough = new PassThrough();
    const chunks: Buffer[] = [];
    passthrough.on("data", (chunk: Buffer) => chunks.push(chunk));
    passthrough.on("end", () => resolve(Buffer.concat(chunks)));
    passthrough.on("error", reject);

    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.on("error", reject);
    archive.pipe(passthrough);

    // Dossiers vides
    for (const node of nodes) {
      if (node.nodeType !== "FOLDER") continue;
      archive.append(Buffer.alloc(0), { name: buildNodeZipPath(node, nodeMap, rootName, true) });
    }

    // Fichiers (download depuis MinIO ou disque local)
    const fileNodes = nodes.filter((n) => n.nodeType === "FILE" && n.storedPath);
    const filePromises = fileNodes.map(async (node) => {
      const buf = await downloadArborescenceFile(node);
      if (!buf) return;
      archive.append(buf, { name: buildNodeZipPath(node, nodeMap, rootName) });
    });

    Promise.all(filePromises)
      .then(() => archive.finalize())
      .catch(reject);
  });
}
