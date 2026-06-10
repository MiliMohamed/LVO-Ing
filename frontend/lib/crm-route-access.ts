import { getCrmHomeHref, normalizeRole, type AppRole } from "@/lib/rbac";

export type CrmRouteDecision = "allow" | "login" | "redirect";

export type CrmRouteRedirect = {
  decision: "redirect";
  href: string;
};

export type CrmRouteResult =
  | { decision: "allow" }
  | { decision: "login" }
  | CrmRouteRedirect;

type Guard = { test: (path: string) => boolean; roles: readonly AppRole[] };

/** Routes CRM avec rôles explicites (le reste = tout utilisateur authentifié). */
const GUARDS: Guard[] = [
  { test: (p) => p === "/crm/dashboard" || p.startsWith("/crm/dashboard/"), roles: ["ADMIN"] },
  { test: (p) => p.startsWith("/crm/outils/audit"), roles: ["ADMIN"] },
  { test: (p) => p.startsWith("/crm/recouvrement"), roles: ["ADMIN", "MANAGER"] },
  { test: (p) => p.startsWith("/crm/outils/rgpd"), roles: ["ADMIN", "MANAGER"] },
  { test: (p) => p.startsWith("/crm/nouveau"), roles: ["ADMIN", "MANAGER", "CONSULTANT"] },
  {
    test: (p) =>
      p.startsWith("/crm/outils/assistants") ||
      p.startsWith("/crm/outils/documents") ||
      p.startsWith("/crm/outils/upload") ||
      p.startsWith("/crm/outils/emails") ||
      p.startsWith("/crm/outils/maintenance-mms"),
    roles: ["ADMIN", "MANAGER", "CONSULTANT"],
  },
  { test: (p) => p.startsWith("/crm/nouveau/phases"), roles: ["ADMIN", "MANAGER", "CONSULTANT"] },
];

export function evaluateCrmRoute(pathname: string, roleRaw: string | null | undefined): CrmRouteResult {
  if (!pathname.startsWith("/crm")) return { decision: "allow" };

  const hasAuth = roleRaw != null && roleRaw !== "";
  const role = normalizeRole(roleRaw ?? null);

  if (!hasAuth || !role) return { decision: "login" };

  for (const g of GUARDS) {
    if (!g.test(pathname)) continue;
    if (!g.roles.includes(role)) {
      return { decision: "redirect", href: getCrmHomeHref(role) };
    }
  }

  return { decision: "allow" };
}
