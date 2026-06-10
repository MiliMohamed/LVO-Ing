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
};

/** Phase 6 — gestionnaires tiers (R3), aligné Prisma `site_gestionnaires` */
export type SiteGestionnaireRow = {
  id: number;
  siteId: number;
  /** Raison sociale client gestionnaire (= `clients.raisonSociale` en démo) */
  clientNom: string;
  isPrincipal: boolean;
  dateDebut: string;
  dateFin: string | null;
  notes: string | null;
};

export type EquipementType = "ASCENSEUR" | "MONTE_CHARGE" | "MONTE_VOITURE" | "PLATEFORME" | "DAE";

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

/** Phase 10 — procédure e-signature stub (Yousign) */
export const offreSignatures = new Map<number, { procedureId: string; status: "NONE" | "PENDING" | "SIGNED" }>();

/** Phase 9 — paramètres applicatifs démo */
export const crmAppSettings = {
  defaultConsultantEmail: "consultant@lvo-ing.fr",
  tvaMetropolePercent: 20,
  tvaDomPercent: 8.5,
} as const;

export function isClientDomTom(cl: Pick<ClientRow, "entite" | "codePostal"> | undefined): boolean {
  if (!cl) return false;
  const e = String(cl.entite || "").trim();
  if (/^(97|98)\d{1}/.test(e.replace(/\s/g, ""))) return true;
  if (e === "974" || e === "971" || e === "972" || e === "973" || e === "976" || e === "978") return true;
  const cp = String(cl.codePostal || "").replace(/\s/g, "");
  if (/^(97|98)\d{3}/.test(cp)) return true;
  return false;
}

