"use client";

import { clearAuthCookies, setAuthCookies } from "@/lib/session-cookie";

const TOKEN = "lvo_token";
const REFRESH = "lvo_refresh_token";
const EMAIL = "lvo_email";
const ROLE = "lvo_role";

export function saveSession(token: string, refreshToken: string | null, email: string, role: string) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(TOKEN, token);
  if (refreshToken) sessionStorage.setItem(REFRESH, refreshToken);
  sessionStorage.setItem(EMAIL, email);
  sessionStorage.setItem(ROLE, role);
  setAuthCookies(email, role);
}

export function clearSession() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(TOKEN);
  sessionStorage.removeItem(REFRESH);
  sessionStorage.removeItem(EMAIL);
  sessionStorage.removeItem(ROLE);
  clearAuthCookies();
}

export function readToken(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(TOKEN);
}

export function readRefreshToken(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(REFRESH);
}

export function saveAccessToken(token: string, refreshToken?: string | null) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(TOKEN, token);
  if (refreshToken) sessionStorage.setItem(REFRESH, refreshToken);
}

export function readEmail(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(EMAIL);
}

export function readRole(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(ROLE);
}
