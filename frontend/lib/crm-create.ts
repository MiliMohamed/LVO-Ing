/** Liens « Nouveau … » — formulaires /crm/nouveau/[slug] */
export type CrmCreateSlug =
  | "contact"
  | "client"
  | "site"
  | "offre"
  | "commande"
  | "facture"
  | "phases";

export const CRM_CREATE: Record<
  CrmCreateSlug,
  { href: string; label: string; buttonLabel: string }
> = {
  contact: {
    href: "/crm/nouveau/contact",
    label: "Contact",
    buttonLabel: "Nouveau contact",
  },
  client: {
    href: "/crm/nouveau/client",
    label: "Client",
    buttonLabel: "Nouveau client",
  },
  site: {
    href: "/crm/nouveau/site",
    label: "Site",
    buttonLabel: "Nouveau site",
  },
  offre: {
    href: "/crm/nouveau/offre",
    label: "Offre",
    buttonLabel: "Nouvelle offre",
  },
  commande: {
    href: "/crm/nouveau/commande",
    label: "Commande",
    buttonLabel: "Nouvelle commande",
  },
  facture: {
    href: "/crm/nouveau/facture",
    label: "Facture",
    buttonLabel: "Nouvelle facture",
  },
  phases: {
    href: "/crm/nouveau/phases",
    label: "Config. phases",
    buttonLabel: "Configurer les phases",
  },
};