export function pushDocumentVersion(input: {
  reference: string;
  docType: "OFFRE" | "COMMANDE" | "FACTURE";
  format: string;
}): FichierVersionRow {
  for (const v of fichierVersions) {
    if (v.reference === input.reference && v.docType === input.docType && v.storage === "CURRENT") {
      v.storage = "ONEDRIVE_ARCHIVE_STUB";
      v.storageKey = `onedrive://stub/archive/${input.docType}/${input.reference}_v${v.version}.${v.format}`;
    }
  }
  const same = fichierVersions.filter((v) => v.reference === input.reference && v.docType === input.docType);
  const nextVer = same.length ? Math.max(...same.map((x) => x.version)) + 1 : 1;
  const id = Math.max(0, ...fichierVersions.map((x) => x.id), 0) + 1;
  const row: FichierVersionRow = {
    id,
    reference: input.reference,
    docType: input.docType,
    version: nextVer,
    format: input.format,
    createdAt: new Date().toISOString(),
    storage: "CURRENT",
    storageKey: `s3://lvo-demo/${input.docType}/${input.reference}_v${nextVer}.${input.format}`,
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
export const clients: ClientRow[] = [];
export const sites: SiteRow[] = [];
export const siteGestionnaires: SiteGestionnaireRow[] = [];
export const siteEquipements: SiteEquipementRow[] = [];
export const siteArborescenceNodes: SiteArborescenceNodeRow[] = [];
export const offres: OffreRow[] = [];
export const commandes: CommandeRow[] = [];
export const factures: FactureRow[] = [];
export const historiqueAnnulations: HistoryAnnulationRow[] = [];
export const avoirs: AvoirRow[] = [];
export const pendingQuonto: PendingQuontoTx[] = [];
export const auditLog: AuditLogRow[] = [];
export const crmTasks: CrmTaskRow[] = [];
export const crmNotifications: CrmNotificationRow[] = [];

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
  fichierVersions.length = 0;
  offreSignatures.clear();
  processedQuontoIds.clear();

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

  crmTasks.push(
    {
      id: nid(),
      userId: managerId,
      title: "Relancer offre MS-2026-014",
      dueDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
      dueHour: 9,
      dueMinute: 0,
      done: false,
      entityType: "OFFRE",
      entityId: null,
      createdAt: new Date().toISOString(),
    },
    {
      id: nid(),
      userId: consultantId,
      title: "Compléter fiche contact syndic",
      dueDate: null,
      dueHour: null,
      dueMinute: null,
      done: false,
      entityType: "CONTACT",
      entityId: null,
      createdAt: new Date().toISOString(),
    },
  );

  const c1 = {
    id: nid(),
    raisonSociale: "SIDR Engineering",
    entite: "Paris",
    email: "contact@sidr.fr",
    telephone: "0142000000",
    createdAtIso: new Date().toISOString(),
    statut: "ACTIF" as const,
    siret: "55210055400015",
    codePostal: "75001",
    responsableEmail: "j.dupont@sidr.fr",
  };
  const c2 = {
    id: nid(),
    raisonSociale: "Mobilité Réunion",
    entite: "974",
    email: "info@mobrun.fr",
    telephone: "0262000000",
    createdAtIso: new Date().toISOString(),
    statut: "ACTIF" as const,
    codePostal: "97490",
    responsableEmail: null,
  };
  const c3 = {
    id: nid(),
    raisonSociale: "Syndic Gestion Lilas",
    entite: "Île-de-France",
    email: "contact@syndic-lilas.fr",
    telephone: "0142000099",
    createdAtIso: new Date().toISOString(),
    statut: "ACTIF" as const,
    codePostal: "93100",
    responsableEmail: "contact@syndic-lilas.fr",
  };
  clients.push(c1, c2, c3);

  sites.push(
    { id: nid(), nom: "Tour Opéra", typeSite: "Tertiaire", clientNom: c1.raisonSociale, statut: "ACTIF" },
    { id: nid(), nom: "Site Saint-Denis", typeSite: "Industriel", clientNom: c2.raisonSociale, statut: "ACTIF" },
  );

  const siteTourOpera = sites[0];
  const siteSaintDenis = sites[1];
  siteGestionnaires.push({
    id: nid(),
    siteId: siteTourOpera.id,
    clientNom: c3.raisonSociale,
    isPrincipal: true,
    dateDebut: "2026-01-01",
    dateFin: null,
    notes: "Démo Phase 6 — gestionnaire principal du site Tour Opéra",
  });

  const nowIso = new Date().toISOString();
  siteEquipements.push(
    {
      id: nid(),
      siteId: siteTourOpera.id,
      type: "ASCENSEUR",
      marque: "Otis",
      modele: "Gen2",
      numeroSerie: "OT-77421-A",
      anneeInstallation: 2012,
      capaciteKg: 1000,
      etages: "RDC → 18",
      statut: "ACTIF",
      notes: "Cabine rénovée 2023",
      createdAt: nowIso,
    },
    {
      id: nid(),
      siteId: siteTourOpera.id,
      type: "ASCENSEUR",
      marque: "Otis",
      modele: "Gen2",
      numeroSerie: "OT-77421-B",
      anneeInstallation: 2012,
      capaciteKg: 630,
      etages: "SS1 → 18",
      statut: "ACTIF",
      notes: null,
      createdAt: nowIso,
    },
    {
      id: nid(),
      siteId: siteTourOpera.id,
      type: "MONTE_CHARGE",
      marque: "Kone",
      modele: "Monospace",
      numeroSerie: "KN-MC-9021",
      anneeInstallation: 2018,
      capaciteKg: 2000,
      etages: "Cuisine → 18",
      statut: "ACTIF",
      notes: "Accès service",
      createdAt: nowIso,
    },
    {
      id: nid(),
      siteId: siteSaintDenis.id,
      type: "ASCENSEUR",
      marque: "Schindler",
      modele: "3300",
      numeroSerie: "SC-3300-4412",
      anneeInstallation: 2008,
      capaciteKg: 800,
      etages: "RDC → 6",
      statut: "HORS_SERVICE",
      notes: "Arrêt temporaire — pièce en attente",
      createdAt: nowIso,
    },
    {
      id: nid(),
      siteId: siteSaintDenis.id,
      type: "DAE",
      marque: "Otis",
      modele: "SkyRise",
      numeroSerie: "OT-SR-1102",
      anneeInstallation: 2015,
      capaciteKg: 1600,
      etages: "RDC → 6",
      statut: "ACTIF",
      notes: null,
      createdAt: nowIso,
    },
  );

  const consultantUserId = users.find((u) => u.role === "CONSULTANT")?.id ?? null;

  contacts.push({
    id: nid(),
    civilite: "M.",
    nom: "Dupont",
    prenom: "Jean",
    entreprise: c1.raisonSociale,
    fonction: "DA",
    email: "j.dupont@sidr.fr",
    telephone: "0142000001",
    mobile: "",
    statut: "ACTIF",
    ownerUserId: null,
  });

  contacts.push({
    id: nid(),
    civilite: "Mme",
    nom: "Martin",
    prenom: "Claire",
    entreprise: "Studio Orphelin",
    fonction: "DA",
    email: "c.martin@orphelin.test",
    telephone: "",
    mobile: "",
    statut: "ACTIF",
    ownerUserId: consultantUserId,
  });

  const moePhasesSeed = JSON.stringify([
    { code: "MOE-DCE", libelle: "DCE / consultation entreprises", montantHt: 12000, inclus: true },
    { code: "MOE-EXE", libelle: "Exécution & suivi de chantier", montantHt: 22000, inclus: true },
    { code: "MOE-REC", libelle: "Réception & dossier des ouvrages", montantHt: 8000, inclus: true },
  ]);
  const msPhasesSeed = JSON.stringify([
    { code: "MS-REG", libelle: "Mission réglementaire / obligations code du travail", montantHt: 3200, inclus: true },
    { code: "MS-VP", libelle: "Visites périodiques & registre", montantHt: 2100, inclus: true },
    { code: "MS-AST", libelle: "Assistance technique & mise en conformité", montantHt: 4500, inclus: true },
  ]);
  const echeFacDemo = JSON.stringify([
    { libelle: "Acompte à commande", pourcentage: 30, moisFacturation: "2026-06" },
    { libelle: "Solde à réception PV", pourcentage: 70, moisFacturation: "2026-08" },
  ]);
  const echeExeDemo = JSON.stringify([
    { libelle: "Lancement mission", datePrevue: "2026-05-15" },
    { libelle: "Livraison rapport", datePrevue: "2026-07-30" },
  ]);

  const missionsMoe = JSON.stringify([
    { code: "MOE-DCE", libelle: "DCE / consultation entreprises", montantHt: 12000 },
    { code: "MOE-EXE", libelle: "Exécution & suivi de chantier", montantHt: 22000 },
    { code: "MOE-REC", libelle: "Réception & dossier des ouvrages", montantHt: 8000 },
  ]);
  const missionsMs = JSON.stringify([
    { code: "MS-REG", libelle: "Mission réglementaire", montantHt: 3200 },
    { code: "MS-VP", libelle: "Visites périodiques", montantHt: 2100 },
  ]);

  offres.push(
    {
      id: nid(),
      numeroOffre: "LVO-MOE-26001",
      typeMission: "MOE",
      typeMissionsJson: JSON.stringify(["MOE"]),
      statut: "ENVOYEE",
      montantHt: 45000,
      dateOffre: "2026-04-15",
      clientNom: c3.raisonSociale,
      siteNom: "Tour Opéra",
      phasesMode: "ALL",
      phasesLinesJson: moePhasesSeed,
      echeancierFacturationJson: echeFacDemo,
      echeancierExecutionJson: echeExeDemo,
      tauxTva: crmAppSettings.tvaMetropolePercent,
      consultantEmail: crmAppSettings.defaultConsultantEmail,
      gestionnaireNom: c3.raisonSociale,
      gestionnaireContact: c3.responsableEmail ?? "contact@syndic-lilas.fr",
      missionsJson: missionsMoe,
    },
    {
      id: nid(),
      numeroOffre: "LVO-MS-26002",
      typeMission: "MS",
      typeMissionsJson: JSON.stringify(["MS", "MCN"]),
      statut: "ACCEPTEE",
      montantHt: 9800,
      dateOffre: "2026-05-01",
      clientNom: c2.raisonSociale,
      siteNom: "Site Saint-Denis",
      phasesMode: "SELECTION",
      phasesLinesJson: msPhasesSeed,
      echeancierFacturationJson: echeFacDemo,
      echeancierExecutionJson: echeExeDemo,
      tauxTva: crmAppSettings.tvaDomPercent,
      consultantEmail: "manager@lvo-ing.fr",
      gestionnaireNom: c2.raisonSociale,
      gestionnaireContact: null,
      missionsJson: missionsMs,
    },
  );

  commandes.push(
    {
      id: nid(),
      numeroCommande: "2026-LVO-MOE-001",
      dateCommande: "2026-04-20",
      montantHt: 45000,
      montantFacture: 30000,
      typeMission: "MOE",
      typeMissionsJson: JSON.stringify(["MOE"]),
      statut: "EN_COURS",
      siteNom: "Tour Opéra",
      clientNom: c1.raisonSociale,
      numeroClient: "PO-SIDR-2026-441",
    },
    {
      id: nid(),
      numeroCommande: "2026-LVO-MS-002",
      dateCommande: "2026-05-02",
      montantHt: 12000,
      montantFacture: 12000,
      typeMission: "MS",
      typeMissionsJson: JSON.stringify(["MS"]),
      statut: "FACTUREE",
      siteNom: "Site Saint-Denis",
      clientNom: c2.raisonSociale,
      numeroClient: "BC-MOBRUN-7781",
    },
  );

  const cmd0 = commandes[0];
  const cmd1 = commandes[1];

  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const past = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - days);
    return iso(d);
  };
  const future = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return iso(d);
  };

  factures.push(
    {
      id: nid(),
      numeroFacture: "LVO-F2026-001",
      dateFacture: past(60),
      numeroCommande: cmd0.numeroCommande,
      numeroCommandeClient: cmd0.numeroClient ?? null,
      clientNom: cmd0.clientNom,
      montantHt: 15000,
      frais: 0,
      modeReglement: "VIREMENT",
      dateEcheance: past(30),
      statutPaiement: "PAYE",
      montantPaye: 18000,
      niveauRelance: 0,
      derniereRelanceAt: null,
      commandeId: cmd0.id,
      statutFacturation: "PAYEE",
    },
    {
      id: nid(),
      numeroFacture: "LVO-F2026-002",
      dateFacture: past(25),
      numeroCommande: cmd0.numeroCommande,
      numeroCommandeClient: cmd0.numeroClient ?? null,
      clientNom: cmd0.clientNom,
      montantHt: 15000,
      frais: 0,
      modeReglement: "VIREMENT",
      dateEcheance: past(10),
      statutPaiement: "EN_RETARD",
      montantPaye: 0,
      niveauRelance: 1,
      derniereRelanceAt: past(9),
      commandeId: cmd0.id,
      statutFacturation: "ENVOYEE",
    },
    {
      id: nid(),
      numeroFacture: "LVO-F2026-003",
      dateFacture: past(12),
      numeroCommande: cmd0.numeroCommande,
      numeroCommandeClient: cmd0.numeroClient ?? null,
      clientNom: cmd0.clientNom,
      montantHt: 15000,
      frais: 0,
      modeReglement: "VIREMENT",
      dateEcheance: past(5),
      statutPaiement: "NON_PAYE",
      montantPaye: 0,
      niveauRelance: 0,
      derniereRelanceAt: null,
      commandeId: cmd0.id,
      statutFacturation: "ENVOYEE",
    },
    {
      id: nid(),
      numeroFacture: "LVO-F2026-004",
      dateFacture: past(8),
      numeroCommande: cmd1.numeroCommande,
      numeroCommandeClient: cmd1.numeroClient ?? null,
      clientNom: cmd1.clientNom,
      montantHt: 6000,
      frais: 50,
      modeReglement: "VIREMENT",
      dateEcheance: past(2),
      statutPaiement: "NON_PAYE",
      montantPaye: 0,
      niveauRelance: 0,
      derniereRelanceAt: null,
      commandeId: cmd1.id,
      statutFacturation: "ENVOYEE",
    },
    {
      id: nid(),
      numeroFacture: "LVO-F2026-005",
      dateFacture: past(3),
      numeroCommande: cmd1.numeroCommande,
      numeroCommandeClient: cmd1.numeroClient ?? null,
      clientNom: cmd1.clientNom,
      montantHt: 6000,
      frais: 0,
      modeReglement: "VIREMENT",
      dateEcheance: future(7),
      statutPaiement: "NON_PAYE",
      montantPaye: 0,
      niveauRelance: 0,
      derniereRelanceAt: null,
      commandeId: cmd1.id,
      statutFacturation: "ENVOYEE",
    },
    {
      id: nid(),
      numeroFacture: "LVO-F2026-006",
      dateFacture: iso(today),
      numeroCommande: cmd1.numeroCommande,
      numeroCommandeClient: cmd1.numeroClient ?? null,
      clientNom: cmd1.clientNom,
      montantHt: 2000,
      frais: 0,
      modeReglement: "VIREMENT",
      dateEcheance: future(30),
      statutPaiement: "NON_PAYE",
      montantPaye: 0,
      niveauRelance: 0,
      derniereRelanceAt: null,
      commandeId: cmd1.id,
      statutFacturation: "CREEE",
    },
  );

  pendingQuonto.push(
    {
      id: nid(),
      libelle: `Virement ${cmd0.clientNom} LVO-F2026-003`,
      montant: 18000,
      dateOperation: past(1),
      score: 72,
      quontoTransactionId: "qonto-demo-001",
    },
    {
      id: nid(),
      libelle: "Commission bancaire",
      montant: -2.5,
      dateOperation: past(0),
      score: 12,
      quontoTransactionId: "qonto-demo-002",
    },
  );

  historiqueAnnulations.push({
    id: nid(),
    entityType: "OFFRE",
    entityId: 99,
    reference: "LVO-MS-25999",
    motif: "Doublon",
    commentaire: null,
    montantHt: 5000,
    clientNom: c1.raisonSociale,
    cancelledAt: past(100),
  });

  const adminUser = users.find((u) => u.role === "ADMIN");
  const managerUser = users.find((u) => u.role === "MANAGER");
  const consultantUser = users.find((u) => u.role === "CONSULTANT");
  const seedNotif = (
    userId: number,
    kind: CrmNotificationKind,
    title: string,
    message: string,
    href: string | null,
  ) => {
    crmNotifications.push({
      id: nid(),
      userId,
      kind,
      title,
      message,
      href,
      entityType: null,
      entityId: null,
      read: false,
      createdAt: nowIso,
      source: "seed",
    });
  };
  if (adminUser) {
    seedNotif(adminUser.id, "INFO", "Bienvenue sur le centre de notifications", "Les alertes métier (tâches, offres, impayés) s’affichent ici.", "/crm/accueil");
  }
  if (managerUser) {
    seedNotif(managerUser.id, "INFO", "Registre équipements disponible", "Consultez les ascenseurs et monte-charges depuis la fiche site.", "/crm/sites");
  }
  if (consultantUser) {
    seedNotif(consultantUser.id, "INFO", "Analyse MMS", "Importez un fichier maintenance depuis Outils → Maintenance MMS.", "/crm/outils/maintenance-mms");
  }
}
