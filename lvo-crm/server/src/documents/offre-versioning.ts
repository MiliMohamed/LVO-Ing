/**
 * Création de version de document d'offre (DOCX/PDF) — factorisé pour être partagé entre la
 * génération initiale, la validation PDF, et l'édition dans le navigateur (ONLYOFFICE) : dans
 * les trois cas une nouvelle version est créée (jamais d'écrasement) et copiée aussi dans le
 * repo documentaire du site (dossier "1-Offre" de l'arborescence).
 */
import crypto from "node:crypto";
import JSZip from "jszip";

import { MINIO_BUCKETS, minioDownload, minioUpload } from "../db.js";
import { ensureSiteArborescence, listArborescenceChildren, saveUploadedFile } from "../site-arborescence.js";
import { fichierVersions, pushDocumentVersion, sites, type FichierVersionRow, type OffreRow } from "../store.js";

const OFFRE_FOLDER_NAME = "1-Offre";

/** Retrouve l'id du dossier "1-Offre" de l'arborescence du site — jamais d'exception : une
 * copie secondaire manquée ne doit jamais faire échouer la génération du document lui-même. */
export async function resolveOffreFolderId(siteId: number): Promise<number | null> {
  try {
    ensureSiteArborescence(siteId);
    const root = listArborescenceChildren(siteId, null);
    const folder = root.find((n) => n.nodeType === "FOLDER" && n.nom === OFFRE_FOLDER_NAME);
    return folder?.id ?? null;
  } catch (e) {
    console.warn("[offre-versioning] Résolution du dossier '1-Offre' échouée :", (e as Error).message);
    return null;
  }
}

async function copyIntoSiteArchive(o: OffreRow, filename: string, buffer: Buffer, contentType: string, userId: number | null) {
  try {
    const site = sites.find((s) => s.nom === o.siteNom);
    if (!site) return;
    const folderId = await resolveOffreFolderId(site.id);
    if (folderId == null) return;
    await saveUploadedFile(site.id, folderId, filename, buffer, contentType, userId);
  } catch (e) {
    console.warn("[offre-versioning] Copie dans le repo du site échouée :", (e as Error).message);
  }
}

const DOCX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Parties du .docx qui portent le contenu réellement visible. Le reste de l'archive ZIP
 * (horodatages des entrées, métadonnées de compression) change à CHAQUE génération même quand le
 * document est rigoureusement identique — comparer les octets bruts du fichier ne permet donc pas
 * de détecter qu'il n'y a rien de nouveau.
 */
const CONTENT_PARTS = /^word\/(document|header\d*|footer\d*|styles|numbering)\.xml$/;

/** Empreinte du contenu visible d'un .docx, stable d'une génération à l'autre. */
export async function offreDocxContentHash(docx: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(docx);
  const names = Object.keys(zip.files)
    .filter((n) => CONTENT_PARTS.test(n))
    .sort();
  const h = crypto.createHash("sha256");
  for (const name of names) {
    h.update(name);
    h.update(await zip.files[name].async("nodebuffer"));
  }
  return h.digest("hex");
}

/**
 * Version DOCX courante d'une offre, si elle existe — sert à comparer le document qu'on vient de
 * produire avec le dernier en date.
 */
export function currentOffreDocxVersion(reference: string): FichierVersionRow | null {
  const docx = fichierVersions.filter((v) => v.reference === reference && v.docType === "OFFRE" && v.format === "docx");
  if (!docx.length) return null;
  return docx.reduce((a, b) => (b.version > a.version ? b : a));
}

/**
 * Indique si `docx` a exactement le même contenu que la version DOCX courante de l'offre.
 * Toute erreur de lecture renvoie `false` : dans le doute on crée une version, on ne perd jamais
 * un document.
 */
export async function isSameAsCurrentOffreDocx(reference: string, docx: Buffer): Promise<FichierVersionRow | null> {
  const current = currentOffreDocxVersion(reference);
  if (!current?.storageKey) return null;
  try {
    const [nouveau, ancien] = await Promise.all([
      offreDocxContentHash(docx),
      minioDownload(MINIO_BUCKETS.documents, current.storageKey).then((b) => offreDocxContentHash(Buffer.from(b))),
    ]);
    return nouveau === ancien ? current : null;
  } catch (e) {
    console.warn("[offre-versioning] Comparaison avec la version courante impossible :", (e as Error).message);
    return null;
  }
}

export async function saveNewOffreDocxVersion(o: OffreRow, docx: Buffer, uploadedByUserId: number | null = null): Promise<FichierVersionRow> {
  const row = pushDocumentVersion({ reference: o.numeroOffre, docType: "OFFRE", format: "docx" });
  const key = `offres/${o.id}/v${row.version}/${o.numeroOffre}.docx`;
  await minioUpload(MINIO_BUCKETS.documents, key, docx, DOCX_CONTENT_TYPE);
  row.storageKey = key;
  await copyIntoSiteArchive(o, `${o.numeroOffre}_v${row.version}.docx`, docx, DOCX_CONTENT_TYPE, uploadedByUserId);
  return row;
}

export async function saveOffrePdfVersion(
  o: OffreRow,
  version: number,
  pdf: Buffer,
  uploadedByUserId: number | null = null,
): Promise<FichierVersionRow> {
  const key = `offres/${o.id}/v${version}/${o.numeroOffre}.pdf`;
  await minioUpload(MINIO_BUCKETS.documents, key, pdf, "application/pdf");
  const row = pushDocumentVersion({ reference: o.numeroOffre, docType: "OFFRE", format: "pdf", storageKey: key, version });
  await copyIntoSiteArchive(o, `${o.numeroOffre}_v${version}.pdf`, pdf, "application/pdf", uploadedByUserId);
  return row;
}
