import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type { SiteArborescenceNodeRow } from "./store.js";
import { siteArborescenceNodes } from "./store.js";

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

/** Crée les 20 dossiers standard LVO pour un site (idempotent). */
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

export function saveUploadedFile(
  siteId: number,
  folderId: number,
  originalName: string,
  buffer: Buffer,
  contentType: string | null,
  uploadedByUserId: number | null,
): SiteArborescenceNodeRow {
  const folder = findArborescenceNode(siteId, folderId);
  if (!folder || folder.nodeType !== "FOLDER") {
    throw new Error("Dossier introuvable");
  }

  const safeName = sanitizeFileName(originalName);
  const dir = path.join(sitesUploadRoot(), String(siteId));
  fs.mkdirSync(dir, { recursive: true });
  const storedName = `${randomUUID()}-${safeName}`;
  const storedPath = path.join(dir, storedName);
  fs.writeFileSync(storedPath, buffer);

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

export function deleteArborescenceFile(siteId: number, fileId: number): void {
  const file = findArborescenceNode(siteId, fileId);
  if (!file || file.nodeType !== "FILE") {
    throw new Error("Fichier introuvable");
  }
  if (file.storedPath) {
    try {
      fs.unlinkSync(file.storedPath);
    } catch {
      /* ignore */
    }
  }
  const idx = siteArborescenceNodes.findIndex((n) => n.id === fileId);
  if (idx >= 0) siteArborescenceNodes.splice(idx, 1);
}

export function sanitizeFileName(name: string): string {
  const trimmed = (name || "fichier").trim().replace(/[\\/]/g, "-");
  return trimmed.length > 200 ? trimmed.slice(0, 200) : trimmed;
}
