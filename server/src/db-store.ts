/**
 * Persistance normalisée : sauvegarde et chargement du store en-mémoire
 * vers/depuis les tables PostgreSQL via Prisma.
 *
 * Stratégie : chaque entité possède une colonne `legacy_id` (INT UNIQUE)
 * qui correspond à l'ID numérique utilisé dans le store in-memory.
 * Cela permet des UPSERT sans changer l'API REST existante.
 */

import { getPrisma } from "./db.js";
import {
  users, contacts, ascensoristes, clients, sites, siteGestionnaires, siteEquipements,
  siteArborescenceNodes, offres, commandes, factures, avoirs,
  pendingQuonto, auditLog, crmTasks, crmNotifications,
  clientMessages, clientDocuments, clientNotifications,
  clientInterventions, clientContrats, clientAlertesConfigs,
  mmsRapports, historiqueAnnulations, fichierVersions,
  type UserRow, type ContactRow, type AscensoristeRow, type ClientRow, type SiteRow,
  type SiteGestionnaireRow, type SiteEquipementRow, type SiteArborescenceNodeRow,
  type OffreRow, type CommandeRow, type FactureRow, type AvoirRow,
  type PendingQuontoTx, type AuditLogRow, type CrmTaskRow, type CrmNotificationRow,
  type ClientMessageRow, type ClientDocumentRow, type ClientNotificationRow,
  type ClientInterventionRow, type ClientContratRow, type ClientAlertesConfig,
  type MmsRapportRow, type HistoryAnnulationRow, type FichierVersionRow,
} from "./store.js";

// ─── Maps legacy_id → UUID (remplies pendant le save, lues pendant le save des fils) ──

const uMap   = new Map<number, string>(); // users
const clMap  = new Map<number, string>(); // clients
const coMap  = new Map<number, string>(); // contacts
const sMap   = new Map<number, string>(); // sites
const oMap   = new Map<number, string>(); // offres
const cmMap  = new Map<number, string>(); // commandes
const fMap   = new Map<number, string>(); // factures
const eqMap  = new Map<number, string>(); // equipements
const anMap  = new Map<number, string>(); // arborescence nodes

function clearMaps() {
  uMap.clear(); clMap.clear(); coMap.clear(); sMap.clear();
  oMap.clear(); cmMap.clear(); fMap.clear(); eqMap.clear(); anMap.clear();
}

// ─── SAVE ─────────────────────────────────────────────────────────────────────

