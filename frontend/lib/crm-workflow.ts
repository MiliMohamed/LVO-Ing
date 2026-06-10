/** Listes métier CRM — statuts en liste déroulante (plus de saisie libre). */

export const CRM_OFFRE_STATUTS = [
  { value: "PISTE", label: "Piste" },
  { value: "ENVOYEE", label: "Envoyée" },
  { value: "ACCEPTEE", label: "Acceptée" },
  { value: "EN_NEGOCIATION", label: "En négociation" },
  { value: "COMMANDE", label: "Commandée" },
  { value: "EN_COURS", label: "En cours" },
  { value: "FACTURE_PARTIELLE", label: "Facturée (partiel)" },
  { value: "FACTUREE", label: "Facturée" },
  { value: "CLOTUREE", label: "Clôturée" },
  { value: "ANNULEE", label: "Annulée" },
] as const;

export const CRM_COMMANDE_STATUTS = [
  { value: "EN_ATTENTE", label: "En attente" },
  { value: "SIGNATURE", label: "Signature" },
  { value: "EN_COURS", label: "En cours" },
  { value: "LIVRE", label: "Livrée" },
  { value: "FACTURE_PARTIELLE", label: "Facturée (partiel)" },
  { value: "FACTUREE", label: "Facturée" },
  { value: "CLOTUREE", label: "Clôturée" },
  { value: "ANNULEE", label: "Annulée" },
] as const;
