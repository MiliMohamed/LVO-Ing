/**
 * Couche de persistance du store en-mémoire.
 * Priorité : tables PostgreSQL normalisées → snapshot JSON (fallback) → seed.
 */
import fs from "node:fs/promises";
import path from "node:path";

import {
  exportStoreSnapshot,
  importStoreSnapshot,
  devisGroupement,
  negociationMessages,
  appareils,
  appareilsArretUploads,
  appareilsArretRows,
  type DevisGroupementRow,
  type NegociationMessageRow,
  type AppareilRow,
  type AppareilArretUploadRow,
  type AppareilArretRow,
} from "./store.js";
import { getPrisma } from "./db.js";
import { saveAllToDb, loadAllFromDb } from "./db-store.js";
import { exportRefreshRegistries, importRefreshRegistries } from "./auth.js";

// Fichier JSON de secours (si PostgreSQL indisponible)
const FALLBACK_PATH    = path.resolve("data", "store.snapshot.json");
const REGISTRY_PATH    = path.resolve("data", "refresh-registry.json");
// Devis groupement — non couvert par les tables normalisées, persisté séparément
const DEVIS_PATH       = path.resolve("data", "devis-groupement.json");
// Suivi hebdomadaire des appareils à l'arrêt — non couvert par les tables normalisées
const APPAREILS_ARRET_PATH = path.resolve("data", "appareils-arret.json");

let persistTimer: ReturnType<typeof setTimeout> | null = null;

export function storeSnapshotPath(): string {
  return process.env.DATABASE_URL ? "postgresql (tables normalisées)" : FALLBACK_PATH;
}

// ─── Chargement ───────────────────────────────────────────────────────────────

export async function loadStoreSnapshot(): Promise<boolean> {
  // Refresh tokens — restaurés en premier, toujours (indépendant du backend store)
  try {
    const raw = await fs.readFile(REGISTRY_PATH, "utf8");
    importRefreshRegistries(JSON.parse(raw));
  } catch { /* absent au premier démarrage, ignoré */ }

  // Devis groupement + appareils — toujours rechargés depuis fichier dédié (non couvert par DB normalisée)
  try {
    const raw = await fs.readFile(DEVIS_PATH, "utf8");
    const parsed = JSON.parse(raw) as { devis: DevisGroupementRow[]; messages: NegociationMessageRow[]; appareils?: AppareilRow[] };
    devisGroupement.splice(0, devisGroupement.length, ...(parsed.devis ?? []));
    negociationMessages.splice(0, negociationMessages.length, ...(parsed.messages ?? []));
    appareils.splice(0, appareils.length, ...(parsed.appareils ?? []));
  } catch { /* absent au premier démarrage, ignoré */ }

  // Appareils à l'arrêt — toujours rechargés depuis fichier dédié (non couvert par DB normalisée)
  try {
    const raw = await fs.readFile(APPAREILS_ARRET_PATH, "utf8");
    const parsed = JSON.parse(raw) as { uploads: AppareilArretUploadRow[]; rows: AppareilArretRow[] };
    appareilsArretUploads.splice(0, appareilsArretUploads.length, ...(parsed.uploads ?? []));
    appareilsArretRows.splice(0, appareilsArretRows.length, ...(parsed.rows ?? []));
  } catch { /* absent au premier démarrage, ignoré */ }

  // 1. Tables normalisées (principal)
  if (process.env.DATABASE_URL) {
    try {
      const loaded = await loadAllFromDb();
      if (loaded) return true;
      // DB accessible mais vide → le seed va tourner, puis persistStore() écrit en DB
      return false;
    } catch (e) {
      console.warn("[store] DB indisponible, fallback snapshot JSON :", (e as Error).message);
    }
  }

  // 2. Snapshot JSON (fallback)
  try {
    const raw = await fs.readFile(FALLBACK_PATH, "utf8");
    const data = JSON.parse(raw) as ReturnType<typeof exportStoreSnapshot>;
    importStoreSnapshot(data);
    return true;
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") {
      console.warn("[store] Snapshot JSON illisible, re-seed :", err.message);
    }
    return false;
  }
}

// ─── Sauvegarde ───────────────────────────────────────────────────────────────

export async function persistStore(): Promise<void> {
  // Refresh tokens — toujours persistés sur disque (indépendant du backend store)
  try {
    await fs.mkdir(path.dirname(REGISTRY_PATH), { recursive: true });
    await fs.writeFile(REGISTRY_PATH, JSON.stringify(exportRefreshRegistries()), "utf8");
  } catch { /* non bloquant */ }

  // Devis groupement + appareils — toujours persistés (non couverts par les tables normalisées)
  try {
    await fs.mkdir(path.dirname(DEVIS_PATH), { recursive: true });
    await fs.writeFile(DEVIS_PATH, JSON.stringify({ devis: devisGroupement, messages: negociationMessages, appareils }), "utf8");
  } catch { /* non bloquant */ }

  // Appareils à l'arrêt — toujours persistés (non couverts par les tables normalisées)
  try {
    await fs.mkdir(path.dirname(APPAREILS_ARRET_PATH), { recursive: true });
    await fs.writeFile(
      APPAREILS_ARRET_PATH,
      JSON.stringify({ uploads: appareilsArretUploads, rows: appareilsArretRows }),
      "utf8"
    );
  } catch { /* non bloquant */ }

  // 1. Tables normalisées (principal)
  if (process.env.DATABASE_URL) {
    try {
      await saveAllToDb();
      return;
    } catch (e) {
      console.warn("[store] Échec sauvegarde DB normalisée, fallback snapshot :", (e as Error).message);
    }
  }

  // 2. Snapshot JSON (fallback) + app_snapshot Prisma (compat)
  const data = exportStoreSnapshot();

  // Tentative app_snapshot (JSON blob) si Prisma est dispo
  try {
    const prisma = getPrisma();
    await prisma.appSnapshot.upsert({
      where:  { id: 1 },
      update: { data: data as object },
      create: { id: 1, data: data as object },
    });
  } catch {
    // pas grave si la table app_snapshot n'est pas disponible
  }

  // Écriture fichier
  await fs.mkdir(path.dirname(FALLBACK_PATH), { recursive: true });
  const tmp = `${FALLBACK_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, FALLBACK_PATH);
}

export function schedulePersistStore(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistStore().catch((e) => {
      console.warn("[store] Échec sauvegarde :", e instanceof Error ? e.message : e);
    });
  }, 500);
}