export async function saveAllToDb(): Promise<void> {
  const prisma = getPrisma();
  clearMaps();

  // 1. Users
  for (const u of users) {
    const r = await prisma.user.upsert({
      where:  { legacyId: u.id },
      update: {
        email: u.email, passwordHash: u.passwordHash ?? null, role: u.role,
        prenom: u.prenom ?? null, nom: u.nom ?? null, telephone: u.telephone ?? null,
        avatarDataUrl: u.avatarDataUrl ?? null, agenceId: u.agenceId ?? null,
      },
      create: {
        legacyId: u.id, email: u.email, passwordHash: u.passwordHash ?? null,
        role: u.role, prenom: u.prenom ?? null, nom: u.nom ?? null,
        telephone: u.telephone ?? null, avatarDataUrl: u.avatarDataUrl ?? null,
        agenceId: u.agenceId ?? null,
      },
      select: { id: true },
    });
    uMap.set(u.id, r.id);
  }

  // 2. Clients
  for (const c of clients) {
    const r = await prisma.client.upsert({
      where:  { legacyId: c.id },
      update: {
        raisonSociale: c.raisonSociale, entite: c.entite ?? null,
        email: c.email ?? null, telephone: c.telephone ?? null,
        siret: c.siret ?? null, codePostal: c.codePostal ?? null,
        responsableEmail: c.responsableEmail ?? null,
        statut: (c.statut as "ACTIF" | "ANNULE" | "ARCHIVE") ?? "ACTIF",
        cancelledAt: c.cancelledAt ? new Date(c.cancelledAt) : null,
        cancellationReason: c.cancellationReason ?? null,
      },
      create: {
        legacyId: c.id, raisonSociale: c.raisonSociale, entite: c.entite ?? null,
        email: c.email ?? null, telephone: c.telephone ?? null,
        siret: c.siret ?? null, codePostal: c.codePostal ?? null,
        responsableEmail: c.responsableEmail ?? null,
        statut: (c.statut as "ACTIF" | "ANNULE" | "ARCHIVE") ?? "ACTIF",
        cancelledAt: c.cancelledAt ? new Date(c.cancelledAt) : null,
        cancellationReason: c.cancellationReason ?? null,
        createdAt: c.createdAtIso ? new Date(c.createdAtIso) : new Date(),
      },
      select: { id: true },
    });
    clMap.set(c.id, r.id);
  }

  // 3. Contacts
  for (const c of contacts) {
    const r = await prisma.contact.upsert({
      where:  { legacyId: c.id },
      update: {
        civilite: c.civilite ?? null, nom: c.nom, prenom: c.prenom,
        entreprise: c.entreprise ?? null, fonction: c.fonction ?? null,
        email: c.email ?? null, telephone: c.telephone ?? null, mobile: c.mobile ?? null,
        ownerUserId: c.ownerUserId ?? null, clientPasswordHash: c.clientPasswordHash ?? null,
        statut: (c.statut as "ACTIF" | "ANNULE" | "ARCHIVE") ?? "ACTIF",
        cancelledAt: c.cancelledAt ? new Date(c.cancelledAt) : null,
        cancellationReason: c.cancellationReason ?? null,
      },
      create: {
        legacyId: c.id, civilite: c.civilite ?? null, nom: c.nom, prenom: c.prenom,
        entreprise: c.entreprise ?? null, fonction: c.fonction ?? null,
        email: c.email ?? null, telephone: c.telephone ?? null, mobile: c.mobile ?? null,
        ownerUserId: c.ownerUserId ?? null, clientPasswordHash: c.clientPasswordHash ?? null,
        statut: (c.statut as "ACTIF" | "ANNULE" | "ARCHIVE") ?? "ACTIF",
        cancelledAt: c.cancelledAt ? new Date(c.cancelledAt) : null,
        cancellationReason: c.cancellationReason ?? null,
      },
      select: { id: true },
    });
    coMap.set(c.id, r.id);
  }

  // 3b. Ascensoristes (espace prestataire — comptes de dépôt de devis)
  for (const a of ascensoristes) {
    await prisma.ascensoriste.upsert({
      where:  { legacyId: a.id },
      update: {
        entreprise: a.entreprise, nom: a.nom, prenom: a.prenom, email: a.email,
        telephone: a.telephone ?? null, ascensoristePasswordHash: a.ascensoristePasswordHash ?? null,
        statut: a.statut,
      },
      create: {
        legacyId: a.id, entreprise: a.entreprise, nom: a.nom, prenom: a.prenom, email: a.email,
        telephone: a.telephone ?? null, ascensoristePasswordHash: a.ascensoristePasswordHash ?? null,
        statut: a.statut,
      },
    });
  }

  // 4. Sites (nécessite clientId UUID → clMap)
  for (const s of sites) {
    // Résolution du client : on cherche d'abord par nom dans clMap
    const clientUuid = resolveClientByNom(s.clientNom);
    if (!clientUuid) continue; // site orphelin, skip
    const r = await prisma.site.upsert({
      where:  { legacyId: s.id },
      update: {
        clientId: clientUuid, nom: s.nom, typeSite: s.typeSite ?? null,
        statut: s.statut ?? "ACTIF", imageDataUrl: s.imageDataUrl ?? null,
        clientNom: s.clientNom ?? null,
      },
      create: {
        legacyId: s.id, clientId: clientUuid, nom: s.nom, typeSite: s.typeSite ?? null,
        statut: s.statut ?? "ACTIF", imageDataUrl: s.imageDataUrl ?? null,
        clientNom: s.clientNom ?? null,
      },
      select: { id: true },
    });
    sMap.set(s.id, r.id);
  }

  // 5. Gestionnaires de site
  for (const g of siteGestionnaires) {
    const siteUuid = sMap.get(g.siteId);
    if (!siteUuid) continue;
    const clientUuid = resolveClientByNom(g.clientNom) ?? null;
    await prisma.siteGestionnaire.upsert({
      where:  { legacyId: g.id },
      update: {
        siteId: siteUuid, clientId: clientUuid, clientNom: g.clientNom ?? null,
        isPrincipal: g.isPrincipal,
        dateDebut: g.dateDebut ? new Date(g.dateDebut) : null,
        dateFin: g.dateFin ? new Date(g.dateFin) : null,
        notes: g.notes ?? null,
      },
      create: {
        legacyId: g.id, siteId: siteUuid, clientId: clientUuid, clientNom: g.clientNom ?? null,
        isPrincipal: g.isPrincipal,
        dateDebut: g.dateDebut ? new Date(g.dateDebut) : null,
        dateFin: g.dateFin ? new Date(g.dateFin) : null,
        notes: g.notes ?? null,
      },
    });
  }

  // 6. Équipements
  for (const e of siteEquipements) {
    const siteUuid = sMap.get(e.siteId);
    if (!siteUuid) continue;
    const r = await prisma.siteEquipement.upsert({
      where:  { legacyId: e.id },
      update: {
        siteId: siteUuid, type: e.type, marque: e.marque ?? null, modele: e.modele ?? null,
        numeroSerie: e.numeroSerie ?? null,
        anneeInstallation: e.anneeInstallation ?? null, capaciteKg: e.capaciteKg ?? null,
        etages: e.etages ?? null, statut: e.statut ?? "ACTIF", notes: e.notes ?? null,
      },
      create: {
        legacyId: e.id, siteId: siteUuid, type: e.type, marque: e.marque ?? null,
        modele: e.modele ?? null, numeroSerie: e.numeroSerie ?? null,
        anneeInstallation: e.anneeInstallation ?? null, capaciteKg: e.capaciteKg ?? null,
        etages: e.etages ?? null, statut: e.statut ?? "ACTIF", notes: e.notes ?? null,
        createdAt: e.createdAt ? new Date(e.createdAt) : new Date(),
      },
      select: { id: true },
    });
    eqMap.set(e.id, r.id);
  }

  // 7. Nœuds arborescence (2 passes : création d'abord sans parent, puis mise à jour avec parent)
  const nodeFirstPass: SiteArborescenceNodeRow[] = [];
  for (const n of siteArborescenceNodes) {
    const siteUuid = sMap.get(n.siteId);
    if (!siteUuid) continue;
    const r = await prisma.siteArborescenceNode.upsert({
      where:  { legacyId: n.id },
      update: {
        siteId: siteUuid, nodeType: n.nodeType, nom: n.nom, sortOrder: n.sortOrder,
        storedPath: n.storedPath ?? null, contentType: n.contentType ?? null,
        sizeBytes: n.sizeBytes != null ? BigInt(n.sizeBytes) : null,
        uploadedByUserId: n.uploadedByUserId ?? null,
        legacyParentId: n.parentId ?? null,
      },
      create: {
        legacyId: n.id, siteId: siteUuid, nodeType: n.nodeType, nom: n.nom,
        sortOrder: n.sortOrder, storedPath: n.storedPath ?? null,
        contentType: n.contentType ?? null,
        sizeBytes: n.sizeBytes != null ? BigInt(n.sizeBytes) : null,
        uploadedByUserId: n.uploadedByUserId ?? null,
        legacyParentId: n.parentId ?? null,
        createdAt: n.createdAt ? new Date(n.createdAt) : new Date(),
      },
      select: { id: true },
    });
    anMap.set(n.id, r.id);
    if (n.parentId != null) nodeFirstPass.push(n);
  }
  // 2ème passe : résoudre les parentId
  for (const n of nodeFirstPass) {
    const nodeUuid   = anMap.get(n.id);
    const parentUuid = n.parentId != null ? anMap.get(n.parentId) : null;
    if (!nodeUuid || !parentUuid) continue;
    await prisma.siteArborescenceNode.update({
      where: { id: nodeUuid },
      data:  { parentId: parentUuid },
    });
  }

  // 8. Offres
  for (const o of offres) {
    const clientUuid = resolveClientByNom(o.clientNom);
    const siteUuid   = resolveSiteByNom(o.siteNom);
    if (!clientUuid || !siteUuid) continue;
    const r = await prisma.offre.upsert({
      where:  { legacyId: o.id },
      update: {
        numeroOffre: o.numeroOffre, typeMission: o.typeMission,
        typeMissionsJson: o.typeMissionsJson ?? null, statut: o.statut,
        montantHt: o.montantHt, dateOffre: o.dateOffre ? new Date(o.dateOffre) : null,
        clientId: clientUuid, siteId: siteUuid,
        clientNom: o.clientNom ?? null, siteNom: o.siteNom ?? null,
        phasesMode: o.phasesMode ?? null, phasesLinesJson: o.phasesLinesJson ?? null,
        tauxTva: o.tauxTva != null ? o.tauxTva : null,
        consultantEmail: o.consultantEmail ?? null,
        gestionnaireNom: o.gestionnaireNom ?? null,
        gestionnaireContact: o.gestionnaireContact ?? null,
        gestionnaireEmail: o.gestionnaireEmail ?? null,
        clientDecisionJson: o.clientDecisionJson ?? null,
        missionsJson: o.missionsJson ?? null,
      },
      create: {
        legacyId: o.id, numeroOffre: o.numeroOffre, typeMission: o.typeMission,
        typeMissionsJson: o.typeMissionsJson ?? null, statut: o.statut,
        montantHt: o.montantHt, dateOffre: o.dateOffre ? new Date(o.dateOffre) : null,
        clientId: clientUuid, siteId: siteUuid,
        clientNom: o.clientNom ?? null, siteNom: o.siteNom ?? null,
        phasesMode: o.phasesMode ?? null, phasesLinesJson: o.phasesLinesJson ?? null,
        tauxTva: o.tauxTva != null ? o.tauxTva : null,
        consultantEmail: o.consultantEmail ?? null,
        gestionnaireNom: o.gestionnaireNom ?? null,
        gestionnaireContact: o.gestionnaireContact ?? null,
        gestionnaireEmail: o.gestionnaireEmail ?? null,
        clientDecisionJson: o.clientDecisionJson ?? null,
        missionsJson: o.missionsJson ?? null,
      },
      select: { id: true },
    });
    oMap.set(o.id, r.id);
  }

  // 9. Commandes
  for (const c of commandes) {
    const clientUuid = resolveClientByNom(c.clientNom);
    const siteUuid   = resolveSiteByNom(c.siteNom);
    if (!clientUuid || !siteUuid) continue;
    const offreUuid = c.numeroCommande
      ? offres.find((o) => o.numeroOffre === c.numeroCommande.replace(/CMD/, "OFF"))?.id
        ? oMap.get(offres.find((o) => o.numeroOffre === c.numeroCommande.replace(/CMD/, "OFF"))!.id)
        : null
      : null;
    const r = await prisma.commande.upsert({
      where:  { legacyId: c.id },
      update: {
        numeroCommande: c.numeroCommande,
        dateCommande: c.dateCommande ? new Date(c.dateCommande) : null,
        typeMission: c.typeMission, typeMissionsJson: c.typeMissionsJson ?? null,
        statut: c.statut ?? null,
        montantHt: c.montantHt, montantFacture: c.montantFacture,
        clientId: clientUuid, siteId: siteUuid,
        offreId: offreUuid ?? null,
        clientNom: c.clientNom ?? null, siteNom: c.siteNom ?? null,
        numeroClient: c.numeroClient ?? null,
      },
      create: {
        legacyId: c.id, numeroCommande: c.numeroCommande,
        dateCommande: c.dateCommande ? new Date(c.dateCommande) : null,
        typeMission: c.typeMission, typeMissionsJson: c.typeMissionsJson ?? null,
        statut: c.statut ?? null,
        montantHt: c.montantHt, montantFacture: c.montantFacture,
        clientId: clientUuid, siteId: siteUuid,
        offreId: offreUuid ?? null,
        clientNom: c.clientNom ?? null, siteNom: c.siteNom ?? null,
        numeroClient: c.numeroClient ?? null,
      },
      select: { id: true },
    });
    cmMap.set(c.id, r.id);
  }

  // 10. Factures
  for (const f of factures) {
    const commandeUuid = cmMap.get(f.commandeId);
    if (!commandeUuid) continue;
    const r = await prisma.facture.upsert({
      where:  { legacyId: f.id },
      update: {
        numeroFacture: f.numeroFacture,
        commandeId: commandeUuid,
        dateFacture: f.dateFacture ? new Date(f.dateFacture) : null,
        dateEcheance: f.dateEcheance ? new Date(f.dateEcheance) : null,
        montantHt: f.montantHt, frais: f.frais ?? 0,
        modeReglement: f.modeReglement ?? "VIREMENT",
        numeroCommandeClient: f.numeroCommandeClient ?? null,
        numeroCommandeDisplay: f.numeroCommande ?? null,
        clientNom: f.clientNom ?? null,
        statutPaiement: mapStatutPaiement(f.statutPaiement),
        statutFacturation: f.statutFacturation ?? null,
        montantPaye: f.montantPaye ?? 0,
        niveauRelance: f.niveauRelance ?? 0,
        derniereRelanceAt: f.derniereRelanceAt ? new Date(f.derniereRelanceAt) : null,
      },
      create: {
        legacyId: f.id, numeroFacture: f.numeroFacture,
        commandeId: commandeUuid,
        dateFacture: f.dateFacture ? new Date(f.dateFacture) : null,
        dateEcheance: f.dateEcheance ? new Date(f.dateEcheance) : null,
        montantHt: f.montantHt, frais: f.frais ?? 0,
        modeReglement: f.modeReglement ?? "VIREMENT",
        numeroCommandeClient: f.numeroCommandeClient ?? null,
        numeroCommandeDisplay: f.numeroCommande ?? null,
        clientNom: f.clientNom ?? null,
        statutPaiement: mapStatutPaiement(f.statutPaiement),
        statutFacturation: f.statutFacturation ?? null,
        montantPaye: f.montantPaye ?? 0,
        niveauRelance: f.niveauRelance ?? 0,
        derniereRelanceAt: f.derniereRelanceAt ? new Date(f.derniereRelanceAt) : null,
      },
      select: { id: true },
    });
    fMap.set(f.id, r.id);
  }

  // 11. Avoirs
  for (const a of avoirs) {
    const factureUuid  = fMap.get(a.factureOrigineId);
    const commandeUuid = cmMap.get(a.commandeId);
    if (!factureUuid || !commandeUuid) continue;
    await prisma.avoir.upsert({
      where:  { legacyId: a.id },
      update: {
        numero: a.numero, factureOrigineId: factureUuid, commandeId: commandeUuid,
        motif: a.motif, montantHt: a.montantHt, tauxTva: a.tauxTva,
        montantTtc: a.montantTtc,
        dateEmission: a.createdAt ? new Date(a.createdAt) : new Date(),
      },
      create: {
        legacyId: a.id, numero: a.numero, factureOrigineId: factureUuid,
        commandeId: commandeUuid, motif: a.motif, montantHt: a.montantHt,
        tauxTva: a.tauxTva, montantTtc: a.montantTtc,
        dateEmission: a.createdAt ? new Date(a.createdAt) : new Date(),
        createdAt: a.createdAt ? new Date(a.createdAt) : new Date(),
      },
    });
  }

  // 12. CRM Tasks
  for (const t of crmTasks) {
    const userUuid = uMap.get(t.userId);
    if (!userUuid) continue;
    await prisma.crmTask.upsert({
      where:  { legacyId: t.id },
      update: {
        userId: userUuid, title: t.title, done: t.done,
        dueDate: t.dueDate ? new Date(t.dueDate) : null,
        dueHour: t.dueHour ?? null, dueMinute: t.dueMinute ?? null,
        entityType: t.entityType ?? null, entityId: t.entityId ?? null,
      },
      create: {
        legacyId: t.id, userId: userUuid, title: t.title, done: t.done,
        dueDate: t.dueDate ? new Date(t.dueDate) : null,
        dueHour: t.dueHour ?? null, dueMinute: t.dueMinute ?? null,
        entityType: t.entityType ?? null, entityId: t.entityId ?? null,
        createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
      },
    });
  }

  // 13. CRM Notifications
  for (const n of crmNotifications) {
    const userUuid = uMap.get(n.userId);
    if (!userUuid) continue;
    await prisma.crmNotification.upsert({
      where:  { legacyId: n.id },
      update: {
        userId: userUuid, kind: n.kind, title: n.title, message: n.message,
        href: n.href ?? null, entityType: n.entityType ?? null,
        entityId: n.entityId ?? null, read: n.read, source: n.source ?? null,
      },
      create: {
        legacyId: n.id, userId: userUuid, kind: n.kind, title: n.title,
        message: n.message, href: n.href ?? null, entityType: n.entityType ?? null,
        entityId: n.entityId ?? null, read: n.read, source: n.source ?? null,
        createdAt: n.createdAt ? new Date(n.createdAt) : new Date(),
      },
    });
  }

  // 14. Messages espace client
  for (const m of clientMessages) {
    await prisma.clientPortalMessage.upsert({
      where:  { legacyId: m.id },
      update: {
        threadId: m.threadId, entreprise: m.entreprise, subject: m.subject,
        body: m.body, senderType: m.senderType, senderName: m.senderName ?? null,
        senderEmail: m.senderEmail ?? null,
        readByClient: m.readByClient, readByCrm: m.readByCrm,
      },
      create: {
        legacyId: m.id, threadId: m.threadId, entreprise: m.entreprise,
        subject: m.subject, body: m.body, senderType: m.senderType,
        senderName: m.senderName ?? null, senderEmail: m.senderEmail ?? null,
        readByClient: m.readByClient, readByCrm: m.readByCrm,
        createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
      },
    });
  }

  // 15. Documents espace client
  for (const d of clientDocuments) {
    const contactUuid  = d.contactId ? coMap.get(d.contactId) ?? null : null;
    const siteUuid     = d.siteId    ? sMap.get(d.siteId)    ?? null : null;
    const offreUuid    = d.offreId   ? oMap.get(d.offreId)   ?? null : null;
    const commandeUuid = d.commandeId ? cmMap.get(d.commandeId) ?? null : null;
    await prisma.clientPortalDocument.upsert({
      where:  { legacyId: d.id },
      update: {
        entreprise: d.entreprise, contactId: contactUuid, siteId: siteUuid,
        nom: d.nom, type: d.type, fileName: d.fileName, storedPath: d.storedPath ?? null,
        sizeBytes: d.sizeBytes != null ? BigInt(d.sizeBytes) : null,
        contentType: d.contentType ?? null, statut: d.statut ?? "EN_ATTENTE",
        motifRejet: d.motifRejet ?? null,
        validatedAt: d.validatedAt ? new Date(d.validatedAt) : null,
        offreId: offreUuid, commandeId: commandeUuid, notes: d.notes ?? null,
      },
      create: {
        legacyId: d.id, entreprise: d.entreprise, contactId: contactUuid, siteId: siteUuid,
        nom: d.nom, type: d.type, fileName: d.fileName, storedPath: d.storedPath ?? null,
        sizeBytes: d.sizeBytes != null ? BigInt(d.sizeBytes) : null,
        contentType: d.contentType ?? null, statut: d.statut ?? "EN_ATTENTE",
        motifRejet: d.motifRejet ?? null,
        validatedAt: d.validatedAt ? new Date(d.validatedAt) : null,
        offreId: offreUuid, commandeId: commandeUuid, notes: d.notes ?? null,
        uploadedAt: d.uploadedAt ? new Date(d.uploadedAt) : new Date(),
      },
    });
  }

  // 16. Notifications espace client
  for (const n of clientNotifications) {
    await prisma.clientPortalNotification.upsert({
      where:  { legacyId: n.id },
      update: {
        entreprise: n.entreprise, title: n.title, message: n.message,
        kind: n.kind, href: n.href ?? null, read: n.read,
      },
      create: {
        legacyId: n.id, entreprise: n.entreprise, title: n.title,
        message: n.message, kind: n.kind, href: n.href ?? null, read: n.read,
        createdAt: n.createdAt ? new Date(n.createdAt) : new Date(),
      },
    });
  }

  // 17. Contrats clients
  for (const c of clientContrats) {
    const siteUuid = c.siteId ? sMap.get(c.siteId) ?? null : null;
    await prisma.clientContrat.upsert({
      where:  { legacyId: c.id },
      update: {
        entreprise: c.entreprise, reference: c.reference, intitule: c.intitule,
        siteId: siteUuid, siteNom: c.siteNom ?? null, typeContrat: c.typeContrat ?? null,
        dateDebut: new Date(c.dateDebut), dateFin: new Date(c.dateFin),
        montantAnnuelHt: c.montantAnnuelHt ?? null, prestataire: c.prestataire ?? null,
        statut: c.statut ?? "ACTIF",
        conditionsRenouvellement: c.conditionsRenouvellement ?? null,
        clauseRevisionTarifaire: c.clauseRevisionTarifaire ?? null,
        avenantsJson: c.avenantsJson ?? null,
        demandeRenouvellementAt: c.demandeRenouvellementAt ? new Date(c.demandeRenouvellementAt) : null,
      },
      create: {
        legacyId: c.id, entreprise: c.entreprise, reference: c.reference,
        intitule: c.intitule, siteId: siteUuid, siteNom: c.siteNom ?? null,
        typeContrat: c.typeContrat ?? null,
        dateDebut: new Date(c.dateDebut), dateFin: new Date(c.dateFin),
        montantAnnuelHt: c.montantAnnuelHt ?? null, prestataire: c.prestataire ?? null,
        statut: c.statut ?? "ACTIF",
        conditionsRenouvellement: c.conditionsRenouvellement ?? null,
        clauseRevisionTarifaire: c.clauseRevisionTarifaire ?? null,
        avenantsJson: c.avenantsJson ?? null,
        demandeRenouvellementAt: c.demandeRenouvellementAt ? new Date(c.demandeRenouvellementAt) : null,
      },
    });
  }

  // 18. Interventions
  for (const i of clientInterventions) {
    const siteUuid      = i.siteId       ? sMap.get(i.siteId)       ?? null : null;
    const equipUuid     = i.equipementId ? eqMap.get(i.equipementId) ?? null : null;
    const contactUuid   = coMap.get(i.declaredByContactId) ?? null;
    await prisma.clientIntervention.upsert({
      where:  { legacyId: i.id },
      update: {
        entreprise: i.entreprise, reference: i.reference,
        siteId: siteUuid, siteNom: i.siteNom ?? null,
        equipementId: equipUuid, equipementLibelle: i.equipementLibelle ?? null,
        type: i.type, priorite: i.priorite ?? "NORMALE", statut: i.statut ?? "CREEE",
        description: i.description, prestataire: i.prestataire ?? null,
        declaredAt: i.declaredAt ? new Date(i.declaredAt) : new Date(),
        assignedAt: i.assignedAt ? new Date(i.assignedAt) : null,
        resolvedAt: i.resolvedAt ? new Date(i.resolvedAt) : null,
        compteRendu: i.compteRendu ?? null,
        declaredByContactId: contactUuid, declaredByName: i.declaredByName ?? null,
      },
      create: {
        legacyId: i.id, entreprise: i.entreprise, reference: i.reference,
        siteId: siteUuid, siteNom: i.siteNom ?? null,
        equipementId: equipUuid, equipementLibelle: i.equipementLibelle ?? null,
        type: i.type, priorite: i.priorite ?? "NORMALE", statut: i.statut ?? "CREEE",
        description: i.description, prestataire: i.prestataire ?? null,
        declaredAt: i.declaredAt ? new Date(i.declaredAt) : new Date(),
        assignedAt: i.assignedAt ? new Date(i.assignedAt) : null,
        resolvedAt: i.resolvedAt ? new Date(i.resolvedAt) : null,
        compteRendu: i.compteRendu ?? null,
        declaredByContactId: contactUuid, declaredByName: i.declaredByName ?? null,
      },
    });
  }

  // 19. Configs alertes
  for (const cfg of clientAlertesConfigs) {
    await prisma.clientAlertesConfig.upsert({
      where:  { entreprise: cfg.entreprise },
      update: {
        factureImpayee: cfg.factureImpayee, factureImpayeeDelaiJours: cfg.factureImpayeeDelaiJours,
        contratExpirant: cfg.contratExpirant, panneSignalee: cfg.panneSignalee,
        mmsSousSeuil: cfg.mmsSousSeuilCritique ?? false, mmsSeuil: cfg.mmsSeuil ?? 5.0,
        offreExpirant: cfg.offreExpirant, visiteReglementaire: cfg.visiteReglementaire,
      },
      create: {
        entreprise: cfg.entreprise,
        factureImpayee: cfg.factureImpayee, factureImpayeeDelaiJours: cfg.factureImpayeeDelaiJours,
        contratExpirant: cfg.contratExpirant, panneSignalee: cfg.panneSignalee,
        mmsSousSeuil: cfg.mmsSousSeuilCritique ?? false, mmsSeuil: cfg.mmsSeuil ?? 5.0,
        offreExpirant: cfg.offreExpirant, visiteReglementaire: cfg.visiteReglementaire,
      },
    });
  }

  // 20. Rapports MMS
  for (const r of mmsRapports) {
    const userUuid = r.createdByUserId ? uMap.get(r.createdByUserId) ?? null : null;
    const siteUuid = r.siteId         ? sMap.get(r.siteId)          ?? null : null;
    await prisma.mmsRapport.upsert({
      where:  { legacyId: r.id },
      update: {
        prestataire: r.prestataire, client: r.client, trimestre: r.trimestre, annee: r.annee,
        createdByUserId: userUuid, siteId: siteUuid,
        nbAppareils: r.nbAppareils, nbInterventions: r.nbInterventions,
        nbPannes: r.nbPannes, nbVisites: r.nbVisites, penaliteTotale: r.penaliteTotale,
        excelNom: r.excelNom ?? null, wordNom: r.wordNom ?? null, pdfNom: r.pdfNom ?? null,
        excelMinioKey: r.excelPath ?? null, wordMinioKey: r.wordPath ?? null, pdfMinioKey: r.pdfPath ?? null,
        excelSizeBytes: r.excelSizeBytes != null ? BigInt(r.excelSizeBytes) : null,
        wordSizeBytes: r.wordSizeBytes != null ? BigInt(r.wordSizeBytes) : null,
        pdfSizeBytes: r.pdfSizeBytes != null ? BigInt(r.pdfSizeBytes) : null,
      },
      create: {
        legacyId: r.id, prestataire: r.prestataire, client: r.client,
        trimestre: r.trimestre, annee: r.annee, createdByUserId: userUuid, siteId: siteUuid,
        nbAppareils: r.nbAppareils, nbInterventions: r.nbInterventions,
        nbPannes: r.nbPannes, nbVisites: r.nbVisites, penaliteTotale: r.penaliteTotale,
        excelNom: r.excelNom ?? null, wordNom: r.wordNom ?? null, pdfNom: r.pdfNom ?? null,
        excelMinioKey: r.excelPath ?? null, wordMinioKey: r.wordPath ?? null, pdfMinioKey: r.pdfPath ?? null,
        excelSizeBytes: r.excelSizeBytes != null ? BigInt(r.excelSizeBytes) : null,
        wordSizeBytes: r.wordSizeBytes != null ? BigInt(r.wordSizeBytes) : null,
        pdfSizeBytes: r.pdfSizeBytes != null ? BigInt(r.pdfSizeBytes) : null,
        createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
      },
    });
  }

  // 21. Transactions Quonto en attente
  for (const q of pendingQuonto) {
    await prisma.pendingQuontoTransaction.upsert({
      where:  { legacyId: q.id },
      update: {
        libelle: q.libelle, montant: q.montant,
        dateOperation: new Date(q.dateOperation),
        score: q.score ?? 0,
        quontoTransactionId: q.quontoTransactionId,
      },
      create: {
        legacyId: q.id, libelle: q.libelle, montant: q.montant,
        dateOperation: new Date(q.dateOperation),
        score: q.score ?? 0,
        quontoTransactionId: q.quontoTransactionId,
      },
    });
  }

  // 22. Journal d'audit
  for (const a of auditLog) {
    await prisma.auditLog.upsert({
      where:  { legacyId: a.id },
      update: {
        entityType: a.entity_type, entityId: a.entity_id,
        action: a.action, changes: (a.changes ?? null) as object,
        performedBy: a.performed_by, ipAddress: a.ip_address ?? null,
        userAgent: a.user_agent ?? null,
      },
      create: {
        legacyId: a.id, entityType: a.entity_type, entityId: a.entity_id,
        action: a.action, changes: (a.changes ?? null) as object,
        performedBy: a.performed_by, ipAddress: a.ip_address ?? null,
        userAgent: a.user_agent ?? null,
        performedAt: a.performed_at ? new Date(a.performed_at) : new Date(),
      },
    });
  }

  // 23. Historique annulations
  for (const h of historiqueAnnulations) {
    await prisma.historiqueAnnulation.upsert({
      where:  { legacyId: h.id },
      update: {
        entityType: h.entityType, entityId: h.entityId, reference: h.reference,
        motif: h.motif, commentaire: h.commentaire ?? null,
        montantHt: h.montantHt ?? null, clientNom: h.clientNom ?? null,
      },
      create: {
        legacyId: h.id, entityType: h.entityType, entityId: h.entityId,
        reference: h.reference, motif: h.motif, commentaire: h.commentaire ?? null,
        montantHt: h.montantHt ?? null, clientNom: h.clientNom ?? null,
        cancelledAt: h.cancelledAt ? new Date(h.cancelledAt) : new Date(),
      },
    });
  }
}

