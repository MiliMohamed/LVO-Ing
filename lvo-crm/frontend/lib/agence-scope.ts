/** Périmètre agence (filtre UI — aligné entités clients démo). */

export type AgenceScopeId = "ALL" | "PARIS" | "REUNION" | "PACA";

export type AgenceScope = {
  id: AgenceScopeId;
  label: string;
  /** Valeurs `client.entite` acceptées */
  entites: string[] | null;
};

export const AGENCE_SCOPES: AgenceScope[] = [
  { id: "ALL", label: "Toutes agences", entites: null },
  { id: "PARIS", label: "Paris & IDF", entites: ["Paris", "Île-de-France"] },
  { id: "REUNION", label: "La Réunion", entites: ["974"] },
  { id: "PACA", label: "PACA", entites: ["PACA", "Sophia-Antipolis"] },
];

const STORAGE_KEY = "lvo_agence_scope";

export function readAgenceScope(): AgenceScopeId {
  if (typeof window === "undefined") return "ALL";
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === "PARIS" || raw === "REUNION" || raw === "PACA" || raw === "ALL") return raw;
  return "ALL";
}

export function saveAgenceScope(id: AgenceScopeId) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, id);
  window.dispatchEvent(new Event("lvo-agence-scope"));
}

export function onAgenceScopeChange(handler: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("lvo-agence-scope", handler);
  return () => window.removeEventListener("lvo-agence-scope", handler);
}

export function scopeDef(id: AgenceScopeId): AgenceScope {
  return AGENCE_SCOPES.find((s) => s.id === id) ?? AGENCE_SCOPES[0];
}

/** Filtre générique sur une propriété entite/agence du row. */
export function rowMatchesAgenceScope(row: Record<string, unknown>, scopeId: AgenceScopeId): boolean {
  const def = scopeDef(scopeId);
  if (!def.entites) return true;
  const ent =
    (row.entite as string | undefined) ??
    (row.agence as string | undefined) ??
    (row.clientEntite as string | undefined);
  if (!ent) return true;
  return def.entites.some((e) => ent.toLowerCase().includes(e.toLowerCase()));
}
