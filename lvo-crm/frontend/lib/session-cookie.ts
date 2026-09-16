/** Cookies lisibles par le middleware Next (complément sessionStorage). */

export const COOKIE_AUTH = "lvo_auth";
export const COOKIE_ROLE = "lvo_role";
export const COOKIE_EMAIL = "lvo_email";

/** Cookies espace client */
export const COOKIE_CLIENT_AUTH = "lvo_client_auth";
export const COOKIE_CLIENT_EMAIL = "lvo_client_email";

/** Cookies espace ascensoriste */
export const COOKIE_ASCENSORISTE_AUTH = "lvo_ascensoriste_auth";
export const COOKIE_ASCENSORISTE_EMAIL = "lvo_ascensoriste_email";

/** Cookies Admin Exploitation (auth séparée de l'Admin CRM) */
export const COOKIE_EXPLOITATION_AUTH = "lvo_exploitation_auth";
export const COOKIE_EXPLOITATION_EMAIL = "lvo_exploitation_email";
export const COOKIE_EXPLOITATION_ROLE = "lvo_exploitation_role";

const MAX_AGE_SEC = 7 * 24 * 3600;

function setCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  const enc = encodeURIComponent(value);
  document.cookie = `${name}=${enc}; path=/; max-age=${MAX_AGE_SEC}; SameSite=Lax`;
}

function clearCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

export function setAuthCookies(email: string, role: string) {
  setCookie(COOKIE_AUTH, "1");
  setCookie(COOKIE_ROLE, role);
  setCookie(COOKIE_EMAIL, email);
}

export function clearAuthCookies() {
  clearCookie(COOKIE_AUTH);
  clearCookie(COOKIE_ROLE);
  clearCookie(COOKIE_EMAIL);
}

export function readAuthCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((c) => c.trim().startsWith(`${COOKIE_AUTH}=`));
}

export function setClientAuthCookies(email: string) {
  setCookie(COOKIE_CLIENT_AUTH, "1");
  setCookie(COOKIE_CLIENT_EMAIL, email);
}

export function clearClientAuthCookies() {
  clearCookie(COOKIE_CLIENT_AUTH);
  clearCookie(COOKIE_CLIENT_EMAIL);
}

export function setAscensoristeAuthCookies(email: string) {
  setCookie(COOKIE_ASCENSORISTE_AUTH, "1");
  setCookie(COOKIE_ASCENSORISTE_EMAIL, email);
}

export function clearAscensoristeAuthCookies() {
  clearCookie(COOKIE_ASCENSORISTE_AUTH);
  clearCookie(COOKIE_ASCENSORISTE_EMAIL);
}

export function setExploitationAuthCookies(email: string, role: string) {
  setCookie(COOKIE_EXPLOITATION_AUTH, "1");
  setCookie(COOKIE_EXPLOITATION_EMAIL, email);
  setCookie(COOKIE_EXPLOITATION_ROLE, role);
}

export function clearExploitationAuthCookies() {
  clearCookie(COOKIE_EXPLOITATION_AUTH);
  clearCookie(COOKIE_EXPLOITATION_EMAIL);
  clearCookie(COOKIE_EXPLOITATION_ROLE);
}
