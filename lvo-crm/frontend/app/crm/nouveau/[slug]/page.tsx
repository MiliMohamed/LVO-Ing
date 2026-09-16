import { notFound } from "next/navigation";

import { NouveauEntityForm, type Slug } from "@/components/crm/NouveauEntityForm";

const META: Record<string, { title: string; subtitle: string; listHref?: string; listLabel?: string }> = {
  contact: { title: "Nouveau contact", subtitle: "Créer un contact avec contrôles de cohérence.", listHref: "/crm/contacts", listLabel: "Voir les contacts" },
  client: { title: "Nouveau client", subtitle: "Créer une fiche client exploitable pour les offres et commandes.", listHref: "/crm/clients", listLabel: "Voir les clients" },
  site: { title: "Nouveau site", subtitle: "Créer un site rattaché à un client existant.", listHref: "/crm/sites", listLabel: "Voir les sites" },
  offre: {
    title: "Nouvelle offre",
    subtitle: "Référence LVO-TYPE-YYnnn (ex. LVO-MOE-26009). La numérotation définitive sera attribuée côté API (compteur annuel).",
    listHref: "/crm/offres",
    listLabel: "Voir les offres",
  },
  commande: {
    title: "Nouvelle commande",
    subtitle: "Référence YYYY-LVO-TYPE-nnn (ex. 2026-LVO-MOE-006), alignée sur le type de mission.",
    listHref: "/crm/commandes",
    listLabel: "Voir les commandes",
  },
  facture: {
    title: "Facturation",
    subtitle: "Référence LVO-FYYYY-nnn (ex. LVO-F2026-001), liée à une commande existante.",
    listHref: "/crm/factures",
    listLabel: "Voir les factures",
  },
  phases: { title: "Configuration des phases", subtitle: "Définir la ventilation conception / exécution et les notes internes." },
};

export default async function NouveauFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = META[slug];
  if (!m) notFound();

  return <NouveauEntityForm key={slug} slug={slug as Slug} meta={m} />;
}
