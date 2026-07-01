"use client";

import { clearAuthCookies, clearClientAuthCookies, clearAscensoristeAuthCookies, clearExploitationAuthCookies, setAuthCookies, setClientAuthCookies, setAscensoristeAuthCookies, setExploitationAuthCookies } from "@/lib/session-cookie";

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

// ── Espace client ──────────────────────────────────────────────────────────
const CLIENT_TOKEN = "lvo_client_token";
const CLIENT_REFRESH = "lvo_client_refresh_token";
const CLIENT_EMAIL = "lvo_client_email";

export type ClientSession = {
  token: string;
  refreshToken: string;
  email: string;
  contactId: number;
  nom: string;
  prenom: string;
  entreprise: string;
};

export function saveClientSession(data: ClientSession) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(CLIENT_TOKEN, data.token);
  sessionStorage.setItem(CLIENT_REFRESH, data.refreshToken);
  sessionStorage.setItem(CLIENT_EMAIL, data.email);
  sessionStorage.setItem("lvo_client_contact", JSON.stringify({ contactId: data.contactId, nom: data.nom, prenom: data.prenom, entreprise: data.entreprise }));
  setClientAuthCookies(data.email);
}

export function clearClientSession() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(CLIENT_TOKEN);
  sessionStorage.removeItem(CLIENT_REFRESH);
  sessionStorage.removeItem(CLIENT_EMAIL);
  sessionStorage.removeItem("lvo_client_contact");
  clearClientAuthCookies();
}

export function readClientToken(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(CLIENT_TOKEN);
}

export function readClientRefreshToken(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(CLIENT_REFRESH);
}

export function readClientContact(): { contactId: number; nom: string; prenom: string; entreprise: string } | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    return JSON.parse(sessionStorage.getItem("lvo_client_contact") || "null");
  } catch {
    return null;
  }
}

export function saveClientAccessToken(token: string, refreshToken?: string | null) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(CLIENT_TOKEN, token);
  if (refreshToken) sessionStorage.setItem(CLIENT_REFRESH, refreshToken);
}

// ── Espace ascensoriste ─────────────────────────────────────────────────────
const ASCENSORISTE_TOKEN = "lvo_ascensoriste_token";
const ASCENSORISTE_REFRESH = "lvo_ascensoriste_refresh_token";
const ASCENSORISTE_EMAIL = "lvo_ascensoriste_email";

export type AscensoristeSession = {
  token: string;
  refreshToken: string;
  email: string;
  ascensoristeId: number;
  nom: string;
  prenom: string;
  entreprise: string;
};

export function saveAscensoristeSession(data: AscensoristeSession) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(ASCENSORISTE_TOKEN, data.token);
  sessionStorage.setItem(ASCENSORISTE_REFRESH, data.refreshToken);
  sessionStorage.setItem(ASCENSORISTE_EMAIL, data.email);
  sessionStorage.setItem("lvo_ascensoriste_profile", JSON.stringify({ ascensoristeId: data.ascensoristeId, nom: data.nom, prenom: data.prenom, entreprise: data.entreprise }));
  setAscensoristeAuthCookies(data.email);
}

export function clearAscensoristeSession() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(ASCENSORISTE_TOKEN);
  sessionStorage.removeItem(ASCENSORISTE_REFRESH);
  sessionStorage.removeItem(ASCENSORISTE_EMAIL);
  sessionStorage.removeItem("lvo_ascensoriste_profile");
  clearAscensoristeAuthCookies();
}

export function readAscensoristeToken(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(ASCENSORISTE_TOKEN);
}

export function readAscensoristeRefreshToken(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(ASCENSORISTE_REFRESH);
}

export function readAscensoristeProfile(): { ascensoristeId: number; nom: string; prenom: string; entreprise: string } | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    return JSON.parse(sessionStorage.getItem("lvo_ascensoriste_profile") || "null");
  } catch {
    return null;
  }
}

export function saveAscensoristeAccessToken(token: string, refreshToken?: string | null) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(ASCENSORISTE_TOKEN, token);
  if (refreshToken) sessionStorage.setItem(ASCENSORISTE_REFRESH, refreshToken);
}

// ── Admin Exploitation (auth séparée de l'Admin CRM) ────────────────────────
const EXPLOITATION_TOKEN = "lvo_exploitation_token";
const EXPLOITATION_REFRESH = "lvo_exploitation_refresh_token";
const EXPLOITATION_EMAIL = "lvo_exploitation_email";
const EXPLOITATION_ROLE = "lvo_exploitation_role";

export type ExploitationSession = {
  token: string;
  refreshToken: string;
  email: string;
  exploitationUserId: number;
  nom: string;
  prenom: string;
  role: string;
  poste: string | null;
};

/** Le backend (crmOrExploitationMiddleware) mappe ADMIN_EXPLOITATION→ADMIN, le reste→CONSULTANT :
 * on reflète le même mapping côté front pour que les gates RBAC UI (canMutate, etc.) restent cohérents. */
function roleExploitationVersCrm(role: string): string {
  return role === "ADMIN_EXPLOITATION" ? "ADMIN" : "CONSULTANT";
}

export function saveExploitationSession(data: ExploitationSession) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(EXPLOITATION_TOKEN, data.token);
  sessionStorage.setItem(EXPLOITATION_REFRESH, data.refreshToken);
  sessionStorage.setItem(EXPLOITATION_EMAIL, data.email);
  sessionStorage.setItem(EXPLOITATION_ROLE, roleExploitationVersCrm(data.role));
  sessionStorage.setItem(
    "lvo_exploitation_profile",
    JSON.stringify({ exploitationUserId: data.exploitationUserId, nom: data.nom, prenom: data.prenom, poste: data.poste }),
  );
  setExploitationAuthCookies(data.email, data.role);
}

export function readExploitationRole(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(EXPLOITATION_ROLE);
}

export function clearExploitationSession() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(EXPLOITATION_TOKEN);
  sessionStorage.removeItem(EXPLOITATION_REFRESH);
  sessionStorage.removeItem(EXPLOITATION_EMAIL);
  sessionStorage.removeItem("lvo_exploitation_profile");
  clearExploitationAuthCookies();
}

export function readExploitationToken(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(EXPLOITATION_TOKEN);
}

export function readExploitationRefreshToken(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(EXPLOITATION_REFRESH);
}

export function readExploitationProfile(): { exploitationUserId: number; nom: string; prenom: string; poste: string | null } | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    return JSON.parse(sessionStorage.getItem("lvo_exploitation_profile") || "null");
  } catch {
    return null;
  }
}

export function saveExploitationAccessToken(token: string, refreshToken?: string | null) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(EXPLOITATION_TOKEN, token);
  if (refreshToken) sessionStorage.setItem(EXPLOITATION_REFRESH, refreshToken);
}
