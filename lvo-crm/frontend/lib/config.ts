const DEV_API_HOSTS = new Set([
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
]);

/** Base URL des appels CRM. En dev navigateur : même origine (proxy Next → Express, évite CORS / Failed to fetch). */
export function getApiBaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "");
  if (typeof window !== "undefined") {
    if (!v || DEV_API_HOSTS.has(v)) return "";
    return v;
  }
  return v || "http://127.0.0.1:8080";
}

/** Base URL du Document Server ONLYOFFICE (éditeur Word dans le navigateur), atteignable
 * depuis le navigateur — distincte de l'URL que le conteneur utilise pour joindre l'API. */
export function getOnlyofficeUrl(): string {
  return (process.env.NEXT_PUBLIC_ONLYOFFICE_URL ?? "http://localhost:8082").trim().replace(/\/$/, "");
}
