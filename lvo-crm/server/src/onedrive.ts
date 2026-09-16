/**
 * Client Microsoft Graph minimal pour stocker les documents de site directement dans un
 * OneDrive (compte Microsoft 365 "work/school" — l'auth par identifiants applicatifs ne
 * fonctionne pas sur un OneDrive personnel outlook.com/hotmail.com).
 *
 * Config : variables d'environnement lues à l'appel (voir .env.example à la racine).
 */

const GRAPH = "https://graph.microsoft.com/v1.0";
const SIMPLE_UPLOAD_MAX = 4 * 1024 * 1024; // au-delà, session d'upload par tranches (API Graph)
const UPLOAD_CHUNK_SIZE = 5 * 1024 * 1024; // multiple de 320 Kio, requis par Graph

export type DriveItemRef = { id: string; webUrl: string | null };

function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

export function isOneDriveConfigured(): boolean {
  return (
    env("ONEDRIVE_ENABLED") === "true" &&
    !!env("AZURE_TENANT_ID") &&
    !!env("AZURE_CLIENT_ID") &&
    !!env("AZURE_CLIENT_SECRET") &&
    !!env("ONEDRIVE_USER_EMAIL")
  );
}

export function oneDriveSitesRootFolderName(): string {
  return env("ONEDRIVE_SITES_ROOT_FOLDER_NAME") || "Sites";
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const tenantId = env("AZURE_TENANT_ID");
  const form = new URLSearchParams({
    client_id: env("AZURE_CLIENT_ID"),
    client_secret: env("AZURE_CLIENT_SECRET"),
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!res.ok) throw new Error(`OneDrive : échec OAuth Microsoft (HTTP ${res.status})`);
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("OneDrive : token Microsoft Graph absent de la réponse");
  cachedToken = { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cachedToken.value;
}

function driveBase(): string {
  return `${GRAPH}/users/${encodeURIComponent(env("ONEDRIVE_USER_EMAIL"))}/drive`;
}

async function graphFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

/** Encode chaque segment d'un chemin "/a/b/c" pour l'adressage Graph "root:/a/b/c". */
function encodeItemPath(pathFromRoot: string): string {
  const normalized = pathFromRoot.replace(/^\/+/, "");
  return normalized
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

async function getItemByPath(pathFromRoot: string): Promise<DriveItemRef | null> {
  const encoded = encodeItemPath(pathFromRoot);
  const res = await graphFetch(`${driveBase()}/root:/${encoded}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Microsoft Graph HTTP ${res.status} (getItemByPath ${pathFromRoot})`);
  const json = (await res.json()) as { id: string; webUrl?: string };
  return { id: json.id, webUrl: json.webUrl ?? null };
}

async function createFolder(parentId: string, name: string): Promise<DriveItemRef> {
  const url = parentId === "root" ? `${driveBase()}/root/children` : `${driveBase()}/items/${parentId}/children`;
  const res = await graphFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, folder: {}, "@microsoft.graph.conflictBehavior": "rename" }),
  });
  if (!res.ok) throw new Error(`Microsoft Graph HTTP ${res.status} (createFolder ${name})`);
  const json = (await res.json()) as { id: string; webUrl?: string };
  return { id: json.id, webUrl: json.webUrl ?? null };
}

/** Résout un chemin de dossiers depuis la racine du drive, en créant les segments manquants. */
export async function getOrCreateFolderByPath(pathFromRoot: string): Promise<DriveItemRef> {
  const segments = pathFromRoot.replace(/^\/+/, "").split("/").filter(Boolean);
  let parentId = "root";
  let built = "";
  let last: DriveItemRef | null = null;
  for (const segment of segments) {
    built = built ? `${built}/${segment}` : segment;
    const existing = await getItemByPath(`/${built}`);
    if (existing) {
      last = existing;
      parentId = existing.id;
      continue;
    }
    last = await createFolder(parentId, segment);
    parentId = last.id;
  }
  if (!last) throw new Error("OneDrive : chemin de dossier vide");
  return last;
}

async function uploadSmallFile(
  parentFolderId: string,
  fileName: string,
  buffer: Buffer,
  contentType: string | null,
): Promise<DriveItemRef> {
  const url = `${driveBase()}/items/${parentFolderId}:/${encodeURIComponent(fileName)}:/content`;
  const res = await graphFetch(url, {
    method: "PUT",
    headers: { "Content-Type": contentType || "application/octet-stream" },
    body: new Uint8Array(buffer),
  });
  if (!res.ok) throw new Error(`Microsoft Graph HTTP ${res.status} (upload ${fileName})`);
  const json = (await res.json()) as { id: string; webUrl?: string };
  return { id: json.id, webUrl: json.webUrl ?? null };
}

async function uploadLargeFile(parentFolderId: string, fileName: string, buffer: Buffer): Promise<DriveItemRef> {
  const sessionUrl = `${driveBase()}/items/${parentFolderId}:/${encodeURIComponent(fileName)}:/createUploadSession`;
  const sessionRes = await graphFetch(sessionUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "rename" } }),
  });
  if (!sessionRes.ok) throw new Error(`Microsoft Graph HTTP ${sessionRes.status} (createUploadSession ${fileName})`);
  const session = (await sessionRes.json()) as { uploadUrl: string };

  let offset = 0;
  let last: { id?: string; webUrl?: string } = {};
  while (offset < buffer.length) {
    const end = Math.min(offset + UPLOAD_CHUNK_SIZE, buffer.length);
    const chunk = buffer.subarray(offset, end);
    // L'URL de session est déjà pré-authentifiée : pas de header Authorization ici.
    const res = await fetch(session.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(chunk.length),
        "Content-Range": `bytes ${offset}-${end - 1}/${buffer.length}`,
      },
      body: new Uint8Array(chunk),
    });
    if (!res.ok && res.status !== 202) {
      throw new Error(`Microsoft Graph HTTP ${res.status} (upload chunk ${fileName})`);
    }
    if (res.status !== 202) {
      last = (await res.json()) as { id?: string; webUrl?: string };
    }
    offset = end;
  }
  if (!last.id) throw new Error(`OneDrive : upload de "${fileName}" incomplet`);
  return { id: last.id, webUrl: last.webUrl ?? null };
}

export async function uploadFile(
  parentFolderId: string,
  fileName: string,
  buffer: Buffer,
  contentType: string | null,
): Promise<DriveItemRef> {
  if (buffer.length <= SIMPLE_UPLOAD_MAX) {
    return uploadSmallFile(parentFolderId, fileName, buffer, contentType);
  }
  return uploadLargeFile(parentFolderId, fileName, buffer);
}

export async function downloadFile(itemId: string): Promise<Buffer> {
  const res = await graphFetch(`${driveBase()}/items/${itemId}/content`);
  if (!res.ok) throw new Error(`Microsoft Graph HTTP ${res.status} (download ${itemId})`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function deleteItem(itemId: string): Promise<void> {
  const res = await graphFetch(`${driveBase()}/items/${itemId}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(`Microsoft Graph HTTP ${res.status} (delete ${itemId})`);
}
