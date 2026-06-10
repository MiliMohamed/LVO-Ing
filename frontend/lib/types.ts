export type LoginResponse = {
  token: string;
  refreshToken: string;
  email: string;
  role: string;
  userId: number;
  agenceId: number;
};

export type UserProfile = {
  id: number;
  email: string;
  role: string;
  prenom: string | null;
  nom: string | null;
  telephone: string | null;
  hasAvatar: boolean;
  agenceId: number | null;
  agenceNom: string | null;
};

export type DashboardCounts = {
  contacts: number;
  clients: number;
  sites: number;
  offresActives: number;
  commandesActives: number;
  factures: number;
};

export type ContactRow = {
  id: number;
  civilite: string;
  nom: string;
  prenom: string;
  entreprise: string;
  fonction: string;
  email: string;
  telephone: string;
  mobile: string;
  ownerUserId?: number | null;
};

export type ClientRow = {
  id: number;
  raisonSociale: string;
  entite: string;
  email: string;
  telephone: string;
  createdAtIso: string;
  siret?: string | null;
  codePostal?: string | null;
  /** Responsable côté client (suivi dossier) */
  responsableEmail?: string | null;
};

export type SiteRow = {
  id: number;
  nom: string;
  typeSite: string;
  clientNom: string;
  /** Entité agence du client propriétaire (filtre périmètre) */
  clientEntite?: string | null;
  statut?: "ACTIF" | "ARCHIVE";
  /** Phase 6 (R3) */
  gestionnairePrincipal?: string | null;
  gestionnairesActifs?: string[];
  /** Registre équipements — nombre actifs + hors service */
  equipementsCount?: number;
};

export type EquipementType = "ASCENSEUR" | "MONTE_CHARGE" | "MONTE_VOITURE" | "PLATEFORME" | "DAE";

export type SiteArborescenceTreeNode = {
  id: number;
  parentId: number | null;
  nom: string;
  nodeType: "FOLDER" | "FILE";
  sortOrder: number;
  sizeBytes: number | null;
  contentType: string | null;
  createdAt: string;
  children: SiteArborescenceTreeNode[];
};

export type SiteEquipementRow = {
  id: number;
  siteId: number;
  type: EquipementType;
  marque: string;
  modele: string;
  numeroSerie: string;
  anneeInstallation: number | null;
  capaciteKg: number | null;
  etages: string | null;
  statut: "ACTIF" | "HORS_SERVICE" | "RETIRE";
  notes: string | null;
  createdAt: string;
};

export type CrmNotificationKind = "TASK_DUE" | "OFFRE_RELANCE" | "FACTURE_RETARD" | "INFO";

export type CrmNotificationRow = {
  id: number;
  userId: number;
  kind: CrmNotificationKind;
  title: string;
  message: string;
  href: string | null;
  entityType: string | null;
  entityId: number | null;
  read: boolean;
  createdAt: string;
  source: "seed" | "system";
};

export type CrmNotificationsResponse = {
  items: CrmNotificationRow[];
  unreadCount: number;
};

/** Phase 6 — GET /api/sites/:id/gestionnaires */
export type SiteGestionnaireRow = {
  id: number;
  siteId: number;
  clientNom: string;
  isPrincipal: boolean;
  dateDebut: string;
  dateFin: string | null;
  notes: string | null;
};

/** Phase 5 — GET /api/audit-log (ADMIN) */
export type AuditLogRow = {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  changes: Record<string, unknown> | null;
  performed_by: string;
  performed_at: string;
  ip_address: string | null;
  user_agent: string | null;
};

export type OffreRow = {
  id: number;
  numeroOffre: string;
  typeMission: string;
  typeMissionsJson?: string | null;
  statut: string;
  montantHt: number;
  dateOffre: string | null;
  clientNom: string;
  siteNom: string;
  phasesMode?: "ALL" | "SELECTION" | "CUSTOM";
  phasesLinesJson?: string | null;
  echeancierFacturationJson?: string | null;
  echeancierExecutionJson?: string | null;
  tauxTva?: number;
  consultantEmail?: string | null;
  gestionnaireNom?: string | null;
  gestionnaireContact?: string | null;
  /** @deprecated — lecture seule si anciennes données */
  gestionnaireEmail?: string | null;
  missionsJson?: string | null;
  /** Présent côté API liste (nombre de lignes missionsJson) */
  missionsCount?: number;
  /** Présent côté API liste — libellé affichage gestionnaire */
  gestionnaireLibelle?: string;
  /** Présent côté API liste — types de mission (ex. MS + MCN) */
  missionsLibelle?: string;
};

export type CommandeRow = {
  id: number;
  numeroCommande: string;
  dateCommande: string | null;
  montantHt: number;
  montantFacture: number;
  typeMission: string;
  typeMissionsJson?: string | null;
  statut?: string | null;
  siteNom: string;
  clientNom: string;
  numeroClient?: string | null;
  /** Dérivé liste GET — affichage missions multiples */
  missionsLibelle?: string;
};

/** Ligne issue de l’échéancier facturation (regroupement par mois) */
export type EcheanceFacturationMoisRow = {
  moisFacturation: string;
  offreId: number;
  numeroOffre: string;
  clientNom: string;
  siteNom: string;
  typeMission: string;
  libelle: string;
  pourcentage: number;
  montantHtEstime: number;
  numeroCommande: string;
  commandeId: number;
};

export type HistoryAnnulationRow = {
  id: number;
  entityType: string;
  entityId: number;
  reference: string;
  motif: string;
  commentaire: string | null;
  montantHt: number;
  clientNom: string;
  cancelledAt: string;
};

/** Statut métier facture (cycle document) */
export type StatutFacturation = "CREEE" | "ENVOYEE" | "ANNULEE" | "PAYEE";

export type FactureRow = {
  id: number;
  numeroFacture: string;
  dateFacture: string | null;
  numeroCommande: string;
  numeroCommandeClient?: string | null;
  clientNom: string;
  montantHt: number;
  frais: number;
  modeReglement: string;
  commandeId?: number;
  statutFacturation?: StatutFacturation;
  statutPaiement?: string;
};

/** Phase 3 — GET /api/recouvrement/kpis */
export type RecouvrementKpis = {
  totalImpayeHt: number;
  totalImpayeTtc?: number;
  facturesEnRetard: number;
  dsoJours?: number;
  /** Top 5 clients : nom + montant impayé HT */
  topClientsEnRetard?: { clientNom: string; montantHt: number }[];
};

/** Phase 3 — GET /api/recouvrement/factures-impayees */
export type FactureImpayeeRow = {
  id: number;
  numeroFacture: string;
  clientNom: string;
  montantHt: number;
  montantTtc?: number;
  dateFacture: string | null;
  dateEcheance: string | null;
  joursRetard: number;
  niveauRelance: number;
  statutPaiement?: string;
};

/** Phase 3 — GET /api/recouvrement/transactions-en-attente (Quonto, score 60–89) */
export type TransactionAttenteRow = {
  id: number | string;
  libelle: string;
  montant: number;
  dateOperation: string;
  score: number;
};
