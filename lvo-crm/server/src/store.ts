/** Données en mémoire — IDs numériques (compatibles avec le front actuel). */

export type StatutPaiement = "NON_PAYE" | "PARTIELLEMENT_PAYE" | "PAYE" | "EN_RETARD";

/** Cycle de vie facture (métier) — distinct du recouvrement */
export type StatutFacturation = "CREEE" | "ENVOYEE" | "ANNULEE" | "PAYEE";

export type UserRow = {
  id: number;
  email: string;
  passwordHash: string;
  role: string;
  prenom?: string | null;
  nom?: string | null;
  telephone?: string | null;
  agenceId?: number | null;
  avatarDataUrl?: string | null;
};

export type CrmTaskRow = {
  id: number;
  userId: number;
  title: string;
  dueDate: string | null;
  dueHour: number | null;
  dueMinute: number | null;
  done: boolean;
  entityType: string | null;
  entityId: number | null;
  createdAt: string;
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
  statut: "ACTIF" | "ANNULE" | "ARCHIVE";
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  /** Créateur / rattachement consultant (Phase 5 — suppression restreinte) */
  ownerUserId?: number | null;
  /** Mot de passe hashé pour l'espace client */
  clientPasswordHash?: string | null;
};

export type ClientRow = {
  id: number;
  raisonSociale: string;
  entite: string;
  email: string;
  telephone: string;
  createdAtIso: string;
  statut: "ACTIF" | "ANNULE" | "ARCHIVE";
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  /** SIRET — modification loguée audit (Phase 5) */
  siret?: string | null;
  /** Code postal — règle TVA DOM vs métropole (Phase 9) */
  codePostal?: string | null;
  /** Responsable côté client (suivi / étapes — email ou libellé) */
  responsableEmail?: string | null;
};

export type SiteRow = {
  id: number;
  nom: string;
  typeSite: string;
  clientNom: string;
  /** Phase 5 — masquage liste sans hard delete */
  statut?: "ACTIF" | "ARCHIVE";
  /** Image du site stockée en base64 data URL */
  imageDataUrl?: string | null;
  /** Adresse postale du site — utilisée notamment dans le courrier de l'offre générée */
  adresse?: string | null;
};

/** Phase 6 — gestionnaires tiers (R3), aligné Prisma `site_gestionnaires` */
export type SiteGestionnaireRow = {
  id: number;
  siteId: number;
  /** Raison sociale client gestionnaire (= `clients.raisonSociale` en démo) */
  clientNom: string;
  /** Contact (personne, fonction gestionnaire) représentant ce client gestionnaire */
  contactId: number | null;
  contactNom: string | null;
  isPrincipal: boolean;
  dateDebut: string;
  dateFin: string | null;
  notes: string | null;
};

export type EquipementType = "ASCENSEUR" | "MONTE_CHARGE" | "MONTE_VOITURE" | "PLATEFORME" | "DAE" | "ESCALIER_MECANIQUE";

/** Nœud arborescence documentaire interne par site (dossier ou fichier) */
export type SiteArborescenceNodeRow = {
  id: number;
  siteId: number;
  parentId: number | null;
  nodeType: "FOLDER" | "FILE";
  nom: string;
  sortOrder: number;
  storedPath: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  uploadedByUserId: number | null;
  createdAt: string;
};

/** Registre équipements par site (ascenseurs, monte-charges, etc.) */
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

/** Référentiel des types d'équipements (Ascenseur, Monte-charge, Escalator…) — extensible à la volée. */
export type TypeEquipementRow = {
  id: number;
  libelle: string;
  actif: boolean;
};

