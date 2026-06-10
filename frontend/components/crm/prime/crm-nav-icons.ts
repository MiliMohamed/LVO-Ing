/** Icônes PrimeIcons pour la navigation CRM */
export const CRM_NAV_ICONS: Record<string, string> = {
  "/crm/dashboard": "pi pi-chart-bar",
  "/crm/contacts": "pi pi-users",
  "/crm/clients": "pi pi-building",
  "/crm/sites": "pi pi-map-marker",
  "/crm/offres": "pi pi-file-edit",
  "/crm/commandes": "pi pi-shopping-cart",
  "/crm/factures": "pi pi-wallet",
  "/crm/recouvrement": "pi pi-exclamation-circle",
  "/crm/nouveau/phases": "pi pi-cog",
  "/crm/rapports": "pi pi-chart-line",
  "/crm/outils/assistants": "pi pi-sparkles",
  "/crm/outils/documents": "pi pi-file-pdf",
  "/crm/outils/upload": "pi pi-upload",
  "/crm/outils/maintenance-mms": "pi pi-wrench",
  "/crm/outils/emails": "pi pi-envelope",
  "/crm/outils/planning": "pi pi-calendar",
  "/crm/outils/rgpd": "pi pi-shield",
  "/crm/outils/audit": "pi pi-list",
  "/crm/historique/offres": "pi pi-history",
  "/crm/historique/commandes": "pi pi-history",
  "/crm/historique/factures": "pi pi-history",
};

export function crmNavIcon(href: string): string {
  return CRM_NAV_ICONS[href] ?? "pi pi-circle";
}

