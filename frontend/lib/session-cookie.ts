/** Cookies lisibles par le middleware Next (complément sessionStorage). */

export const COOKIE_AUTH = "lvo_auth";
export const COOKIE_ROLE = "lvo_role";
export const COOKIE_EMAIL = "lvo_email";

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
