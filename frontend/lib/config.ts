const DEV_API_HOSTS = new Set([
  "http://localhost:8080",
  "http://127.0.0.1:8080",
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
