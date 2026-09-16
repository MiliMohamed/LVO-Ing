/**
 * Singletons Prisma (PostgreSQL) + MinIO.
 * Importé partout où la DB ou le stockage objet est nécessaire.
 */
import { PrismaClient } from "@prisma/client";
import { Client as MinioClient } from "minio";

// ─── Prisma ───────────────────────────────────────────────────────────────────

let _prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }
  return _prisma;
}

// ─── MinIO ────────────────────────────────────────────────────────────────────

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT ?? "localhost";
const MINIO_PORT     = Number(process.env.MINIO_PORT ?? "9000");
const MINIO_ACCESS   = process.env.MINIO_ACCESS_KEY ?? "lvo_minio";
const MINIO_SECRET   = process.env.MINIO_SECRET_KEY ?? "lvo_minio_dev_change_me";
const MINIO_USE_SSL  = process.env.MINIO_USE_SSL === "true";

export const MINIO_BUCKETS = {
  sites:       "lvo-sites",       // fichiers arborescence documentaire
  mms:         "lvo-mms",         // rapports MMS (Excel, Word, PDF)
  clientDocs:  "lvo-client-docs", // documents déposés par les clients
  documents:   "lvo-documents",   // versions documents CRM (offres, factures…)
} as const;

let _minio: MinioClient | null = null;

export function getMinio(): MinioClient {
  if (!_minio) {
    _minio = new MinioClient({
      endPoint:  MINIO_ENDPOINT,
      port:      MINIO_PORT,
      useSSL:    MINIO_USE_SSL,
      accessKey: MINIO_ACCESS,
      secretKey: MINIO_SECRET,
    });
  }
  return _minio;
}

/** Crée les buckets MinIO s'ils n'existent pas encore. Appelé au démarrage. */
export async function ensureMinioBuckets(): Promise<void> {
  const minio = getMinio();
  for (const bucket of Object.values(MINIO_BUCKETS)) {
    try {
      const exists = await minio.bucketExists(bucket);
      if (!exists) {
        await minio.makeBucket(bucket, "us-east-1");
        console.log(`[minio] Bucket créé : ${bucket}`);
      }
    } catch (e) {
      console.warn(`[minio] Impossible de vérifier/créer le bucket "${bucket}" :`, (e as Error).message);
    }
  }
}

/**
 * Upload un buffer vers MinIO et retourne la clé.
 * key = chemin relatif dans le bucket (ex: "sites/123/rapport.docx")
 */
export async function minioUpload(
  bucket: string,
  key: string,
  data: Buffer,
  contentType = "application/octet-stream",
): Promise<string> {
  const minio = getMinio();
  await minio.putObject(bucket, key, data, data.length, { "Content-Type": contentType });
  return key;
}

/**
 * Upload un fichier depuis un chemin local vers MinIO.
 * Utilisé lors de la migration initiale des fichiers locaux.
 */
export async function minioUploadFile(
  bucket: string,
  key: string,
  localPath: string,
  contentType = "application/octet-stream",
): Promise<string> {
  const minio = getMinio();
  await minio.fPutObject(bucket, key, localPath, { "Content-Type": contentType });
  return key;
}

/** Récupère un objet MinIO sous forme de Buffer. */
export async function minioDownload(bucket: string, key: string): Promise<Buffer> {
  const minio = getMinio();
  const stream = await minio.getObject(bucket, key);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

/** Génère une URL présignée valable `expirySeconds` secondes (défaut 1h). */
export async function minioPresignedUrl(
  bucket: string,
  key: string,
  expirySeconds = 3600,
): Promise<string> {
  const minio = getMinio();
  return minio.presignedGetObject(bucket, key, expirySeconds);
}

/** Supprime un objet MinIO. */
export async function minioDelete(bucket: string, key: string): Promise<void> {
  const minio = getMinio();
  await minio.removeObject(bucket, key);
}