// ─── LOAD ─────────────────────────────────────────────────────────────────────

/**
 * Charge toutes les entités depuis PostgreSQL et remplit les tableaux du store.
 * Retourne true si des données existent en DB.
 */
export async function loadAllFromDb(): Promise<boolean> {
  const prisma = getPrisma();

  const [
    dbUsers, dbClients, dbContacts, dbAscensoristes, dbSites, dbSiteGestionnaires, dbEquipements,
    dbNodes, dbOffres, dbCommandes, dbFactures, dbAvoirs,
    dbCrmTasks, dbCrmNotifications, dbMessages, dbDocs, dbNotifs,
    dbContrats, dbInterventions, dbAlertes, dbMms,
    dbPendingQ, dbAudit, dbHistorique,
  ] = await Promise.all([
    prisma.user.findMany({ where: { legacyId: { not: null } }, orderBy: { legacyId: "asc" } }),
    prisma.client.findMany({ where: { legacyId: { not: null } }, orderBy: { legacyId: "asc" } }),
    prisma.contact.findMany({ where: { legacyId: { not: null } }, orderBy: { legacyId: "asc" } }),
    prisma.ascensoriste.findMany({ where: { legacyId: { not: null } }, orderBy: { legacyId: "asc" } }),
    prisma.site.findMany({ where: { legacyId: { not: null } }, orderBy: { legacyId: "asc" } }),
    prisma.siteGestionnaire.findMany({ where: { legacyId: { not: null } }, orderBy: { legacyId: "asc" } }),
    prisma.siteEquipement.findMany({ where: { legacyId: { not: null } }, orderBy: { legacyId: "asc" } }),
    prisma.siteArborescenceNode.findMany({ where: { legacyId: { not: null } }, orderBy: { legacyId: "asc" } }),
    prisma.offre.findMany({ where: { legacyId: { not: null } }, orderBy: { legacyId: "asc" } }),
    prisma.commande.findMany({ where: { legacyId: { not: null } }, orderBy: { legacyId: "asc" } }),
    prisma.facture.findMany({ where: { legacyId: { not: null } }, orderBy: { legacyId: "asc" } }),
    prisma.avoir.findMany({ where: { legacyId: { not: null } }, orderBy: { legacyId: "asc" } }),
    prisma.crmTask.findMany({ where: { legacyId: { not: null } }, orderBy: { legacyId: "asc" } }),
    prisma.crmNotification.findMany({ where: { legacyId: { not: null } }, orderBy: { legacyId: "asc" } }),
    prisma.clientPortalMessage.findMany({ where: { legacyId: { not: null } }, orderBy: { legacyId: "asc" } }),
    prisma.clientPortalDocument.findMany({ where: { legacyId: { not: null } }, orderBy: { legacyId: "asc" } }),
    prisma.clientPortalNotification.findMany({ where: { legacyId: { not: null } }, orderBy: { legacyId: "asc" } }),
    prisma.clientContrat.findMany({ where: { legacyId: { not: null } }, orderBy: { legacyId: "asc" } }),
    prisma.clientIntervention.findMany({ where: { legacyId: { not: null } }, orderBy: { legacyId: "asc" } }),
    prisma.clientAlertesConfig.findMany(),
    prisma.mmsRapport.findMany({ where: { legacyId: { not: null } }, orderBy: { legacyId: "asc" } }),
    prisma.pendingQuontoTransaction.findMany({ where: { legacyId: { not: null } }, orderBy: { legacyId: "asc" } }),
    prisma.auditLog.findMany({ where: { legacyId: { not: null } }, orderBy: { legacyId: "asc" } }),
    prisma.historiqueAnnulation.findMany({ where: { legacyId: { not: null } }, orderBy: { legacyId: "asc" } }),
  ]);

  if (dbUsers.length === 0) return false;

  // Remplir les tableaux du store
  users.length = 0;
  dbUsers.forEach((u) => users.push({
    id: u.legacyId!, email: u.email, passwordHash: u.passwordHash ?? "",
    role: u.role, prenom: u.prenom, nom: u.nom, telephone: u.telephone,
    avatarDataUrl: u.avatarDataUrl, agenceId: u.agenceId,
  } as UserRow));

  clients.length = 0;
  dbClients.forEach((c) => clients.push({
    id: c.legacyId!, raisonSociale: c.raisonSociale, entite: c.entite ?? "",
    email: c.email ?? "", telephone: c.telephone ?? "",
    createdAtIso: c.createdAt.toISOString(),
    statut: (c.statut as "ACTIF" | "ANNULE" | "ARCHIVE") ?? "ACTIF",
    cancelledAt: c.cancelledAt?.toISOString() ?? null,
    cancellationReason: c.cancellationReason ?? null,
    siret: c.siret ?? null, codePostal: c.codePostal ?? null,
    responsableEmail: c.responsableEmail ?? null,
  } as ClientRow));

  contacts.length = 0;
  dbContacts.forEach((c) => contacts.push({
    id: c.legacyId!, civilite: c.civilite ?? "", nom: c.nom, prenom: c.prenom,
    entreprise: c.entreprise ?? "", fonction: c.fonction ?? "",
    email: c.email ?? "", telephone: c.telephone ?? "", mobile: c.mobile ?? "",
    ownerUserId: c.ownerUserId ?? null, clientPasswordHash: c.clientPasswordHash ?? null,
    statut: (c.statut as "ACTIF" | "ANNULE" | "ARCHIVE") ?? "ACTIF",
    cancelledAt: c.cancelledAt?.toISOString() ?? null,
    cancellationReason: c.cancellationReason ?? null,
  } as ContactRow));

  ascensoristes.length = 0;
  dbAscensoristes.forEach((a) => ascensoristes.push({
    id: a.legacyId!, entreprise: a.entreprise, nom: a.nom, prenom: a.prenom,
    email: a.email, telephone: a.telephone ?? null,
    ascensoristePasswordHash: a.ascensoristePasswordHash ?? null,
    statut: (a.statut as "ACTIF" | "ARCHIVE") ?? "ACTIF",
    createdAt: a.createdAt.toISOString(),
  } as AscensoristeRow));

  sites.length = 0;
  dbSites.forEach((s) => sites.push({
    id: s.legacyId!, nom: s.nom, typeSite: s.typeSite ?? "",
    clientNom: s.clientNom ?? "", statut: (s.statut as "ACTIF" | "ARCHIVE") ?? "ACTIF",
    imageDataUrl: s.imageDataUrl ?? null,
  } as SiteRow));

  siteGestionnaires.length = 0;
  dbSiteGestionnaires.forEach((g) => siteGestionnaires.push({
    id: g.legacyId!, siteId: findLegacyId(dbSites, g.siteId),
    clientNom: g.clientNom ?? "",
    isPrincipal: g.isPrincipal,
    dateDebut: g.dateDebut?.toISOString().slice(0, 10) ?? "",
    dateFin: g.dateFin?.toISOString().slice(0, 10) ?? null,
    notes: g.notes ?? null,
  } as SiteGestionnaireRow));

  siteEquipements.length = 0;
  dbEquipements.forEach((e) => siteEquipements.push({
    id: e.legacyId!, siteId: findLegacyId(dbSites, e.siteId),
    type: e.type as any, marque: e.marque ?? "", modele: e.modele ?? "",
    numeroSerie: e.numeroSerie ?? "", anneeInstallation: e.anneeInstallation ?? null,
    capaciteKg: e.capaciteKg ?? null, etages: e.etages ?? null,
    statut: (e.statut as "ACTIF" | "HORS_SERVICE" | "RETIRE") ?? "ACTIF",
    notes: e.notes ?? null, createdAt: e.createdAt.toISOString(),
  } as SiteEquipementRow));

  siteArborescenceNodes.length = 0;
  dbNodes.forEach((n) => siteArborescenceNodes.push({
    id: n.legacyId!, siteId: findLegacyId(dbSites, n.siteId),
    parentId: n.legacyParentId ?? null,
    nodeType: n.nodeType as "FOLDER" | "FILE", nom: n.nom,
    sortOrder: n.sortOrder, storedPath: n.storedPath ?? null,
    contentType: n.contentType ?? null,
    sizeBytes: n.sizeBytes != null ? Number(n.sizeBytes) : null,
    uploadedByUserId: n.uploadedByUserId ?? null,
    createdAt: n.createdAt.toISOString(),
  } as SiteArborescenceNodeRow));

  offres.length = 0;
  dbOffres.forEach((o) => offres.push({
    id: o.legacyId!, numeroOffre: o.numeroOffre, typeMission: o.typeMission,
    typeMissionsJson: o.typeMissionsJson ?? null,
    statut: o.statut, montantHt: Number(o.montantHt),
    dateOffre: o.dateOffre?.toISOString().slice(0, 10) ?? null,
    clientNom: o.clientNom ?? "", siteNom: o.siteNom ?? "",
    phasesMode: (o.phasesMode as "ALL" | "SELECTION" | "CUSTOM" | undefined) ?? undefined,
    phasesLinesJson: o.phasesLinesJson ?? null,
    tauxTva: o.tauxTva != null ? Number(o.tauxTva) : undefined,
    consultantEmail: o.consultantEmail ?? null,
    gestionnaireNom: o.gestionnaireNom ?? null,
    gestionnaireContact: o.gestionnaireContact ?? null,
    gestionnaireEmail: o.gestionnaireEmail ?? null,
    clientDecisionJson: o.clientDecisionJson ?? null,
    missionsJson: o.missionsJson ?? null,
  } as OffreRow));

  commandes.length = 0;
  dbCommandes.forEach((c) => commandes.push({
    id: c.legacyId!, numeroCommande: c.numeroCommande,
    dateCommande: c.dateCommande?.toISOString().slice(0, 10) ?? null,
    montantHt: Number(c.montantHt), montantFacture: Number(c.montantFacture),
    typeMission: c.typeMission, typeMissionsJson: c.typeMissionsJson ?? null,
    statut: c.statut ?? null,
    siteNom: c.siteNom ?? "", clientNom: c.clientNom ?? "",
    numeroClient: c.numeroClient ?? null,
  } as CommandeRow));

  factures.length = 0;
  dbFactures.forEach((f) => {
    const cmd = dbCommandes.find((c) => c.id === f.commandeId);
    factures.push({
      id: f.legacyId!, numeroFacture: f.numeroFacture,
      dateFacture: f.dateFacture?.toISOString().slice(0, 10) ?? null,
      numeroCommande: f.numeroCommandeDisplay ?? cmd?.numeroCommande ?? "",
      clientNom: f.clientNom ?? "",
      montantHt: Number(f.montantHt), frais: Number(f.frais),
      modeReglement: f.modeReglement,
      numeroCommandeClient: f.numeroCommandeClient ?? null,
      dateEcheance: f.dateEcheance?.toISOString().slice(0, 10) ?? null,
      statutPaiement: f.statutPaiement as any,
      montantPaye: Number(f.montantPaye),
      niveauRelance: f.niveauRelance,
      derniereRelanceAt: f.derniereRelanceAt?.toISOString() ?? null,
      commandeId: cmd?.legacyId ?? 0,
      statutFacturation: (f.statutFacturation as any) ?? undefined,
    } as FactureRow);
  });

  avoirs.length = 0;
  dbAvoirs.forEach((a) => {
    const facture = dbFactures.find((f) => f.id === a.factureOrigineId);
    const cmd     = dbCommandes.find((c) => c.id === a.commandeId);
    avoirs.push({
      id: a.legacyId!, numero: a.numero,
      factureOrigineId: facture?.legacyId ?? 0,
      commandeId: cmd?.legacyId ?? 0,
      motif: a.motif, montantHt: Number(a.montantHt),
      tauxTva: Number(a.tauxTva), montantTtc: Number(a.montantTtc),
      createdAt: a.createdAt.toISOString(),
    } as AvoirRow);
  });

  crmTasks.length = 0;
  dbCrmTasks.forEach((t) => {
    const u = dbUsers.find((u) => u.id === t.userId);
    crmTasks.push({
      id: t.legacyId!, userId: u?.legacyId ?? 0, title: t.title,
      dueDate: t.dueDate?.toISOString().slice(0, 10) ?? null,
      dueHour: t.dueHour ?? null, dueMinute: t.dueMinute ?? null,
      done: t.done, entityType: t.entityType ?? null, entityId: t.entityId ?? null,
      createdAt: t.createdAt.toISOString(),
    } as CrmTaskRow);
  });

  crmNotifications.length = 0;
  dbCrmNotifications.forEach((n) => {
    const u = dbUsers.find((u) => u.id === n.userId);
    crmNotifications.push({
      id: n.legacyId!, userId: u?.legacyId ?? 0, kind: n.kind as any,
      title: n.title, message: n.message, href: n.href ?? null,
      entityType: n.entityType ?? null, entityId: n.entityId ?? null,
      read: n.read, createdAt: n.createdAt.toISOString(), source: n.source as any ?? "seed",
    } as CrmNotificationRow);
  });

  clientMessages.length = 0;
  dbMessages.forEach((m) => clientMessages.push({
    id: m.legacyId!, threadId: m.threadId, entreprise: m.entreprise,
    subject: m.subject, body: m.body, senderType: m.senderType as any,
    senderName: m.senderName ?? "", senderEmail: m.senderEmail ?? "",
    createdAt: m.createdAt.toISOString(), readByClient: m.readByClient, readByCrm: m.readByCrm,
  } as ClientMessageRow));

  clientDocuments.length = 0;
  dbDocs.forEach((d) => {
    const contact  = dbContacts.find((c) => c.id === d.contactId);
    const site     = dbSites.find((s) => s.id === d.siteId);
    const offre    = dbOffres.find((o) => o.id === d.offreId);
    const commande = dbCommandes.find((c) => c.id === d.commandeId);
    clientDocuments.push({
      id: d.legacyId!, entreprise: d.entreprise,
      contactId: contact?.legacyId ?? 0, siteId: site?.legacyId ?? null,
      nom: d.nom, type: d.type as any, fileName: d.fileName,
      storedPath: d.storedPath ?? "", sizeBytes: d.sizeBytes != null ? Number(d.sizeBytes) : 0,
      contentType: d.contentType ?? "", uploadedAt: d.uploadedAt.toISOString(),
      statut: d.statut as any,
      motifRejet: d.motifRejet ?? null,
      validatedAt: d.validatedAt?.toISOString() ?? null,
      offreId: offre?.legacyId ?? null, commandeId: commande?.legacyId ?? null,
      notes: d.notes ?? null,
    } as ClientDocumentRow);
  });

  clientNotifications.length = 0;
  dbNotifs.forEach((n) => clientNotifications.push({
    id: n.legacyId!, entreprise: n.entreprise, title: n.title,
    message: n.message, kind: n.kind as any, href: n.href ?? null,
    read: n.read, createdAt: n.createdAt.toISOString(),
  } as ClientNotificationRow));

  clientContrats.length = 0;
  dbContrats.forEach((c) => {
    const site = dbSites.find((s) => s.id === c.siteId);
    clientContrats.push({
      id: c.legacyId!, entreprise: c.entreprise, reference: c.reference,
      intitule: c.intitule, siteId: site?.legacyId ?? null, siteNom: c.siteNom ?? "",
      typeContrat: c.typeContrat ?? "", dateDebut: c.dateDebut.toISOString().slice(0, 10),
      dateFin: c.dateFin.toISOString().slice(0, 10),
      montantAnnuelHt: c.montantAnnuelHt != null ? Number(c.montantAnnuelHt) : 0,
      prestataire: c.prestataire ?? "", statut: c.statut as any,
      conditionsRenouvellement: c.conditionsRenouvellement ?? null,
      clauseRevisionTarifaire: c.clauseRevisionTarifaire ?? null,
      avenantsJson: c.avenantsJson ?? null,
      demandeRenouvellementAt: c.demandeRenouvellementAt?.toISOString() ?? null,
    } as ClientContratRow);
  });

  clientInterventions.length = 0;
  dbInterventions.forEach((i) => {
    const site    = dbSites.find((s) => s.id === i.siteId);
    const equip   = dbEquipements.find((e) => e.id === i.equipementId);
    const contact = dbContacts.find((c) => c.id === i.declaredByContactId);
    clientInterventions.push({
      id: i.legacyId!, entreprise: i.entreprise, reference: i.reference,
      siteId: site?.legacyId ?? null, siteNom: i.siteNom ?? "",
      equipementId: equip?.legacyId ?? null, equipementLibelle: i.equipementLibelle ?? null,
      type: i.type as any, priorite: i.priorite as any, statut: i.statut as any,
      description: i.description, prestataire: i.prestataire ?? null,
      declaredAt: i.declaredAt.toISOString(),
      assignedAt: i.assignedAt?.toISOString() ?? null,
      resolvedAt: i.resolvedAt?.toISOString() ?? null,
      compteRendu: i.compteRendu ?? null,
      declaredByContactId: contact?.legacyId ?? 0,
      declaredByName: i.declaredByName ?? "",
    } as ClientInterventionRow);
  });

  clientAlertesConfigs.length = 0;
  dbAlertes.forEach((cfg) => clientAlertesConfigs.push({
    entreprise: cfg.entreprise,
    factureImpayee: cfg.factureImpayee,
    factureImpayeeDelaiJours: cfg.factureImpayeeDelaiJours,
    contratExpirant: cfg.contratExpirant,
    panneSignalee: cfg.panneSignalee,
    mmsSousSeuilCritique: cfg.mmsSousSeuil,
    mmsSeuil: Number(cfg.mmsSeuil),
    offreExpirant: cfg.offreExpirant,
    visiteReglementaire: cfg.visiteReglementaire,
    updatedAt: cfg.updatedAt.toISOString(),
  } as ClientAlertesConfig));

  mmsRapports.length = 0;
  dbMms.forEach((r) => {
    const user = dbUsers.find((u) => u.id === r.createdByUserId);
    const site = dbSites.find((s) => s.id === r.siteId);
    mmsRapports.push({
      id: r.legacyId!, prestataire: r.prestataire, client: r.client,
      trimestre: r.trimestre, annee: r.annee,
      createdAt: r.createdAt.toISOString(), createdByUserId: user?.legacyId ?? 0,
      nbAppareils: r.nbAppareils, nbInterventions: r.nbInterventions,
      nbPannes: r.nbPannes, nbVisites: r.nbVisites, penaliteTotale: Number(r.penaliteTotale),
      excelNom: r.excelNom ?? "", wordNom: r.wordNom ?? "", pdfNom: r.pdfNom ?? null,
      excelPath: r.excelMinioKey ?? "", wordPath: r.wordMinioKey ?? "", pdfPath: r.pdfMinioKey ?? null,
      excelSizeBytes: r.excelSizeBytes != null ? Number(r.excelSizeBytes) : 0,
      wordSizeBytes: r.wordSizeBytes != null ? Number(r.wordSizeBytes) : 0,
      pdfSizeBytes: r.pdfSizeBytes != null ? Number(r.pdfSizeBytes) : null,
      siteId: site?.legacyId ?? null,
    } as MmsRapportRow);
  });

  pendingQuonto.length = 0;
  dbPendingQ.forEach((q) => pendingQuonto.push({
    id: q.legacyId!, libelle: q.libelle, montant: Number(q.montant),
    dateOperation: q.dateOperation.toISOString().slice(0, 10),
    score: Number(q.score), quontoTransactionId: q.quontoTransactionId,
  } as PendingQuontoTx));

  auditLog.length = 0;
  dbAudit.forEach((a) => auditLog.push({
    id: a.legacyId!, entity_type: a.entityType, entity_id: a.entityId ?? 0,
    action: a.action, changes: (a.changes as any) ?? null,
    performed_by: a.performedBy ?? "", performed_at: a.performedAt.toISOString(),
    ip_address: a.ipAddress ?? null, user_agent: a.userAgent ?? null,
  } as AuditLogRow));

  historiqueAnnulations.length = 0;
  dbHistorique.forEach((h) => historiqueAnnulations.push({
    id: h.legacyId!, entityType: h.entityType, entityId: h.entityId,
    reference: h.reference, motif: h.motif, commentaire: h.commentaire ?? null,
    montantHt: h.montantHt != null ? Number(h.montantHt) : 0,
    clientNom: h.clientNom ?? "", cancelledAt: h.cancelledAt.toISOString(),
  } as HistoryAnnulationRow));

  return true;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveClientByNom(nom: string | null | undefined): string | undefined {
  if (!nom) return undefined;
  const found = [...clMap.entries()].find(([legacyId]) => {
    const cl = clients.find((c) => c.id === legacyId);
    return cl?.raisonSociale === nom;
  });
  return found?.[1];
}

function resolveSiteByNom(nom: string | null | undefined): string | undefined {
  if (!nom) return undefined;
  const found = [...sMap.entries()].find(([legacyId]) => {
    const s = sites.find((s) => s.id === legacyId);
    return s?.nom === nom;
  });
  return found?.[1];
}

function findLegacyId<T extends { id: string; legacyId: number | null }>(
  rows: T[],
  uuid: string,
): number {
  return rows.find((r) => r.id === uuid)?.legacyId ?? 0;
}

function mapStatutPaiement(s: string): "NON_PAYE" | "PARTIELLEMENT_PAYE" | "PAYE" | "EN_RETARD" {
  const valid = ["NON_PAYE", "PARTIELLEMENT_PAYE", "PAYE", "EN_RETARD"];
  return valid.includes(s) ? (s as any) : "NON_PAYE";
}
