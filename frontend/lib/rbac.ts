/**
 * Matrice d’accès Phase 2 — alignée fiche PDF v4.0 / docs/crm-compliance-matrix.md
 *
 * ADMIN      — tout + anonymisation RGPD + politiques sensibles
 * MANAGER    — tout sauf anonymisation (export RGPD, pilotage, validations fortes)
 * CONSULTANT — CRM complet + docs / upload / emails / rapports (pas RGPD export)
 * VIEWER     — lecture seule (GET), pas de formulaires de création ni POST métier
 */

export type AppRole = "ADMIN" | "MANAGER" | "CONSULTANT" | "VIEWER";

export function normalizeRole(raw: string | null): AppRole | null {
  if (!raw) return null;
  const u = raw.trim().toUpperCase();
  if (u === "ADMIN" || u === "MANAGER" || u === "CONSULTANT" || u === "VIEWER") return u;
  return null;
}

export function canMutate(role: AppRole | null): boolean {
  return role != null && role !== "VIEWER";
}

export function canUsePhase2Tools(role: AppRole | null): boolean {
  return role === "ADMIN" || role === "MANAGER" || role === "CONSULTANT";
}

export function canAccessRgpdHub(role: AppRole | null): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

export function canExportRgpd(role: AppRole | null): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

export function canAnonymizeRgpd(role: AppRole | null): boolean {
  return role === "ADMIN";
}

/** Phase 3 — Recouvrement & Quonto (plan : rôle MANAGER+) */
export function canAccessRecouvrement(role: AppRole | null): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

/** Phase 5 — suppression client : ADMIN uniquement */
export function canHardDeleteClient(role: AppRole | null): boolean {
  return role === "ADMIN";
}

/** Phase 5 — suppression site : ADMIN ou MANAGER */
export function canHardDeleteSite(role: AppRole | null): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

/** Suppression facture avec historique / avoir (MANAGER+) */
export function canDeleteFactureMetier(role: AppRole | null): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

/** Journal d’audit API (Phase 5) */
export function canViewAuditLog(role: AppRole | null): boolean {
  return role === "ADMIN";
}

/** Tableau de bord KPI + agrégats globaux (réservé administrateur) */
export function canViewDashboardKpi(role: AppRole | null): boolean {
  return role === "ADMIN";
}

/** KPI exécutifs dans Rapports (onglet vue générale, exports KPI) */
export function canViewExecutiveKpi(role: AppRole | null): boolean {
  return role === "ADMIN";
}

/** Compteurs navbar / sidebar (même source que dashboard KPI) */
export function canViewNavCounts(role: AppRole | null): boolean {
  return canViewDashboardKpi(role);
}

/** Page d’accueil par défaut après connexion */
export function getCrmHomeHref(role: AppRole | null): string {
  return canViewDashboardKpi(role) ? "/crm/dashboard" : "/crm/accueil";
}

export function roleBadgeLabel(role: AppRole | null): string {
  switch (role) {
    case "ADMIN":
      return "Administrateur";
    case "MANAGER":
      return "Manager";
    case "CONSULTANT":
      return "Consultant";
    case "VIEWER":
      return "Lecture seule";
    default:
      return "—";
  }
}

export type SidebarNavItem = {
  href: string;
  label: string;
  icon: string;
  /** Bouton « créer » à droite (masqué si non autorisé) */
  quickCreate?: { href: string; shortLabel: string };
  /** Si défini, seuls ces rôles voient l’entrée */
  visibleFor?: readonly AppRole[];
  /** Badge rouge si > 0 factures en retard (compteur via GET /api/recouvrement/kpis) */
  recouvrementBadge?: boolean;
};

export type SidebarSection = { title: string; items: SidebarNavItem[] };

export function itemVisible(item: SidebarNavItem, role: AppRole | null): boolean {
  if (!role) return false;
  if (!item.visibleFor) return true;
  return item.visibleFor.includes(role);
}

export function showQuickCreate(item: SidebarNavItem, role: AppRole | null): boolean {
  return !!(item.quickCreate && canMutate(role));
}