/** Inventaire quantitatif équipements par site — indépendant du registre détaillé `SiteEquipementRow`. */
export type SiteEquipementQteRow = {
  id: number;
  siteId: number;
  typeEquipementId: number;
  quantite: number;
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

export type OffreRow = {
  id: number;
  numeroOffre: string;
  typeMission: string;
  /** JSON string[] — types de mission couverts par l’offre */
  typeMissionsJson?: string | null;
  statut: string;
  montantHt: number;
  dateOffre: string | null;
  clientNom: string;
  siteNom: string;
  /** Phase 7 — ALL | SELECTION | CUSTOM */
  phasesMode?: "ALL" | "SELECTION" | "CUSTOM";
  /** JSON : { code, libelle, montantHt, inclus }[] */
  phasesLinesJson?: string | null;
  /** JSON : { prestation, delai }[] — section "Délais et calendrier prévisionnel" du document d'offre */
  delaisLignesJson?: string | null;
  /** JSON tableaux échéancier facturation / exécution (Phase 9) */
  echeancierFacturationJson?: string | null;
  echeancierExecutionJson?: string | null;
  tauxTva?: number;
  consultantEmail?: string | null;
  /** Gestionnaire offre — raison sociale (syndic, prestataire, propriétaire — Phase 6) */
  gestionnaireNom?: string | null;
  /** Personne de contact chez le gestionnaire (nom, email, téléphone) */
  gestionnaireContact?: string | null;
  /** @deprecated Ancien champ email interne LVO — conservé pour compatibilité lecture */
  gestionnaireEmail?: string | null;
  /** JSON : { code, libelle, montantHt? }[] — missions composant l’offre */
  missionsJson?: string | null;
  /** Décision client depuis espace client : { decision, decidedAt, decidedBy, commentaire? } */
  clientDecisionJson?: string | null;
  /** JSON — paramètres de saisie bruts du calcul auto par type (Audit/MM/MOE/MS), cf. offre-mission-calc.ts */
  missionCalcJson?: string | null;
  /** JSON : { phase, montant, modalite }[] — lignes d’échéancier finales calculées, prêtes pour le rendu Word */
  echeancierRowsJson?: string | null;
};

export type CommandeRow = {
  id: number;
  numeroCommande: string;
  dateCommande: string | null;
  montantHt: number;
  montantFacture: number;
  typeMission: string;
  /** JSON string[] — types de mission couverts par la commande (offre multi-missions) */
  typeMissionsJson?: string | null;
  /** Cycle de vie commande (liste CRM) */
  statut?: string | null;
  siteNom: string;
  clientNom: string;
  /** N° bon / commande chez le client (Phase 9) */
  numeroClient?: string | null;
  /** Offre d'origine — figé à la création, non modifiable ensuite */
  offreId?: number | null;
  /** Gestionnaire (client) et son contact — hérités de l'offre d'origine ou du site à la création */
  gestionnaireNom?: string | null;
  gestionnaireContact?: string | null;
  /** Paiement en une fois ou échelonné (échéances avec montant + date) */
  modePaiementCommande?: "UNIQUE" | "ECHELONNE" | null;
  /** JSON : { montant: number, date: string }[] — uniquement si ECHELONNE */
  echeancierPaiementJson?: string | null;
};

export type FactureRow = {
  id: number;
  numeroFacture: string;
  dateFacture: string | null;
  numeroCommande: string;
  clientNom: string;
  montantHt: number;
  frais: number;
  modeReglement: string;
  /** Rappel N° commande client sur PDF (Phase 9) */
  numeroCommandeClient?: string | null;
  /** Phase 2 / 3 */
  dateEcheance: string | null;
  statutPaiement: StatutPaiement;
  montantPaye: number;
  niveauRelance: number;
  derniereRelanceAt: string | null;
  /** Lien métier pour annulation / avoirs */
  commandeId: number;
  /** Créée (brouillon) → Envoyée → Payée ; Annulée si suppression métier */
  statutFacturation?: StatutFacturation;
};

/**
 * Échéancier de paiement relationnel par commande — distinct de
 * `CommandeRow.echeancierPaiementJson` (simple note JSON du mode de paiement) : ici chaque ligne
 * a un statut et peut être liée à la Facture générée automatiquement à échéance.
 */
export type EcheancePaiementRow = {
  id: number;
  commandeId: number;
  ordre: number;
  libelle: string;
  pourcentage: number | null;
  montantHt: number;
  dateEcheance: string;
  statut: "A_VENIR" | "FACTUREE" | "PAYEE" | "ANNULEE";
  factureId: number | null;
  createdAt: string;
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

export type AvoirRow = {
  id: number;
  numero: string;
  factureOrigineId: number;
  commandeId: number;
  motif: string;
  montantHt: number;
  tauxTva: number;
  montantTtc: number;
  createdAt: string;
};

export type PendingQuontoTx = {
  id: number;
  libelle: string;
  montant: number;
  dateOperation: string;
  score: number;
  quontoTransactionId: string;
};

/** Journal d’audit Phase 5 (mémoire — cible Prisma en prod) */
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

/** Phase 7 — référentiel phases par type de mission (démo mémoire) */
export type PhaseReferentielRow = {
  typeMission: string;
  code: string;
  libelle: string;
  prixIndicatifHt: number;
  ordre: number;
};

export const PHASES_REFERENTIEL: PhaseReferentielRow[] = [
  { typeMission: "MS", code: "MS-REG", libelle: "Mission réglementaire / obligations code du travail", prixIndicatifHt: 3200, ordre: 1 },
  { typeMission: "MS", code: "MS-VP", libelle: "Visites périodiques & registre", prixIndicatifHt: 2100, ordre: 2 },
  { typeMission: "MS", code: "MS-AST", libelle: "Assistance technique & mise en conformité", prixIndicatifHt: 4500, ordre: 3 },
  { typeMission: "MOE", code: "MOE-DCE", libelle: "DCE / consultation entreprises", prixIndicatifHt: 12000, ordre: 1 },
  { typeMission: "MOE", code: "MOE-EXE", libelle: "Exécution & suivi de chantier", prixIndicatifHt: 22000, ordre: 2 },
  { typeMission: "MOE", code: "MOE-REC", libelle: "Réception & dossier des ouvrages", prixIndicatifHt: 8000, ordre: 3 },
  { typeMission: "MCN", code: "MCN-DIAG", libelle: "Diagnostic ascenseur existant", prixIndicatifHt: 1800, ordre: 1 },
  { typeMission: "MCN", code: "MCN-MOD", libelle: "Modernisation partielle / sécurité", prixIndicatifHt: 6500, ordre: 2 },
  { typeMission: "MCM", code: "MCM-CONT", libelle: "Contrat maintenance préventive", prixIndicatifHt: 4800, ordre: 1 },
  { typeMission: "MCM", code: "MCM-AST", libelle: "Astreinte & dépannage (hors pièces)", prixIndicatifHt: 1200, ordre: 2 },
];

/** Phase 8 — versions document (stub S3 + archivage OneDrive simulé) */
export type FichierVersionRow = {
  id: number;
  reference: string;
  docType: "OFFRE" | "COMMANDE" | "FACTURE";
  version: number;
  format: string;
  createdAt: string;
  storage: "CURRENT" | "ONEDRIVE_ARCHIVE_STUB";
  storageKey: string;
};

export const fichierVersions: FichierVersionRow[] = [];

/** Bibliothèque MMS — métadonnées d'une analyse archivée (fichiers stockés sur disque) */
export type MmsRapportRow = {
  id: number;
  prestataire: string;
  client: string;
  trimestre: string;
  annee: number;
  createdAt: string;
  createdByUserId: number;
  nbAppareils: number;
  nbInterventions: number;
  nbPannes: number;
  nbVisites: number;
  penaliteTotale: number;
  excelNom: string;
  wordNom: string;
  pdfNom: string | null;
  excelPath: string;
  wordPath: string;
  pdfPath: string | null;
  excelSizeBytes: number;
  wordSizeBytes: number;
  pdfSizeBytes: number | null;
  /** Site concerné par ce rapport (optionnel) */
  siteId?: number | null;
};

export const mmsRapports: MmsRapportRow[] = [];

/** Phase 10 — procédure e-signature stub (Yousign) */
export const offreSignatures = new Map<number, { procedureId: string; status: "NONE" | "PENDING" | "SIGNED" }>();

// ── Espace Client — Messagerie ──────────────────────────────────────────────
export type ClientMessageRow = {
  id: number;
  threadId: string;
  entreprise: string;
  subject: string;
  body: string;
  senderType: "CLIENT" | "CRM";
  senderName: string;
  senderEmail: string;
  createdAt: string;
  readByClient: boolean;
  readByCrm: boolean;
};

// ── Espace Client — Documents déposés par le client ────────────────────────
export type ClientDocumentType = "DEVIS" | "BON_COMMANDE" | "PLAN" | "RAPPORT" | "CERTIFICAT" | "AUTRE";
export type ClientDocumentStatut = "EN_ATTENTE" | "VALIDE" | "REJETE";

export type ClientDocumentRow = {
  id: number;
  entreprise: string;
  contactId: number;
  /** Phase multi-sites : site où le document appartient */
  siteId?: number | null;
  nom: string;
  type: ClientDocumentType;
  fileName: string;
  storedPath: string;
  sizeBytes: number;
  contentType: string;
  uploadedAt: string;
  statut: ClientDocumentStatut;
  motifRejet?: string | null;
  validatedAt?: string | null;
  offreId?: number | null;
  commandeId?: number | null;
  notes?: string | null;
};

// ── Espace Client — Notifications ───────────────────────────────────────────
export type ClientNotificationKind = "MESSAGE" | "OFFRE_UPDATE" | "FACTURE" | "DOCUMENT" | "INFO";

export type ClientNotificationRow = {
  id: number;
  entreprise: string;
  title: string;
  message: string;
  kind: ClientNotificationKind;
  href: string | null;
  read: boolean;
  createdAt: string;
};

// ── Espace Client — Config Alertes ──────────────────────────────────────────
export type ClientAlertesConfig = {
  entreprise: string;
  factureImpayee: boolean;
  factureImpayeeDelaiJours: number;
  contratExpirant: boolean;
  panneSignalee: boolean;
  mmsSousSeuilCritique: boolean;
  mmsSeuil: number;
  offreExpirant: boolean;
  visiteReglementaire: boolean;
  updatedAt: string;
};

// ── Espace Client — Contrats ────────────────────────────────────────────────
export type ClientContratStatut = "ACTIF" | "EXPIRE" | "RESILIE" | "EN_RENOUVELLEMENT";

export type ClientContratRow = {
  id: number;
  entreprise: string;
  reference: string;
  intitule: string;
  siteId: number | null;
  siteNom: string;
  typeContrat: string;
  dateDebut: string;
  dateFin: string;
  montantAnnuelHt: number;
  prestataire: string;
  statut: ClientContratStatut;
  conditionsRenouvellement: string | null;
  clauseRevisionTarifaire: string | null;
  /** JSON : { date, description }[] */
  avenantsJson: string | null;
  demandeRenouvellementAt: string | null;
};

// ── Espace Client — Interventions & Pannes ──────────────────────────────────
export type ClientInterventionStatut = "CREEE" | "ASSIGNEE" | "EN_COURS" | "RESOLUE" | "A_VALIDER";
export type ClientInterventionPriorite = "NORMALE" | "URGENTE" | "CRITIQUE";
export type ClientInterventionType = "PANNE" | "MAINTENANCE_PREVENTIVE" | "VISITE_REGLEMENTAIRE" | "MISE_EN_CONFORMITE" | "AUTRE";

export type ClientInterventionRow = {
  id: number;
  entreprise: string;
  reference: string;
  siteId: number | null;
  siteNom: string;
  equipementId: number | null;
  equipementLibelle: string | null;
  type: ClientInterventionType;
  priorite: ClientInterventionPriorite;
  statut: ClientInterventionStatut;
  description: string;
  prestataire: string | null;
  declaredAt: string;
  assignedAt: string | null;
  resolvedAt: string | null;
  compteRendu: string | null;
  declaredByContactId: number;
  declaredByName: string;
};

/** Phase 9 — paramètres applicatifs démo */
export const crmAppSettings = {
  defaultConsultantEmail: "consultant@lvo-ing.fr",
  tvaMetropolePercent: 20,
  tvaDomPercent: 8.5,
} as const;

const DOM_TOM_NOMS = ["REUNION", "GUADELOUPE", "MARTINIQUE", "GUYANE", "MAYOTTE"];

export function isClientDomTom(cl: Pick<ClientRow, "entite" | "codePostal"> | undefined): boolean {
  if (!cl) return false;
  const e = String(cl.entite || "").trim();
  if (/^(97|98)\d{1}/.test(e.replace(/\s/g, ""))) return true;
  if (e === "974" || e === "971" || e === "972" || e === "973" || e === "976" || e === "978") return true;
  const eNorm = e.toUpperCase().normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "");
  if (DOM_TOM_NOMS.some((nom) => eNorm.includes(nom))) return true;
  const cp = String(cl.codePostal || "").replace(/\s/g, "");
  if (/^(97|98)\d{3}/.test(cp)) return true;
  return false;
}

export function pushDocumentVersion(input: {
  reference: string;
  docType: "OFFRE" | "COMMANDE" | "FACTURE";
  format: string;
  /** Clé de stockage réelle (MinIO). Si absente, une clé stub demo est générée. */
  storageKey?: string;
  /**
   * Numéro de version explicite — utilisé pour attacher un format alternatif (ex. PDF) à une
   * version DOCX déjà existante, sans déclencher l'archivage de la version CURRENT ni
   * incrémenter le compteur. Si absent, comportement normal (nouvelle version, archive la
   * précédente CURRENT).
   */
  version?: number;
}): FichierVersionRow {
  const id = Math.max(0, ...fichierVersions.map((x) => x.id), 0) + 1;

  if (input.version != null) {
    const row: FichierVersionRow = {
      id,
      reference: input.reference,
      docType: input.docType,
      version: input.version,
      format: input.format,
      createdAt: new Date().toISOString(),
      storage: "CURRENT",
      storageKey: input.storageKey ?? `s3://lvo-demo/${input.docType}/${input.reference}_v${input.version}.${input.format}`,
    };
    fichierVersions.push(row);
    return row;
  }

  for (const v of fichierVersions) {
    if (v.reference === input.reference && v.docType === input.docType && v.format === input.format && v.storage === "CURRENT") {
      // Marque la version précédente comme non-courante SANS toucher à storageKey : le fichier
      // réel reste en place (MinIO) et doit rester téléchargeable/éditable indéfiniment — c'est
      // tout le principe du versioning ("jamais d'écrasement"). storageKey pointait auparavant
      // vers un faux placeholder OneDrive ici, ce qui cassait l'accès aux anciennes versions.
      v.storage = "ONEDRIVE_ARCHIVE_STUB";
    }
  }
  const same = fichierVersions.filter((v) => v.reference === input.reference && v.docType === input.docType);
  const nextVer = same.length ? Math.max(...same.map((x) => x.version)) + 1 : 1;
  const row: FichierVersionRow = {
    id,
    reference: input.reference,
    docType: input.docType,
    version: nextVer,
    format: input.format,
    createdAt: new Date().toISOString(),
    storage: "CURRENT",
    storageKey: input.storageKey ?? `s3://lvo-demo/${input.docType}/${input.reference}_v${nextVer}.${input.format}`,
  };
  fichierVersions.push(row);
  return row;
}

let nextId = 1;
function nid() {
  return nextId++;
}

export const users: UserRow[] = [];

export const contacts: ContactRow[] = [];
export const ascensoristes: AscensoristeRow[] = [];
export const exploitationUsers: ExploitationUserRow[] = [];
export const clients: ClientRow[] = [];
export const sites: SiteRow[] = [];
export const siteGestionnaires: SiteGestionnaireRow[] = [];
export const siteEquipements: SiteEquipementRow[] = [];
export const typesEquipement: TypeEquipementRow[] = [];
export const siteEquipementsQte: SiteEquipementQteRow[] = [];
export const siteArborescenceNodes: SiteArborescenceNodeRow[] = [];
export const offres: OffreRow[] = [];
export const commandes: CommandeRow[] = [];
export const factures: FactureRow[] = [];
export const echeancesPaiement: EcheancePaiementRow[] = [];
export const historiqueAnnulations: HistoryAnnulationRow[] = [];
export const avoirs: AvoirRow[] = [];
export const pendingQuonto: PendingQuontoTx[] = [];
export const auditLog: AuditLogRow[] = [];
export const crmTasks: CrmTaskRow[] = [];
export const crmNotifications: CrmNotificationRow[] = [];
export const clientMessages: ClientMessageRow[] = [];
export const clientDocuments: ClientDocumentRow[] = [];
export const clientNotifications: ClientNotificationRow[] = [];
export const clientInterventions: ClientInterventionRow[] = [];
export const clientContrats: ClientContratRow[] = [];
export const clientAlertesConfigs: ClientAlertesConfig[] = [];

// ── Espace Ascensoriste — Comptes prestataires ──────────────────────────────

export type AscensoristeRow = {
  id: number;
  entreprise: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  ascensoristePasswordHash: string | null;
  statut: "ACTIF" | "ARCHIVE";
  createdAt: string;
};

// ── Admin Exploitation — Comptes internes (auth séparée de l'Admin CRM) ─────

export type ExploitationUserRow = {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  poste: string | null;
  exploitationPasswordHash: string | null;
  role: "ADMIN_EXPLOITATION" | "AGENT_EXPLOITATION";
  statut: "ACTIF" | "ARCHIVE";
  createdAt: string;
};

// ── Devis Groupement — Appareils ────────────────────────────────────────────

export type AppareilRow = {
  id: number;
  numero: string;
  label: string | null;
  clientNom: string;
  siteNom: string | null;
  entreprise: string | null;
  enArret: boolean;
  createdAt: string;
};

// ── Devis Groupement — Statuts workflow ─────────────────────────────────────

export type DevisGroupementStatut =
  | "EN_ATTENTE"
  | "EN_NEGOCIATION"
  | "VALIDE"
  | "REFUSE"
  | "SIGNE"
  | "TERMINE";

export type PvFichierRow = {
  nom: string;
  url: string;
  sizeBytes: number;
  contentType: string;
};

export type BonCommandeExtractionRow = {
  numero: string | null;
  adresse: string | null;
  fournisseur: string | null;
  client: string | null;
  montantTtc: number | null;
  /** Référence d'une offre/devis LVO mentionnée sur le bon de commande (ex. LVO-APS-26029) */
  referenceDevis: string | null;
};

export type DevisGroupementRow = {
  id: number;
  numeroDevis: string;
  clientNom: string;
  appareilId: number | null;
  numeroAppareil: string | null;
  entreprise: string | null;
  dateDevis: string | null;
  objet: string | null;
  montantHt: number | null;
  tauxTva: number;
  montantTva: number | null;
  montantTtc: number | null;
  ascenseurArret: boolean;
  avisLvo: string | null;
  estimatifLvoHt: number | null;
  montantNegocieHt: number | null;
  economieHt: number | null;
  statut: DevisGroupementStatut;
  documentUrl: string | null;
  documentNom: string | null;
  documentSizeBytes: number | null;
  signatureAdminUrl: string | null;
  signatureClientUrl: string | null;
  signatureClientDate: string | null;
  documentOverlayApplied: boolean;
  bonCommandeUrl: string | null;
  bonCommandeNom: string | null;
  bonCommandeUploadedAt: string | null;
  bonCommandeExtraction: BonCommandeExtractionRow | null;
  pvFichiers: PvFichierRow[];
  pvDate: string | null;
  pvCommentaire: string | null;
  pvUploadedAt: string | null;
  motif: "vandalisme" | "intemperies_oxydation" | "mauvaise_utilisation" | "vetuste" | null;
  motifRefus: string | null;
  conditionsPaiement: string | null;
  batiment: string | null;
  adresse: string | null;
  uploadedByContactId: number | null;
  uploadedByAscensoristeId: number | null;
  createdAt: string;
  updatedAt: string;
};

export type NegociationMessageRow = {
  id: number;
  devisId: number;
  auteurRole: "ADMIN" | "CLIENT";
  auteurNom: string | null;
  message: string;
  prixPropose: number | null;
  createdAt: string;
};

export const appareils: AppareilRow[] = [];
export const devisGroupement: DevisGroupementRow[] = [];
export const negociationMessages: NegociationMessageRow[] = [];

// ── Suivi hebdomadaire des appareils à l'arrêt (upload ascensoriste) ───────

export type AppareilArretUploadRow = {
  id: number;
  ascensoristeId: number;
  entreprise: string;
  fileName: string;
  documentUrl: string;
  weekStart: string;
  weekEnd: string;
  rowsCount: number;
  rowsErrors: number;
  createdAt: string;
};

export type AppareilArretRow = {
  id: number;
  uploadId: number;
  ascensoristeId: number;
  entreprise: string;
  appareilId: number | null;
  numeroAppareil: string;
  clientNom: string;
  adresse: string | null;
  dateArret: string | null;
  cause: string | null;
  etape: string | null;
  piecesEnStock: boolean | null;
  devisNumero: string | null;
  devisDate: string | null;
  validationDate: string | null;
  osNumero: string | null;
  executionDate: string | null;
  remiseDate: string | null;
  commentaire: string | null;
  weekStart: string;
  weekEnd: string;
  createdAt: string;
};

export const appareilsArretUploads: AppareilArretUploadRow[] = [];
export const appareilsArretRows: AppareilArretRow[] = [];

const AGENCE_LABELS: Record<number, string> = {
  1: "Paris",
  2: "La Réunion",
  3: "PACA",
};

export function userProfileDto(u: UserRow) {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    prenom: u.prenom ?? null,
    nom: u.nom ?? null,
    telephone: u.telephone ?? null,
    hasAvatar: Boolean(u.avatarDataUrl),
    agenceId: u.agenceId ?? null,
    agenceNom: u.agenceId != null ? (AGENCE_LABELS[u.agenceId] ?? null) : null,
  };
}

