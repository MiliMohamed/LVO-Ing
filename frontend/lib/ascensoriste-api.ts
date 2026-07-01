"use client";

import { getApiBaseUrl } from "@/lib/config";
import { readAscensoristeToken, readAscensoristeRefreshToken, saveAscensoristeAccessToken, clearAscensoristeSession } from "@/lib/token-storage";

function redirectToLogin() {
  clearAscensoristeSession();
  if (typeof window !== "undefined") {
    window.location.href = "/espace-ascensoriste/login";
  }
  throw new Error("SESSION_EXPIRED");
}

async function refreshAndRetry(path: string, init: RequestInit): Promise<Response> {
  const base = getApiBaseUrl();
  const refreshToken = readAscensoristeRefreshToken();
  if (!refreshToken) { redirectToLogin(); throw new Error("SESSION_EXPIRED"); }
  const r = await fetch(`${base}/api/ascensoriste-auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!r.ok) { redirectToLogin(); throw new Error("SESSION_EXPIRED"); }
  const fresh = (await r.json()) as { token: string; refreshToken: string };
  saveAscensoristeAccessToken(fresh.token, fresh.refreshToken);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${fresh.token}`);
  return fetch(`${base}${path}`, { ...init, headers });
}

function authHeaders(): HeadersInit {
  return { Authorization: `Bearer ${readAscensoristeToken() ?? ""}`, Accept: "application/json" };
}

export async function ascensoristeApiFetch<T>(path: string): Promise<T> {
  const base = getApiBaseUrl();
  let res = await fetch(`${base}${path}`, { headers: authHeaders() });
  if (res.status === 401) res = await refreshAndRetry(path, { headers: authHeaders() });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}

export async function ascensoristeApiUpload<T>(path: string, formData: FormData): Promise<T> {
  const base = getApiBaseUrl();
  const token = readAscensoristeToken();
  const init: RequestInit = {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    body: formData,
  };
  let res = await fetch(`${base}${path}`, init);
  if (res.status === 401) res = await refreshAndRetry(path, { ...init, headers: { Authorization: `Bearer ${token ?? ""}`, Accept: "application/json" } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(err.error ?? `${res.status}`);
  }
  return res.json() as Promise<T>;
}