/** Sections sidebar — création rapide à côté du lien métier */
export const SIDEBAR_PHASE2: SidebarSection[] = [
  {
    title: "Navigation",
    items: [
      {
        href: "/crm/dashboard",
        label: "Dashboard KPI",
        icon: "◆",
        visibleFor: ["ADMIN"],
      },
      {
        href: "/crm/accueil",
        label: "Accueil CRM",
        icon: "⌂",
        visibleFor: ["MANAGER", "CONSULTANT", "VIEWER"],
      },
      {
        href: "/crm/taches",
        label: "Mes tâches",
        icon: "✓",
        visibleFor: ["ADMIN", "MANAGER", "CONSULTANT", "VIEWER"],
      },
    ],
  },
  {
    title: "CRM",
    items: [
      {
        href: "/crm/contacts",
        label: "Contacts",
        icon: "◇",
        quickCreate: { href: "/crm/nouveau/contact", shortLabel: "Contact" },
        visibleFor: ["ADMIN", "MANAGER", "CONSULTANT", "VIEWER"],
      },
      {
        href: "/crm/clients",
        label: "Clients",
        icon: "◎",
        quickCreate: { href: "/crm/nouveau/client", shortLabel: "Client" },
        visibleFor: ["ADMIN", "MANAGER", "CONSULTANT", "VIEWER"],
      },
      {
        href: "/crm/sites",
        label: "Sites",
        icon: "▣",
        quickCreate: { href: "/crm/nouveau/site", shortLabel: "Site" },
        visibleFor: ["ADMIN", "MANAGER", "CONSULTANT", "VIEWER"],
      },
    ],
  },
  {
    title: "Commercial",
    items: [
      {
        href: "/crm/offres",
        label: "Offres",
        icon: "▤",
        quickCreate: { href: "/crm/nouveau/offre", shortLabel: "Offre" },
        visibleFor: ["ADMIN", "MANAGER", "CONSULTANT", "VIEWER"],
      },
      {
        href: "/crm/commandes",
        label: "Commandes",
        icon: "▦",
        quickCreate: { href: "/crm/nouveau/commande", shortLabel: "Cmd" },
        visibleFor: ["ADMIN", "MANAGER", "CONSULTANT", "VIEWER"],
      },
      {
        href: "/crm/factures",
        label: "Factures",
        icon: "€",
        quickCreate: { href: "/crm/nouveau/facture", shortLabel: "Fact." },
        visibleFor: ["ADMIN", "MANAGER", "CONSULTANT", "VIEWER"],
      },
      {
        href: "/crm/recouvrement",
        label: "Recouvrement",
        icon: "💰",
        visibleFor: ["ADMIN", "MANAGER"],
        recouvrementBadge: true,
      },
      {
        href: "/crm/nouveau/phases",
        label: "Config. phases",
        icon: "⚙",
        visibleFor: ["ADMIN", "MANAGER", "CONSULTANT"],
      },
      {
        href: "/crm/rapports",
        label: "Rapports",
        icon: "▨",
        visibleFor: ["ADMIN", "MANAGER", "CONSULTANT", "VIEWER"],
      },
      {
        href: "/crm/pipeline",
        label: "Pipeline commercial",
        icon: "⬡",
        visibleFor: ["ADMIN", "MANAGER", "CONSULTANT", "VIEWER"],
      },
    ],
  },
  {
    title: "Documents & flux",
    items: [
      {
        href: "/crm/outils/assistants",
        label: "Assistants (OCR / IA)",
        icon: "AI",
        visibleFor: ["ADMIN", "MANAGER", "CONSULTANT"],
      },
      {
        href: "/crm/outils/documents",
        label: "PDF / Word",
        icon: "DOC",
        visibleFor: ["ADMIN", "MANAGER", "CONSULTANT"],
      },
      {
        href: "/crm/outils/upload",
        label: "Upload & stockage",
        icon: "↑",
        visibleFor: ["ADMIN", "MANAGER", "CONSULTANT"],
      },
      {
        href: "/crm/outils/maintenance-mms",
        label: "Maintenance ascenseurs (MMS)",
        icon: "🛗",
        visibleFor: ["ADMIN", "MANAGER", "CONSULTANT"],
      },
      {
        href: "/crm/outils/emails",
        label: "Messagerie",
        icon: "@",
        visibleFor: ["ADMIN", "MANAGER", "CONSULTANT"],
      },
    ],
  },
  {
    title: "Pilotage",
    items: [
      {
        href: "/crm/outils/planning",
        label: "Planning & échéancier",
        icon: "◴",
        visibleFor: ["ADMIN", "MANAGER", "CONSULTANT", "VIEWER"],
      },
    ],
  },
  {
    title: "Conformité",
    items: [
      {
        href: "/crm/outils/rgpd",
        label: "RGPD & audit",
        icon: "⚖",
        visibleFor: ["ADMIN", "MANAGER"],
      },
      {
        href: "/crm/outils/audit",
        label: "Journal d’audit",
        icon: "📋",
        visibleFor: ["ADMIN"],
      },
    ],
  },
  {
    title: "Historique",
    items: [
      {
        href: "/crm/historique/offres",
        label: "Offres annulées",
        icon: "⎘",
        visibleFor: ["ADMIN", "MANAGER", "CONSULTANT", "VIEWER"],
      },
      {
        href: "/crm/historique/commandes",
        label: "Commandes annulées",
        icon: "⎗",
        visibleFor: ["ADMIN", "MANAGER", "CONSULTANT", "VIEWER"],
      },
      {
        href: "/crm/historique/factures",
        label: "Factures retirées",
        icon: "⌫",
        visibleFor: ["ADMIN", "MANAGER", "CONSULTANT", "VIEWER"],
      },
    ],
  },
];