function isoTodayStore() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(isoDate: string, ref = isoTodayStore()) {
  const a = new Date(`${isoDate}T12:00:00`);
  const b = new Date(`${ref}T12:00:00`);
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

export function refreshUserNotifications(userId: number, role: string) {
  for (let i = crmNotifications.length - 1; i >= 0; i--) {
    const n = crmNotifications[i];
    if (n.source === "system" && n.userId === userId) crmNotifications.splice(i, 1);
  }

  const today = isoTodayStore();
  const push = (row: Omit<CrmNotificationRow, "id" | "read" | "createdAt" | "source">) => {
    const id = Math.max(0, ...crmNotifications.map((n) => n.id)) + 1;
    crmNotifications.push({
      ...row,
      id,
      read: false,
      createdAt: new Date().toISOString(),
      source: "system",
    });
  };

  for (const t of crmTasks) {
    if (t.userId !== userId || t.done || !t.dueDate || t.dueDate >= today) continue;
    push({
      userId,
      kind: "TASK_DUE",
      title: "Tâche en retard",
      message: t.title,
      href: "/crm/taches",
      entityType: t.entityType,
      entityId: t.entityId,
    });
  }

  for (const o of offres) {
    if (o.statut !== "ENVOYEE" || !o.dateOffre) continue;
    if (daysBetween(o.dateOffre) < 14) continue;
    const email = users.find((u) => u.id === userId)?.email ?? "";
    if (o.consultantEmail && o.consultantEmail !== email && role !== "ADMIN" && role !== "MANAGER") continue;
    push({
      userId,
      kind: "OFFRE_RELANCE",
      title: "Offre sans réponse",
      message: `${o.numeroOffre} — ${o.clientNom} (${o.siteNom}), envoyée le ${o.dateOffre}`,
      href: "/crm/offres",
      entityType: "OFFRE",
      entityId: o.id,
    });
  }

  if (role === "ADMIN" || role === "MANAGER") {
    for (const f of factures) {
      if (f.statutPaiement !== "EN_RETARD") continue;
      push({
        userId,
        kind: "FACTURE_RETARD",
        title: "Facture en retard",
        message: `${f.numeroFacture} — ${f.clientNom} (${f.montantHt.toLocaleString("fr-FR")} € HT)`,
        href: "/crm/recouvrement",
        entityType: "FACTURE",
        entityId: f.id,
      });
    }
  }
}

export function appendAuditLog(entry: {
  entity_type: string;
  entity_id: number;
  action: string;
  changes: Record<string, unknown> | null;
  performed_by: string;
  ip_address?: string | null;
  user_agent?: string | null;
}) {
  const id = Math.max(0, ...auditLog.map((a) => a.id)) + 1;
  auditLog.push({
    id,
    entity_type: entry.entity_type,
    entity_id: entry.entity_id,
    action: entry.action,
    changes: entry.changes,
    performed_by: entry.performed_by,
    performed_at: new Date().toISOString(),
    ip_address: entry.ip_address ?? null,
    user_agent: entry.user_agent ? String(entry.user_agent).slice(0, 400) : null,
  });
}

export function nextAvoirNumero(): string {
  const y = new Date().getFullYear();
  const n = avoirs.filter((a) => a.numero.includes(`AV${y}`)).length + 1;
  return `LVO-AV${y}-${String(n).padStart(3, "0")}`;
}
const processedQuontoIds = new Set<string>();

export function markQuontoProcessed(id: string) {
  processedQuontoIds.add(id);
}

export function isQuontoProcessed(id: string) {
  return processedQuontoIds.has(id);
}

export type StoreSnapshot = {
  version: 1;
  nextId: number;
  users: UserRow[];
  contacts: ContactRow[];
  ascensoristes: AscensoristeRow[];
  exploitationUsers: ExploitationUserRow[];
  clients: ClientRow[];
  sites: SiteRow[];
  siteGestionnaires: SiteGestionnaireRow[];
  siteEquipements: SiteEquipementRow[];
  typesEquipement: TypeEquipementRow[];
  siteEquipementsQte: SiteEquipementQteRow[];
  siteArborescenceNodes: SiteArborescenceNodeRow[];
  offres: OffreRow[];
  commandes: CommandeRow[];
  factures: FactureRow[];
  echeancesPaiement: EcheancePaiementRow[];
  historiqueAnnulations: HistoryAnnulationRow[];
  avoirs: AvoirRow[];
  pendingQuonto: PendingQuontoTx[];
  auditLog: AuditLogRow[];
  crmTasks: CrmTaskRow[];
  crmNotifications: CrmNotificationRow[];
  clientMessages: ClientMessageRow[];
  clientDocuments: ClientDocumentRow[];
  clientNotifications: ClientNotificationRow[];
  clientInterventions: ClientInterventionRow[];
  clientContrats: ClientContratRow[];
  clientAlertesConfigs: ClientAlertesConfig[];
  fichierVersions: FichierVersionRow[];
  mmsRapports: MmsRapportRow[];
  offreSignatures: [number, { procedureId: string; status: "NONE" | "PENDING" | "SIGNED" }][];
  processedQuontoIds: string[];
  crmAppSettings: {
    defaultConsultantEmail: string;
    tvaMetropolePercent: number;
    tvaDomPercent: number;
  };
};

export function exportStoreSnapshot(): StoreSnapshot {
  return {
    version: 1,
    nextId,
    users: [...users],
    contacts: [...contacts],
    ascensoristes: [...ascensoristes],
    exploitationUsers: [...exploitationUsers],
    clients: [...clients],
    sites: [...sites],
    siteGestionnaires: [...siteGestionnaires],
    siteEquipements: [...siteEquipements],
    typesEquipement: [...typesEquipement],
    siteEquipementsQte: [...siteEquipementsQte],
    siteArborescenceNodes: [...siteArborescenceNodes],
    offres: [...offres],
    commandes: [...commandes],
    factures: [...factures],
    echeancesPaiement: [...echeancesPaiement],
    historiqueAnnulations: [...historiqueAnnulations],
    avoirs: [...avoirs],
    pendingQuonto: [...pendingQuonto],
    auditLog: [...auditLog],
    crmTasks: [...crmTasks],
    crmNotifications: [...crmNotifications],
    clientMessages: [...clientMessages],
    clientDocuments: [...clientDocuments],
    clientNotifications: [...clientNotifications],
    clientInterventions: [...clientInterventions],
    clientContrats: [...clientContrats],
    clientAlertesConfigs: [...clientAlertesConfigs],
    fichierVersions: [...fichierVersions],
    mmsRapports: [...mmsRapports],
    offreSignatures: [...offreSignatures.entries()],
    processedQuontoIds: [...processedQuontoIds],
    crmAppSettings: { ...crmAppSettings },
  };
}

function replaceArray<T>(target: T[], items: T[]): void {
  target.splice(0, target.length, ...items);
}

export function importStoreSnapshot(data: StoreSnapshot): void {
  nextId = data.nextId > 0 ? data.nextId : 1;
  replaceArray(users, data.users ?? []);
  replaceArray(contacts, data.contacts ?? []);
  replaceArray(ascensoristes, data.ascensoristes ?? []);
  replaceArray(exploitationUsers, data.exploitationUsers ?? []);
  replaceArray(clients, data.clients ?? []);
  replaceArray(sites, data.sites ?? []);
  replaceArray(siteGestionnaires, data.siteGestionnaires ?? []);
  replaceArray(siteEquipements, data.siteEquipements ?? []);
  replaceArray(typesEquipement, data.typesEquipement ?? []);
  replaceArray(siteEquipementsQte, data.siteEquipementsQte ?? []);
  replaceArray(siteArborescenceNodes, data.siteArborescenceNodes ?? []);
  replaceArray(offres, data.offres ?? []);
  replaceArray(commandes, data.commandes ?? []);
  replaceArray(factures, data.factures ?? []);
  replaceArray(echeancesPaiement, data.echeancesPaiement ?? []);
  replaceArray(historiqueAnnulations, data.historiqueAnnulations ?? []);
  replaceArray(avoirs, data.avoirs ?? []);
  replaceArray(pendingQuonto, data.pendingQuonto ?? []);
  replaceArray(auditLog, data.auditLog ?? []);
  replaceArray(crmTasks, data.crmTasks ?? []);
  replaceArray(crmNotifications, data.crmNotifications ?? []);
  replaceArray(clientMessages, data.clientMessages ?? []);
  replaceArray(clientDocuments, data.clientDocuments ?? []);
  replaceArray(clientNotifications, data.clientNotifications ?? []);
  replaceArray(clientInterventions, data.clientInterventions ?? []);
  replaceArray(clientContrats, data.clientContrats ?? []);
  replaceArray(clientAlertesConfigs, data.clientAlertesConfigs ?? []);
  replaceArray(fichierVersions, data.fichierVersions ?? []);
  replaceArray(mmsRapports, data.mmsRapports ?? []);
  offreSignatures.clear();
  for (const [k, v] of data.offreSignatures ?? []) {
    offreSignatures.set(k, v);
  }
  processedQuontoIds.clear();
  for (const id of data.processedQuontoIds ?? []) {
    processedQuontoIds.add(id);
  }
  Object.assign(crmAppSettings, data.crmAppSettings ?? {});
}

export async function seedStore(hashPassword: (plain: string) => Promise<string>) {
  nextId = 1;
  users.length = 0;
  contacts.length = 0;
  clients.length = 0;
  sites.length = 0;
  siteGestionnaires.length = 0;
  siteEquipements.length = 0;
  siteArborescenceNodes.length = 0;
  offres.length = 0;
  commandes.length = 0;
  factures.length = 0;
  historiqueAnnulations.length = 0;
  pendingQuonto.length = 0;
  avoirs.length = 0;
  auditLog.length = 0;
  crmTasks.length = 0;
  crmNotifications.length = 0;
  clientMessages.length = 0;
  clientDocuments.length = 0;
  clientNotifications.length = 0;
  clientInterventions.length = 0;
  clientContrats.length = 0;
  clientAlertesConfigs.length = 0;
  fichierVersions.length = 0;
  offreSignatures.clear();
  processedQuontoIds.clear();

  if (exploitationUsers.length === 0) {
    exploitationUsers.push({
      id: nid(),
      email: "admin@exploitation.lvo-ing.fr",
      exploitationPasswordHash: await hashPassword("lvo123"),
      role: "ADMIN_EXPLOITATION",
      prenom: "Admin",
      nom: "Exploitation",
      telephone: null,
      poste: "Responsable exploitation",
      statut: "ACTIF",
      createdAt: new Date().toISOString(),
    });
  }

  const hp = hashPassword;
  const managerId = nid();
  const consultantId = nid();
  users.push(
    {
      id: nid(),
      email: "admin@lvo-ing.fr",
      passwordHash: await hp("lvo123"),
      role: "ADMIN",
      prenom: "Alex",
      nom: "Administrateur",
      agenceId: null,
    },
    {
      id: managerId,
      email: "manager@lvo-ing.fr",
      passwordHash: await hp("lvo123"),
      role: "MANAGER",
      prenom: "Marie",
      nom: "Dupont",
      agenceId: 2,
    },
    {
      id: consultantId,
      email: "consultant@lvo-ing.fr",
      passwordHash: await hp("lvo123"),
      role: "CONSULTANT",
      prenom: "Luc",
      nom: "Bernard",
      agenceId: 1,
    },
    {
      id: nid(),
      email: "viewer@lvo-ing.fr",
      passwordHash: await hp("lvo123"),
      role: "VIEWER",
      prenom: "Léa",
      nom: "Martin",
      agenceId: 1,
    },
  );

  // crmTasks are added later, after clients/contacts are seeded

  // ── Helpers temporels ────────────────────────────────────────────────────────
  const nowIso = new Date().toISOString();
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const past = (days: number) => { const d = new Date(today); d.setDate(d.getDate() - days); return iso(d); };
  const future = (days: number) => { const d = new Date(today); d.setDate(d.getDate() + days); return iso(d); };

  // ── Clients ──────────────────────────────────────────────────────────────────
  const cSyndic = { id: nid(), raisonSociale: "Syndic du Marais", entite: "Paris", email: "contact@syndic-marais.fr", telephone: "0142781200", createdAtIso: nowIso, statut: "ACTIF" as const, siret: "44320055400021", codePostal: "75003", responsableEmail: "p.moreau@syndic-marais.fr" };
  const cHopital = { id: nid(), raisonSociale: "Clinique Saint-Martin", entite: "Paris", email: "technique@clinique-stmartin.fr", telephone: "0144923000", createdAtIso: nowIso, statut: "ACTIF" as const, siret: "77110033600014", codePostal: "75017", responsableEmail: "a.saidani@clinique-stmartin.fr" };
  const cSFIF = { id: nid(), raisonSociale: "SFIF Foncière", entite: "Île-de-France", email: "gestion@sfif.fr", telephone: "0147761500", createdAtIso: nowIso, statut: "ACTIF" as const, siret: "38800044200018", codePostal: "92400", responsableEmail: "n.legrand@sfif.fr" };
  const cHLM = { id: nid(), raisonSociale: "Office HLM 93", entite: "Seine-Saint-Denis", email: "patrimoine@hlm93.fr", telephone: "0148211000", createdAtIso: nowIso, statut: "ACTIF" as const, siret: "21930001600022", codePostal: "93000", responsableEmail: "k.diallo@hlm93.fr" };
  clients.push(cSyndic, cHopital, cSFIF, cHLM);

  // ── Sites ────────────────────────────────────────────────────────────────────
  const sMarais    = { id: nid(), nom: "Résidence Le Marais", typeSite: "Résidentiel", clientNom: cSyndic.raisonSociale, statut: "ACTIF" as const };
  const sBastille  = { id: nid(), nom: "Résidence Bastille", typeSite: "Résidentiel", clientNom: cSyndic.raisonSociale, statut: "ACTIF" as const };
  const sBeaubourg = { id: nid(), nom: "Immeuble Beaubourg", typeSite: "Tertiaire", clientNom: cSyndic.raisonSociale, statut: "ACTIF" as const };
  const sHopA     = { id: nid(), nom: "Clinique St-Martin – Bât. A", typeSite: "Santé", clientNom: cHopital.raisonSociale, statut: "ACTIF" as const };
  const sHopB     = { id: nid(), nom: "Clinique St-Martin – Bât. B", typeSite: "Santé", clientNom: cHopital.raisonSociale, statut: "ACTIF" as const };
  const sTourLum  = { id: nid(), nom: "Tour Lumière", typeSite: "Tertiaire", clientNom: cSFIF.raisonSociale, statut: "ACTIF" as const };
  const sHalles   = { id: nid(), nom: "Centre Commercial Les Halles", typeSite: "Commercial", clientNom: cSFIF.raisonSociale, statut: "ACTIF" as const };
  const sLilas    = { id: nid(), nom: "Résidence Les Lilas", typeSite: "Résidentiel", clientNom: cHLM.raisonSociale, statut: "ACTIF" as const };
  sites.push(sMarais, sBastille, sBeaubourg, sHopA, sHopB, sTourLum, sHalles, sLilas);

  // ── Équipements ──────────────────────────────────────────────────────────────
  siteEquipements.push(
    { id: nid(), siteId: sMarais.id, type: "ASCENSEUR", marque: "Otis", modele: "Gen2 Comfort", numeroSerie: "OT-88412-A", anneeInstallation: 2014, capaciteKg: 630, etages: "RDC → 7", statut: "ACTIF", notes: "Révision complète 2024", createdAt: nowIso },
    { id: nid(), siteId: sMarais.id, type: "ASCENSEUR", marque: "Otis", modele: "Gen2 Comfort", numeroSerie: "OT-88412-B", anneeInstallation: 2014, capaciteKg: 630, etages: "SS1 → 7", statut: "ACTIF", notes: null, createdAt: nowIso },
    { id: nid(), siteId: sBastille.id, type: "ASCENSEUR", marque: "Kone", modele: "MonoSpace 500", numeroSerie: "KN-5501-2019", anneeInstallation: 2019, capaciteKg: 800, etages: "RDC → 5", statut: "ACTIF", notes: null, createdAt: nowIso },
    { id: nid(), siteId: sBeaubourg.id, type: "ASCENSEUR", marque: "Schindler", modele: "3300", numeroSerie: "SC-3300-7712", anneeInstallation: 2011, capaciteKg: 1000, etages: "RDC → 11", statut: "ACTIF", notes: "Maintenance annuelle planifiée juin 2026", createdAt: nowIso },
    { id: nid(), siteId: sBeaubourg.id, type: "MONTE_CHARGE", marque: "Thyssen", modele: "Evolution 200", numeroSerie: "TK-MC-4421", anneeInstallation: 2015, capaciteKg: 2500, etages: "SS1 → RDC", statut: "ACTIF", notes: "Accès livraisons", createdAt: nowIso },
    { id: nid(), siteId: sHopA.id, type: "ASCENSEUR", marque: "Kone", modele: "TranSys", numeroSerie: "KN-TS-1101", anneeInstallation: 2018, capaciteKg: 1600, etages: "SS1 → 6", statut: "ACTIF", notes: "Ascenseur brancard – priorité urgence", createdAt: nowIso },
    { id: nid(), siteId: sHopA.id, type: "ASCENSEUR", marque: "Kone", modele: "TranSys", numeroSerie: "KN-TS-1102", anneeInstallation: 2018, capaciteKg: 1600, etages: "SS1 → 6", statut: "ACTIF", notes: null, createdAt: nowIso },
    { id: nid(), siteId: sHopB.id, type: "ASCENSEUR", marque: "Otis", modele: "Elevatoria XL", numeroSerie: "OT-XL-2234", anneeInstallation: 2009, capaciteKg: 2000, etages: "RDC → 4", statut: "HORS_SERVICE", notes: "Arrêt technique – pièce en commande, délai 3 semaines", createdAt: nowIso },
    { id: nid(), siteId: sTourLum.id, type: "ASCENSEUR", marque: "Otis", modele: "SkyRise 2000", numeroSerie: "OT-SR-2000-01", anneeInstallation: 2020, capaciteKg: 1000, etages: "RDC → 20", statut: "ACTIF", notes: null, createdAt: nowIso },
    { id: nid(), siteId: sTourLum.id, type: "ASCENSEUR", marque: "Otis", modele: "SkyRise 2000", numeroSerie: "OT-SR-2000-02", anneeInstallation: 2020, capaciteKg: 1000, etages: "RDC → 20", statut: "ACTIF", notes: null, createdAt: nowIso },
    { id: nid(), siteId: sTourLum.id, type: "ESCALIER_MECANIQUE", marque: "Kone", modele: "TravelMaster 110", numeroSerie: "KN-EM-3302", anneeInstallation: 2020, capaciteKg: null, etages: "Hall R → R+1", statut: "ACTIF", notes: "Inspection annuelle APAVE due juillet 2026", createdAt: nowIso },
    { id: nid(), siteId: sHalles.id, type: "ESCALIER_MECANIQUE", marque: "Schindler", modele: "9500", numeroSerie: "SC-9500-7701", anneeInstallation: 2016, capaciteKg: null, etages: "N-2 → RDC", statut: "ACTIF", notes: null, createdAt: nowIso },
    { id: nid(), siteId: sHalles.id, type: "ESCALIER_MECANIQUE", marque: "Schindler", modele: "9500", numeroSerie: "SC-9500-7702", anneeInstallation: 2016, capaciteKg: null, etages: "RDC → N+1", statut: "HORS_SERVICE", notes: "Révision programmée semaine 24-2026 — arrêt temporaire", createdAt: nowIso },
    { id: nid(), siteId: sLilas.id, type: "ASCENSEUR", marque: "Thyssen", modele: "Evolution 100", numeroSerie: "TK-EV-5512", anneeInstallation: 2007, capaciteKg: 630, etages: "RDC → 10", statut: "ACTIF", notes: "Remplacement cabine envisagé 2027", createdAt: nowIso },
  );

  // ── Contacts (avec accès portail client) ─────────────────────────────────────
  const consultantUserId = users.find((u) => u.role === "CONSULTANT")?.id ?? null;
  const clientPwd = await hp("client123");

  contacts.push(
    { id: nid(), civilite: "M.", nom: "Moreau", prenom: "Pierre", entreprise: cSyndic.raisonSociale, fonction: "Gestionnaire de copropriété", email: "p.moreau@syndic-marais.fr", telephone: "0142781201", mobile: "0612345678", statut: "ACTIF", ownerUserId: consultantUserId, clientPasswordHash: clientPwd },
    { id: nid(), civilite: "Mme", nom: "Durand", prenom: "Sophie", entreprise: cSyndic.raisonSociale, fonction: "Assistante technique", email: "s.durand@syndic-marais.fr", telephone: "0142781202", mobile: "", statut: "ACTIF", ownerUserId: consultantUserId, clientPasswordHash: null },
    { id: nid(), civilite: "Dr", nom: "Saïdani", prenom: "Ahmed", entreprise: cHopital.raisonSociale, fonction: "Directeur technique", email: "a.saidani@clinique-stmartin.fr", telephone: "0144923010", mobile: "0687654321", statut: "ACTIF", ownerUserId: null, clientPasswordHash: clientPwd },
    { id: nid(), civilite: "Mme", nom: "Legrand", prenom: "Nathalie", entreprise: cSFIF.raisonSociale, fonction: "Responsable patrimoine", email: "n.legrand@sfif.fr", telephone: "0147761501", mobile: "0698765432", statut: "ACTIF", ownerUserId: null, clientPasswordHash: clientPwd },
    { id: nid(), civilite: "M.", nom: "Diallo", prenom: "Karim", entreprise: cHLM.raisonSociale, fonction: "Chef de service patrimoine", email: "k.diallo@hlm93.fr", telephone: "0148211001", mobile: "0678901234", statut: "ACTIF", ownerUserId: consultantUserId, clientPasswordHash: clientPwd },
  );

  // ── Phases JSON réutilisables ─────────────────────────────────────────────────
  const phasesMoe42 = JSON.stringify([
    { code: "MOE-PRG", libelle: "Programmation & diagnostic initial", montantHt: 8000, inclus: true },
    { code: "MOE-DCE", libelle: "DCE / consultation entreprises", montantHt: 14000, inclus: true },
    { code: "MOE-EXE", libelle: "Suivi d’exécution & visa plans", montantHt: 14000, inclus: true },
    { code: "MOE-REC", libelle: "Réception & dossier des ouvrages", montantHt: 6000, inclus: true },
  ]);
  const phasesMoe95 = JSON.stringify([
    { code: "MOE-PRG", libelle: "Programmation & cahier des charges", montantHt: 15000, inclus: true },
    { code: "MOE-DCE", libelle: "DCE / appel d’offres entreprises", montantHt: 28000, inclus: true },
    { code: "MOE-EXE", libelle: "Direction de l’exécution & suivi chantier", montantHt: 38000, inclus: true },
    { code: "MOE-REC", libelle: "Réception & levée réserves", montantHt: 14000, inclus: true },
  ]);
  const phasesMs8 = JSON.stringify([
    { code: "MS-REG", libelle: "Mission réglementaire – code du travail", montantHt: 3000, inclus: true },
    { code: "MS-VP", libelle: "Visites périodiques & registre de sécurité", montantHt: 3200, inclus: true },
    { code: "MS-AST", libelle: "Assistance technique & suivi prestataire", montantHt: 2300, inclus: true },
  ]);
  const phasesMs14 = JSON.stringify([
    { code: "MS-REG", libelle: "Suivi réglementaire & certifications APAVE", montantHt: 5000, inclus: true },
    { code: "MS-VP", libelle: "Visites périodiques mensuelles", montantHt: 4800, inclus: true },
    { code: "MS-AST", libelle: "Assistance technique & astreinte", montantHt: 4200, inclus: true },
  ]);
  const phasesMs12 = JSON.stringify([
    { code: "MS-REG", libelle: "Mission réglementaire", montantHt: 4500, inclus: true },
    { code: "MS-VP", libelle: "Visites périodiques trimestrielles", montantHt: 4000, inclus: true },
    { code: "MS-AST", libelle: "Assistance & reporting mensuel", montantHt: 3500, inclus: true },
  ]);
  const phasesMcn28 = JSON.stringify([
    { code: "MCN-ETU", libelle: "Étude de faisabilité & devis travaux", montantHt: 4000, inclus: true },
    { code: "MCN-TRV", libelle: "Réalisation des travaux de modernisation", montantHt: 20000, inclus: true },
    { code: "MCN-REC", libelle: "Réception & mise en service", montantHt: 4000, inclus: true },
  ]);
  const phasesMcm6 = JSON.stringify([
    { code: "MCM-DIA", libelle: "Diagnostic complet de l’installation", montantHt: 1800, inclus: true },
    { code: "MCM-INT", libelle: "Interventions correctives & préventives", montantHt: 3200, inclus: true },
    { code: "MCM-RPT", libelle: "Rapport de maintenance annuel", montantHt: 1200, inclus: true },
  ]);
  const echeFac2tr = JSON.stringify([
    { libelle: "Acompte à commande (30%)", pourcentage: 30, moisFacturation: "2026-05" },
    { libelle: "Solde à réception PV (70%)", pourcentage: 70, moisFacturation: "2026-10" },
  ]);
  const echeFac3tr = JSON.stringify([
    { libelle: "Acompte à commande (30%)", pourcentage: 30, moisFacturation: "2026-04" },
    { libelle: "Avancement 50% (40%)", pourcentage: 40, moisFacturation: "2026-07" },
    { libelle: "Solde à réception (30%)", pourcentage: 30, moisFacturation: "2026-11" },
  ]);
  const echeExe2 = JSON.stringify([
    { libelle: "Lancement de mission", datePrevue: "2026-05-01" },
    { libelle: "Remise du rapport final", datePrevue: "2026-09-30" },
  ]);
  const echeExe3 = JSON.stringify([
    { libelle: "Lancement & diagnostic", datePrevue: "2026-04-15" },
    { libelle: "Remise DCE", datePrevue: "2026-06-30" },
    { libelle: "Réception travaux", datePrevue: "2026-10-31" },
  ]);

  // ── Offres ───────────────────────────────────────────────────────────────────
  offres.push(
    {
      id: nid(),
      numeroOffre: "LVO-MOE-2026-001",
      typeMission: "MOE", typeMissionsJson: JSON.stringify(["MOE"]),
      statut: "ACCEPTEE",
      montantHt: 42000,
      dateOffre: past(90),
      clientNom: cSyndic.raisonSociale, siteNom: sMarais.nom,
      phasesMode: "ALL", phasesLinesJson: phasesMoe42,
      echeancierFacturationJson: echeFac3tr, echeancierExecutionJson: echeExe3,
      tauxTva: crmAppSettings.tvaMetropolePercent,
      consultantEmail: "consultant@lvo-ing.fr",
      gestionnaireNom: cSyndic.raisonSociale, gestionnaireContact: "p.moreau@syndic-marais.fr",
      missionsJson: phasesMoe42,
      clientDecisionJson: JSON.stringify({ decision: "ACCEPTEE", decidedAt: past(85), decidedBy: "Pierre Moreau", commentaire: "Accord de principe validé en AG" }),
    },
    {
      id: nid(),
      numeroOffre: "LVO-MS-2026-002",
      typeMission: "MS", typeMissionsJson: JSON.stringify(["MS"]),
      statut: "ACCEPTEE",
      montantHt: 8500,
      dateOffre: past(75),
      clientNom: cSyndic.raisonSociale, siteNom: sBastille.nom,
      phasesMode: "SELECTION", phasesLinesJson: phasesMs8,
      echeancierFacturationJson: echeFac2tr, echeancierExecutionJson: echeExe2,
      tauxTva: crmAppSettings.tvaMetropolePercent,
      consultantEmail: "consultant@lvo-ing.fr",
      gestionnaireNom: cSyndic.raisonSociale, gestionnaireContact: "p.moreau@syndic-marais.fr",
      missionsJson: phasesMs8,
      clientDecisionJson: JSON.stringify({ decision: "ACCEPTEE", decidedAt: past(70), decidedBy: "Pierre Moreau", commentaire: null }),
    },
    {
      id: nid(),
      numeroOffre: "LVO-MOE-2026-003",
      typeMission: "MOE", typeMissionsJson: JSON.stringify(["MOE"]),
      statut: "ENVOYEE",
      montantHt: 95000,
      dateOffre: past(20),
      clientNom: cSFIF.raisonSociale, siteNom: sTourLum.nom,
      phasesMode: "ALL", phasesLinesJson: phasesMoe95,
      echeancierFacturationJson: echeFac3tr, echeancierExecutionJson: echeExe3,
      tauxTva: crmAppSettings.tvaMetropolePercent,
      consultantEmail: "manager@lvo-ing.fr",
      gestionnaireNom: cSFIF.raisonSociale, gestionnaireContact: "n.legrand@sfif.fr",
      missionsJson: phasesMoe95,
    },
    {
      id: nid(),
      numeroOffre: "LVO-MCN-2026-004",
      typeMission: "MCN", typeMissionsJson: JSON.stringify(["MCN"]),
      statut: "CLOTUREE",
      montantHt: 28000,
      dateOffre: past(200),
      clientNom: cHLM.raisonSociale, siteNom: sLilas.nom,
      phasesMode: "SELECTION", phasesLinesJson: phasesMcn28,
      echeancierFacturationJson: echeFac2tr, echeancierExecutionJson: echeExe2,
      tauxTva: crmAppSettings.tvaMetropolePercent,
      consultantEmail: "consultant@lvo-ing.fr",
      gestionnaireNom: cHLM.raisonSociale, gestionnaireContact: "k.diallo@hlm93.fr",
      missionsJson: phasesMcn28,
      clientDecisionJson: JSON.stringify({ decision: "ACCEPTEE", decidedAt: past(195), decidedBy: "Karim Diallo", commentaire: "Validé en comité technique" }),
    },
    {
      id: nid(),
      numeroOffre: "LVO-MS-2026-005",
      typeMission: "MS", typeMissionsJson: JSON.stringify(["MS"]),
      statut: "ENVOYEE",
      montantHt: 14000,
      dateOffre: past(14),
      clientNom: cHopital.raisonSociale, siteNom: sHopA.nom,
      phasesMode: "SELECTION", phasesLinesJson: phasesMs14,
      echeancierFacturationJson: echeFac2tr, echeancierExecutionJson: echeExe2,
      tauxTva: crmAppSettings.tvaMetropolePercent,
      consultantEmail: "consultant@lvo-ing.fr",
      gestionnaireNom: cHopital.raisonSociale, gestionnaireContact: "a.saidani@clinique-stmartin.fr",
      missionsJson: phasesMs14,
    },
    {
      id: nid(),
      numeroOffre: "LVO-MCM-2026-006",
      typeMission: "MCM", typeMissionsJson: JSON.stringify(["MCM"]),
      statut: "ACCEPTEE",
      montantHt: 6200,
      dateOffre: past(45),
      clientNom: cSyndic.raisonSociale, siteNom: sBeaubourg.nom,
      phasesMode: "SELECTION", phasesLinesJson: phasesMcm6,
      echeancierFacturationJson: echeFac2tr, echeancierExecutionJson: echeExe2,
      tauxTva: crmAppSettings.tvaMetropolePercent,
      consultantEmail: "consultant@lvo-ing.fr",
      gestionnaireNom: cSyndic.raisonSociale, gestionnaireContact: "p.moreau@syndic-marais.fr",
      missionsJson: phasesMcm6,
      clientDecisionJson: JSON.stringify({ decision: "ACCEPTEE", decidedAt: past(40), decidedBy: "Pierre Moreau", commentaire: null }),
    },
    {
      id: nid(),
      numeroOffre: "LVO-MOE-2026-007",
      typeMission: "MOE", typeMissionsJson: JSON.stringify(["MOE"]),
      statut: "ANNULEE",
      montantHt: 55000,
      dateOffre: past(150),
      clientNom: cSFIF.raisonSociale, siteNom: sHalles.nom,
      phasesMode: "ALL", phasesLinesJson: phasesMoe95,
      echeancierFacturationJson: echeFac3tr, echeancierExecutionJson: echeExe3,
      tauxTva: crmAppSettings.tvaMetropolePercent,
      consultantEmail: "manager@lvo-ing.fr",
      gestionnaireNom: cSFIF.raisonSociale, gestionnaireContact: "n.legrand@sfif.fr",
      missionsJson: phasesMoe95,
    },
    {
      id: nid(),
      numeroOffre: "LVO-MS-2026-008",
      typeMission: "MS", typeMissionsJson: JSON.stringify(["MS"]),
      statut: "ENVOYEE",
      montantHt: 12000,
      dateOffre: past(7),
      clientNom: cHopital.raisonSociale, siteNom: sHopB.nom,
      phasesMode: "SELECTION", phasesLinesJson: phasesMs12,
      echeancierFacturationJson: echeFac2tr, echeancierExecutionJson: echeExe2,
      tauxTva: crmAppSettings.tvaMetropolePercent,
      consultantEmail: "consultant@lvo-ing.fr",
      gestionnaireNom: cHopital.raisonSociale, gestionnaireContact: "a.saidani@clinique-stmartin.fr",
      missionsJson: phasesMs12,
    },
    {
      id: nid(),
      numeroOffre: "LVO-MCN-2026-009",
      typeMission: "MCN", typeMissionsJson: JSON.stringify(["MCN"]),
      statut: "ENVOYEE",
      montantHt: 31000,
      dateOffre: past(10),
      clientNom: cSyndic.raisonSociale, siteNom: sBastille.nom,
      phasesMode: "SELECTION", phasesLinesJson: phasesMcn28,
      echeancierFacturationJson: echeFac2tr, echeancierExecutionJson: echeExe2,
      tauxTva: crmAppSettings.tvaMetropolePercent,
      consultantEmail: "consultant@lvo-ing.fr",
      gestionnaireNom: cSyndic.raisonSociale, gestionnaireContact: "p.moreau@syndic-marais.fr",
      missionsJson: phasesMcn28,
    },
    {
      id: nid(),
      numeroOffre: "LVO-MS-2026-010",
      typeMission: "MS", typeMissionsJson: JSON.stringify(["MS"]),
      statut: "REFUSEE",
      montantHt: 9500,
      dateOffre: past(60),
      clientNom: cHLM.raisonSociale, siteNom: sLilas.nom,
      phasesMode: "SELECTION", phasesLinesJson: phasesMs8,
      echeancierFacturationJson: echeFac2tr, echeancierExecutionJson: echeExe2,
      tauxTva: crmAppSettings.tvaMetropolePercent,
      consultantEmail: "consultant@lvo-ing.fr",
      gestionnaireNom: cHLM.raisonSociale, gestionnaireContact: "k.diallo@hlm93.fr",
      missionsJson: phasesMs8,
      clientDecisionJson: JSON.stringify({ decision: "REFUSEE", decidedAt: past(50), decidedBy: "Karim Diallo", commentaire: "Budget non validé cette année" }),
    },
  );

  // ── Commandes ────────────────────────────────────────────────────────────────
  commandes.push(
    { id: nid(), numeroCommande: "CMD-2026-001", dateCommande: past(85), montantHt: 42000, montantFacture: 12600, typeMission: "MOE", typeMissionsJson: JSON.stringify(["MOE"]), statut: "EN_COURS", siteNom: sMarais.nom, clientNom: cSyndic.raisonSociale, numeroClient: "OS-SYNDIC-2026-001" },
    { id: nid(), numeroCommande: "CMD-2026-002", dateCommande: past(70), montantHt: 8500, montantFacture: 8500, typeMission: "MS", typeMissionsJson: JSON.stringify(["MS"]), statut: "TERMINEE", siteNom: sBastille.nom, clientNom: cSyndic.raisonSociale, numeroClient: "OS-SYNDIC-2026-002" },
    { id: nid(), numeroCommande: "CMD-2026-003", dateCommande: past(195), montantHt: 28000, montantFacture: 28000, typeMission: "MCN", typeMissionsJson: JSON.stringify(["MCN"]), statut: "TERMINEE", siteNom: sLilas.nom, clientNom: cHLM.raisonSociale, numeroClient: "BC-HLM93-2025-114" },
    { id: nid(), numeroCommande: "CMD-2026-004", dateCommande: past(40), montantHt: 6200, montantFacture: 0, typeMission: "MCM", typeMissionsJson: JSON.stringify(["MCM"]), statut: "EN_COURS", siteNom: sBeaubourg.nom, clientNom: cSyndic.raisonSociale, numeroClient: "OS-SYNDIC-2026-003" },
    { id: nid(), numeroCommande: "CMD-2026-005", dateCommande: past(30), montantHt: 14000, montantFacture: 4200, typeMission: "MS", typeMissionsJson: JSON.stringify(["MS"]), statut: "EN_COURS", siteNom: sHopA.nom, clientNom: cHopital.raisonSociale, numeroClient: "PO-CSM-2026-007" },
    { id: nid(), numeroCommande: "CMD-2026-006", dateCommande: past(5), montantHt: 12000, montantFacture: 0, typeMission: "MS", typeMissionsJson: JSON.stringify(["MS"]), statut: "EN_COURS", siteNom: sHopB.nom, clientNom: cHopital.raisonSociale, numeroClient: "PO-CSM-2026-008" },
  );

  const [cmd1, cmd2, cmd3, , cmd5] = commandes;

  // ── Factures ─────────────────────────────────────────────────────────────────
  factures.push(
    // CMD-001 : MOE Résidence Le Marais — 3 tranches (30/40/30)
    { id: nid(), numeroFacture: "LVO-F2026-001", dateFacture: past(80), numeroCommande: cmd1.numeroCommande, numeroCommandeClient: cmd1.numeroClient ?? null, clientNom: cmd1.clientNom, montantHt: 12600, frais: 0, modeReglement: "VIREMENT", dateEcheance: past(50), statutPaiement: "PAYE", montantPaye: 15048, niveauRelance: 0, derniereRelanceAt: null, commandeId: cmd1.id, statutFacturation: "PAYEE" },
    { id: nid(), numeroFacture: "LVO-F2026-002", dateFacture: past(40), numeroCommande: cmd1.numeroCommande, numeroCommandeClient: cmd1.numeroClient ?? null, clientNom: cmd1.clientNom, montantHt: 16800, frais: 0, modeReglement: "VIREMENT", dateEcheance: past(10), statutPaiement: "EN_RETARD", montantPaye: 0, niveauRelance: 2, derniereRelanceAt: past(3), commandeId: cmd1.id, statutFacturation: "ENVOYEE" },
    { id: nid(), numeroFacture: "LVO-F2026-003", dateFacture: future(30), numeroCommande: cmd1.numeroCommande, numeroCommandeClient: cmd1.numeroClient ?? null, clientNom: cmd1.clientNom, montantHt: 12600, frais: 0, modeReglement: "VIREMENT", dateEcheance: future(60), statutPaiement: "NON_PAYE", montantPaye: 0, niveauRelance: 0, derniereRelanceAt: null, commandeId: cmd1.id, statutFacturation: "CREEE" },

    // CMD-002 : MS Résidence Bastille — soldée
    { id: nid(), numeroFacture: "LVO-F2026-004", dateFacture: past(65), numeroCommande: cmd2.numeroCommande, numeroCommandeClient: cmd2.numeroClient ?? null, clientNom: cmd2.clientNom, montantHt: 2550, frais: 0, modeReglement: "VIREMENT", dateEcheance: past(35), statutPaiement: "PAYE", montantPaye: 3060, niveauRelance: 0, derniereRelanceAt: null, commandeId: cmd2.id, statutFacturation: "PAYEE" },
    { id: nid(), numeroFacture: "LVO-F2026-005", dateFacture: past(30), numeroCommande: cmd2.numeroCommande, numeroCommandeClient: cmd2.numeroClient ?? null, clientNom: cmd2.clientNom, montantHt: 5950, frais: 0, modeReglement: "VIREMENT", dateEcheance: past(5), statutPaiement: "PAYE", montantPaye: 7140, niveauRelance: 0, derniereRelanceAt: null, commandeId: cmd2.id, statutFacturation: "PAYEE" },

    // CMD-003 : MCN Résidence Les Lilas — soldée (clôturée)
    { id: nid(), numeroFacture: "LVO-F2025-006", dateFacture: past(180), numeroCommande: cmd3.numeroCommande, numeroCommandeClient: cmd3.numeroClient ?? null, clientNom: cmd3.clientNom, montantHt: 8400, frais: 0, modeReglement: "VIREMENT", dateEcheance: past(150), statutPaiement: "PAYE", montantPaye: 10080, niveauRelance: 0, derniereRelanceAt: null, commandeId: cmd3.id, statutFacturation: "PAYEE" },
    { id: nid(), numeroFacture: "LVO-F2025-007", dateFacture: past(120), numeroCommande: cmd3.numeroCommande, numeroCommandeClient: cmd3.numeroClient ?? null, clientNom: cmd3.clientNom, montantHt: 11200, frais: 0, modeReglement: "VIREMENT", dateEcheance: past(90), statutPaiement: "PAYE", montantPaye: 13440, niveauRelance: 0, derniereRelanceAt: null, commandeId: cmd3.id, statutFacturation: "PAYEE" },
    { id: nid(), numeroFacture: "LVO-F2026-008", dateFacture: past(60), numeroCommande: cmd3.numeroCommande, numeroCommandeClient: cmd3.numeroClient ?? null, clientNom: cmd3.clientNom, montantHt: 8400, frais: 0, modeReglement: "VIREMENT", dateEcheance: past(30), statutPaiement: "PAYE", montantPaye: 10080, niveauRelance: 0, derniereRelanceAt: null, commandeId: cmd3.id, statutFacturation: "PAYEE" },

    // CMD-004 : MCM Immeuble Beaubourg — en cours, pas encore facturé
    // (pas de facture émise, cmd montantFacture = 0)

    // CMD-005 : MS Clinique Saint-Martin A — acompte payé, solde dû
    { id: nid(), numeroFacture: "LVO-F2026-009", dateFacture: past(25), numeroCommande: cmd5.numeroCommande, numeroCommandeClient: cmd5.numeroClient ?? null, clientNom: cmd5.clientNom, montantHt: 4200, frais: 0, modeReglement: "VIREMENT", dateEcheance: past(5), statutPaiement: "PARTIELLEMENT_PAYE", montantPaye: 2100, niveauRelance: 1, derniereRelanceAt: past(2), commandeId: cmd5.id, statutFacturation: "ENVOYEE" },
    { id: nid(), numeroFacture: "LVO-F2026-010", dateFacture: past(10), numeroCommande: cmd5.numeroCommande, numeroCommandeClient: cmd5.numeroClient ?? null, clientNom: cmd5.clientNom, montantHt: 9800, frais: 0, modeReglement: "VIREMENT", dateEcheance: future(20), statutPaiement: "NON_PAYE", montantPaye: 0, niveauRelance: 0, derniereRelanceAt: null, commandeId: cmd5.id, statutFacturation: "ENVOYEE" },
  );

  // ── Quonto (rapprochement bancaire) ─────────────────────────────────────────
  pendingQuonto.push(
    { id: nid(), libelle: `VIR SYNDIC DU MARAIS LVO-F2026-002`, montant: 16800, dateOperation: past(2), score: 81, quontoTransactionId: "qonto-2026-041" },
    { id: nid(), libelle: `REGLT CLINIQUE STMARTIN FACT 009`, montant: 2100, dateOperation: past(1), score: 68, quontoTransactionId: "qonto-2026-042" },
    { id: nid(), libelle: "FRAIS BANCAIRES JUIN 2026", montant: -18.5, dateOperation: iso(today), score: 5, quontoTransactionId: "qonto-2026-043" },
  );

  // ── Historique annulations ───────────────────────────────────────────────────
  historiqueAnnulations.push({
    id: nid(), entityType: "OFFRE", entityId: 99,
    reference: "LVO-MOE-2026-007",
    motif: "Projet reporté par le client — réorientation budgétaire 2026",
    commentaire: "SFIF Foncière a suspendu le programme Les Halles suite à décision du CA.",
    montantHt: 55000, clientNom: cSFIF.raisonSociale, cancelledAt: past(100),
  });

  // ── Tâches CRM ───────────────────────────────────────────────────────────────
  crmTasks.push(
    { id: nid(), userId: managerId, title: "Relancer LVO-F2026-002 (EN RETARD — 16 800 €)", dueDate: future(1), dueHour: 9, dueMinute: 0, done: false, entityType: "FACTURE", entityId: null, createdAt: nowIso },
    { id: nid(), userId: consultantId, title: "Envoyer offre LVO-MS-2026-005 à la Clinique Saint-Martin", dueDate: future(2), dueHour: 10, dueMinute: 0, done: false, entityType: "OFFRE", entityId: null, createdAt: nowIso },
    { id: nid(), userId: consultantId, title: "Planifier visite équipements Résidence Bastille", dueDate: future(7), dueHour: null, dueMinute: null, done: false, entityType: "SITE", entityId: null, createdAt: nowIso },
    { id: nid(), userId: managerId, title: "Valider offre LVO-MOE-2026-003 avant envoi SFIF", dueDate: future(3), dueHour: 14, dueMinute: 0, done: false, entityType: "OFFRE", entityId: null, createdAt: nowIso },
  );

  // ── Notifications CRM ────────────────────────────────────────────────────────
  const adminUser = users.find((u) => u.role === "ADMIN");
  const managerUser = users.find((u) => u.role === "MANAGER");
  const consultantUser = users.find((u) => u.role === "CONSULTANT");
  const seedNotif = (userId: number, kind: CrmNotificationKind, title: string, message: string, href: string | null) => {
    crmNotifications.push({ id: nid(), userId, kind, title, message, href, entityType: null, entityId: null, read: false, createdAt: nowIso, source: "seed" });
  };
  if (adminUser) {
    seedNotif(adminUser.id, "FACTURE_RETARD", "Facture en retard — LVO-F2026-002", "16 800 € impayés depuis 10 jours (Syndic du Marais)", "/crm/factures");
    seedNotif(adminUser.id, "INFO", "Bienvenue sur LVO CRM", "Tableau de bord, offres, commandes et facturation disponibles.", "/crm/accueil");
  }
  if (managerUser) {
    seedNotif(managerUser.id, "OFFRE_RELANCE", "Offre LVO-MOE-2026-001 acceptée", "Syndic du Marais a accepté la MOE Résidence Le Marais (42 000 €).", "/crm/offres");
    seedNotif(managerUser.id, "FACTURE_RETARD", "Facture partiellement payée — LVO-F2026-009", "Clinique Saint-Martin : 2 100 € reçus sur 4 200 €.", "/crm/factures");
  }
  if (consultantUser) {
    seedNotif(consultantUser.id, "OFFRE_RELANCE", "Offre LVO-MOE-2026-003 en attente", "SFIF Foncière — Tour Lumière (95 000 €) — réponse attendue.", "/crm/offres");
    seedNotif(consultantUser.id, "INFO", "Analyse MMS disponible", "Importez un rapport maintenance depuis Outils → Maintenance MMS.", "/crm/outils/maintenance-mms");
  }

  // ── Contrats client (seed) ───────────────────────────────────────────────────
  clientContrats.push(
    {
      id: nid(), entreprise: cSyndic.raisonSociale, reference: "CTR-2024-001",
      intitule: "Contrat de maintenance ascenseurs — Résidence Le Marais",
      siteId: sMarais.id, siteNom: sMarais.nom,
      typeContrat: "Maintenance préventive & corrective",
      dateDebut: past(540), dateFin: future(190),
      montantAnnuelHt: 4800, prestataire: "Otis Service IDF",
      statut: "ACTIF",
      conditionsRenouvellement: "Tacite reconduction annuelle — résiliation 3 mois avant échéance",
      clauseRevisionTarifaire: "Révision annuelle selon indice Syntec, plafonnée à +3%",
      avenantsJson: JSON.stringify([
        { date: past(180), description: "Avenant n°1 — Extension périmètre escalier de service" },
      ]),
      demandeRenouvellementAt: null,
    },
    {
      id: nid(), entreprise: cSyndic.raisonSociale, reference: "CTR-2023-004",
      intitule: "Contrat maintenance — Résidence Bastille",
      siteId: sBastille.id, siteNom: sBastille.nom,
      typeContrat: "Maintenance complète",
      dateDebut: past(700), dateFin: future(25),
      montantAnnuelHt: 3600, prestataire: "Kone Maintenance",
      statut: "EN_RENOUVELLEMENT",
      conditionsRenouvellement: "Renouvellement en cours — offre envoyée le " + past(15),
      clauseRevisionTarifaire: "Révision selon IRL + 1%",
      avenantsJson: null,
      demandeRenouvellementAt: past(15),
    },
    {
      id: nid(), entreprise: cHopital.raisonSociale, reference: "CTR-2022-007",
      intitule: "Contrat maintenance multi-équipements — Clinique Saint-Martin",
      siteId: sHopA.id, siteNom: "Clinique St-Martin (Bât. A & B)",
      typeContrat: "Maintenance préventive, corrective & astreinte 24h",
      dateDebut: past(900), dateFin: future(300),
      montantAnnuelHt: 18500, prestataire: "Otis Service IDF",
      statut: "ACTIF",
      conditionsRenouvellement: "Renouvellement par avenant — délai de préavis 6 mois",
      clauseRevisionTarifaire: "Révision annuelle selon indice Syntec",
      avenantsJson: JSON.stringify([
        { date: past(400), description: "Avenant n°1 — Ajout astreinte 24h/24" },
        { date: past(90), description: "Avenant n°2 — Intégration Bât. B après panne moteur" },
      ]),
      demandeRenouvellementAt: null,
    },
    {
      id: nid(), entreprise: cSFIF.raisonSociale, reference: "CTR-2024-012",
      intitule: "Contrat maintenance — Tour Lumière & Les Halles",
      siteId: sTourLum.id, siteNom: "Tour Lumière + Centre Les Halles",
      typeContrat: "Maintenance préventive, escaliers mécaniques & ascenseurs",
      dateDebut: past(365), dateFin: future(365),
      montantAnnuelHt: 22000, prestataire: "Schindler Maintenance",
      statut: "ACTIF",
      conditionsRenouvellement: "Renouvellement annuel automatique sauf dénonciation",
      clauseRevisionTarifaire: "Indice BT01 + 2% maximum",
      avenantsJson: null,
      demandeRenouvellementAt: null,
    },
    {
      id: nid(), entreprise: cHLM.raisonSociale, reference: "CTR-2020-003",
      intitule: "Contrat maintenance — Résidence Les Lilas",
      siteId: sLilas.id, siteNom: sLilas.nom,
      typeContrat: "Maintenance préventive annuelle",
      dateDebut: past(1500), dateFin: past(30),
      montantAnnuelHt: 5200, prestataire: "Thyssen Krupp Elevator",
      statut: "EXPIRE",
      conditionsRenouvellement: "Contrat échu — renouvellement en attente de validation budgétaire",
      clauseRevisionTarifaire: null,
      avenantsJson: null,
      demandeRenouvellementAt: null,
    },
  );

  // ── Interventions client (seed) ──────────────────────────────────────────────
  const contactSyndic  = contacts.find((c) => c.entreprise === cSyndic.raisonSociale && c.clientPasswordHash);
  const contactHopital = contacts.find((c) => c.entreprise === cHopital.raisonSociale && c.clientPasswordHash);
  const contactSFIF    = contacts.find((c) => c.entreprise === cSFIF.raisonSociale && c.clientPasswordHash);
  const contactHLM     = contacts.find((c) => c.entreprise === cHLM.raisonSociale && c.clientPasswordHash);

  const equipMaraisB  = siteEquipements.find((e) => e.numeroSerie === "OT-88412-B");
  const equipHopBroken = siteEquipements.find((e) => e.numeroSerie === "OT-XL-2234");
  const equipHallesEM  = siteEquipements.find((e) => e.numeroSerie === "SC-9500-7702");
  const equipLilas     = siteEquipements.find((e) => e.numeroSerie === "TK-EV-5512");

  if (contactSyndic) {
    clientInterventions.push({
      id: nid(), entreprise: cSyndic.raisonSociale, reference: "INT-2026-0001",
      siteId: sMarais.id, siteNom: sMarais.nom,
      equipementId: equipMaraisB?.id ?? null,
      equipementLibelle: equipMaraisB ? `${equipMaraisB.marque} ${equipMaraisB.modele} (${equipMaraisB.numeroSerie})` : null,
      type: "PANNE", priorite: "URGENTE", statut: "EN_COURS",
      description: "Ascenseur bloqué entre le 3e et le 4e étage — cabine immobilisée depuis 14h. Personnes évacuées, pas de blessé.",
      prestataire: "Otis Service IDF", declaredAt: past(2) + "T14:23:00.000Z",
      assignedAt: past(2) + "T15:10:00.000Z", resolvedAt: null, compteRendu: null,
      declaredByContactId: contactSyndic.id, declaredByName: `${contactSyndic.prenom} ${contactSyndic.nom}`,
    });
    clientInterventions.push({
      id: nid(), entreprise: cSyndic.raisonSociale, reference: "INT-2026-0002",
      siteId: sBastille.id, siteNom: sBastille.nom,
      equipementId: null, equipementLibelle: null,
      type: "MAINTENANCE_PREVENTIVE", priorite: "NORMALE", statut: "RESOLUE",
      description: "Visite de maintenance préventive annuelle — vérification des câbles, lubrification, contrôle armoire électrique.",
      prestataire: "Kone Maintenance", declaredAt: past(20) + "T09:00:00.000Z",
      assignedAt: past(20) + "T09:00:00.000Z", resolvedAt: past(19) + "T17:30:00.000Z",
      compteRendu: "Maintenance effectuée sans anomalie. Prochain rendez-vous dans 12 mois. Rapport signé joint.",
      declaredByContactId: contactSyndic.id, declaredByName: `${contactSyndic.prenom} ${contactSyndic.nom}`,
    });
  }
  if (contactHopital) {
    clientInterventions.push({
      id: nid(), entreprise: cHopital.raisonSociale, reference: "INT-2026-0003",
      siteId: sHopB.id, siteNom: sHopB.nom,
      equipementId: equipHopBroken?.id ?? null,
      equipementLibelle: equipHopBroken ? `${equipHopBroken.marque} ${equipHopBroken.modele} (${equipHopBroken.numeroSerie})` : null,
      type: "PANNE", priorite: "CRITIQUE", statut: "EN_COURS",
      description: "Panne moteur — ascenseur hors service. Pièce de remplacement commandée, délai estimé 3 semaines. Ascenseur de secours Bât. A en service.",
      prestataire: "Otis Service IDF", declaredAt: past(12) + "T08:15:00.000Z",
      assignedAt: past(12) + "T09:00:00.000Z", resolvedAt: null, compteRendu: null,
      declaredByContactId: contactHopital.id, declaredByName: `${contactHopital.prenom} ${contactHopital.nom}`,
    });
    clientInterventions.push({
      id: nid(), entreprise: cHopital.raisonSociale, reference: "INT-2026-0004",
      siteId: sHopA.id, siteNom: sHopA.nom,
      equipementId: null, equipementLibelle: null,
      type: "VISITE_REGLEMENTAIRE", priorite: "NORMALE", statut: "A_VALIDER",
      description: "Contrôle périodique APAVE — vérification réglementaire annuelle des 2 ascenseurs brancards.",
      prestataire: "APAVE", declaredAt: past(5) + "T10:00:00.000Z",
      assignedAt: past(5) + "T10:00:00.000Z", resolvedAt: past(1) + "T16:00:00.000Z",
      compteRendu: "Contrôle effectué — aucune prescription. Rapport APAVE disponible dans vos documents. Validation client requise.",
      declaredByContactId: contactHopital.id, declaredByName: `${contactHopital.prenom} ${contactHopital.nom}`,
    });
  }
  if (contactSFIF) {
    clientInterventions.push({
      id: nid(), entreprise: cSFIF.raisonSociale, reference: "INT-2026-0005",
      siteId: sHalles.id, siteNom: sHalles.nom,
      equipementId: equipHallesEM?.id ?? null,
      equipementLibelle: equipHallesEM ? `${equipHallesEM.marque} ${equipHallesEM.modele} (${equipHallesEM.numeroSerie})` : null,
      type: "MAINTENANCE_PREVENTIVE", priorite: "NORMALE", statut: "ASSIGNEE",
      description: "Révision programmée escalier mécanique RDC → N+1 — semaine 24-2026. Arrêt temporaire prévu 48h.",
      prestataire: "Schindler Maintenance", declaredAt: past(3) + "T11:00:00.000Z",
      assignedAt: past(3) + "T11:00:00.000Z", resolvedAt: null, compteRendu: null,
      declaredByContactId: contactSFIF.id, declaredByName: `${contactSFIF.prenom} ${contactSFIF.nom}`,
    });
  }
  if (contactHLM) {
    clientInterventions.push({
      id: nid(), entreprise: cHLM.raisonSociale, reference: "INT-2026-0006",
      siteId: sLilas.id, siteNom: sLilas.nom,
      equipementId: equipLilas?.id ?? null,
      equipementLibelle: equipLilas ? `${equipLilas.marque} ${equipLilas.modele} (${equipLilas.numeroSerie})` : null,
      type: "MISE_EN_CONFORMITE", priorite: "NORMALE", statut: "CREEE",
      description: "Mise en conformité suite à prescription APAVE 2025 — remplacement des dispositifs d'arrêt d'urgence.",
      prestataire: null, declaredAt: iso(today) + "T08:00:00.000Z",
      assignedAt: null, resolvedAt: null, compteRendu: null,
      declaredByContactId: contactHLM.id, declaredByName: `${contactHLM.prenom} ${contactHLM.nom}`,
    });
  }
}

/**
 * Pré-remplit les clients « groupement » réels (SIDR, SODIAC, SEMADER) s'ils sont
 * absents — appelé à chaque démarrage, contrairement à seedStore() qui ne tourne
 * qu'à la toute première initialisation (store vide).
 */
const DEFAULT_GROUPEMENT_CLIENTS: { raisonSociale: string; entite: string }[] = [
  { raisonSociale: "SIDR", entite: "La Réunion" },
  { raisonSociale: "SODIAC", entite: "La Réunion" },
  { raisonSociale: "SEMADER", entite: "La Réunion" },
];

export function ensureDefaultGroupementClients(): boolean {
  let added = false;
  for (const def of DEFAULT_GROUPEMENT_CLIENTS) {
    if (clients.some((c) => c.raisonSociale === def.raisonSociale)) continue;
    clients.push({
      id: nid(),
      raisonSociale: def.raisonSociale,
      entite: def.entite,
      email: "",
      telephone: "",
      createdAtIso: new Date().toISOString(),
      statut: "ACTIF",
      siret: null,
      codePostal: null,
      responsableEmail: null,
    });
    added = true;
  }
  return added;
}

/**
 * Pré-remplit le référentiel des types d'équipements (Ascenseur, Monte-charge,
 * Escalator) s'ils sont absents — appelé à chaque démarrage, comme les clients
 * groupement. Le référentiel reste extensible : un nouveau libellé saisi dans le
 * formulaire Site est créé automatiquement à l'enregistrement (voir crm.ts).
 */
const DEFAULT_TYPES_EQUIPEMENT = ["Ascenseur", "Monte-charge", "Escalator"];

export function ensureDefaultTypesEquipement(): boolean {
  let added = false;
  for (const libelle of DEFAULT_TYPES_EQUIPEMENT) {
    if (typesEquipement.some((t) => t.libelle.toLowerCase() === libelle.toLowerCase())) continue;
    typesEquipement.push({ id: nid(), libelle, actif: true });
    added = true;
  }
  return added;
}
