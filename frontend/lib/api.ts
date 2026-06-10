import { getApiBaseUrl } from "@/lib/config";
import { clearSession, readRefreshToken, saveAccessToken } from "@/lib/token-storage";
import type { LoginResponse } from "@/lib/types";

function apiAbsoluteUrl(path: string): string {
  const base = getApiBaseUrl().replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

async function authorizedFetch(
  url: string,
  init: RequestInit & { token?: string | null },
  acceptHeader: string,
): Promise<Response> {
  const makeHeaders = (token: string | null | undefined) => {
    const headers = new Headers(init.headers);
    headers.set("Accept", acceptHeader);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (
      init.body &&
      !(init.body instanceof FormData) &&
      !headers.has("Content-Type") &&
      typeof init.body === "string"
    ) {
      headers.set("Content-Type", "application/json");
    }
    return headers;
  };

  let headers = makeHeaders(init.token);
  let res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    const refreshToken = readRefreshToken();
    if (refreshToken) {
      const refreshRes = await fetch(`${getApiBaseUrl()}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (refreshRes.ok) {
        const fresh = (await refreshRes.json()) as LoginResponse;
        saveAccessToken(fresh.token, fresh.refreshToken);
        headers = makeHeaders(fresh.token);
        res = await fetch(url, { ...init, headers });
      } else {
        clearSession();
      }
    }
  }
  return res;
}

function networkErrorMessage(err: unknown): string {
  if (err instanceof TypeError && /failed to fetch/i.test(err.message)) {
    return "API injoignable — vérifiez que `npm run api:dev` tourne sur le port 8080.";
  }
  return err instanceof Error ? err.message : "Erreur réseau";
}

export async function apiFetch(path: string, init: RequestInit & { token?: string | null } = {}) {
  const url = apiAbsoluteUrl(path);
  let res: Response;
  try {
    res = await authorizedFetch(url, init, "application/json");
  } catch (err) {
    throw new Error(networkErrorMessage(err));
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let msg = text || `${res.status} ${res.statusText}`;
    try {
      const j = JSON.parse(text) as { path?: string; error?: string; message?: string };
      if (typeof j?.error === "string" && j.error.trim()) msg = j.error.trim();
      else if (typeof j?.message === "string" && j.message.trim()) msg = j.message.trim();
      else if (j?.path && !msg.includes(j.path)) msg = `${msg} (${j.path})`;
    } catch {
      /* plain text */
    }
    throw new Error(msg);
  }
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
  return res.json();
}

/** Pour POST documents / exports binaires (PDF, CSV…) avec refresh token */
export async function apiFetchBlob(path: string, init: RequestInit & { token?: string | null } = {}) {
  const url = apiAbsoluteUrl(path);
  const res = await authorizedFetch(url, init, "*/*");
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  return res.blob();
}

/** Réponse texte (CSV, etc.) */
export async function apiFetchText(path: string, init: RequestInit & { token?: string | null } = {}) {
  const url = apiAbsoluteUrl(path);
  const res = await authorizedFetch(url, init, "text/csv,*/*");
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  return res.text();
}
