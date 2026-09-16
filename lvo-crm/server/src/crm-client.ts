/**
 * Seam entre l'app actuelle (site public + portails client/ascensoriste/exploitation)
 * et les données "CRM" (offres, commandes, factures, sites, contacts, documents, messages...).
 *
 * Aujourd'hui ces fonctions lisent/écrivent encore les tableaux en mémoire de store.ts —
 * comportement strictement identique à avant. Une fois le service CRM séparé (Phase 2/3 de
 * la migration), chaque fonction ci-dessous sera remplacée par un appel HTTP vers l'API du
 * nouveau service CRM, sans avoir à retoucher les routes qui les appellent.
 */
import {
  offres,
  commandes,
  factures,
  sites,
  siteEquipements,
  contacts,
  ascensoristes,
  users,
  clientMessages,
  clientDocuments,
  clientNotifications,
  crmNotifications,
  type OffreRow,
  type CommandeRow,
  type FactureRow,
  type SiteRow,
  type SiteEquipementRow,
  type ContactRow,
  type AscensoristeRow,
  type UserRow,
  type ClientMessageRow,
  type ClientDocumentRow,
  type ClientNotificationRow,
  type CrmNotificationRow,
} from "./store.js";

function nextId<T extends { id: number }>(rows: T[]): number {
  return Math.max(0, ...rows.map((r) => r.id), 0) + 1;
}

// ── Identité / auth (Contact, Ascensoriste, User) ──────────────────────────────
export function findActiveContactByEmail(email: string): ContactRow | undefined {
  return contacts.find((c) => c.email.toLowerCase() === email && c.statut === "ACTIF");
}
export function findActiveContactById(id: number): ContactRow | undefined {
  return contacts.find((c) => c.id === id && c.statut === "ACTIF");
}
export function findActiveAscensoristeByEmail(email: string): AscensoristeRow | undefined {
  return ascensoristes.find((a) => a.email.toLowerCase() === email && a.statut === "ACTIF");
}
export function findActiveAscensoristeById(id: number): AscensoristeRow | undefined {
  return ascensoristes.find((a) => a.id === id && a.statut === "ACTIF");
}
export function findUserByEmail(email: string): UserRow | undefined {
  return users.find((u) => u.email.toLowerCase() === email);
}
export function findUserById(id: number): UserRow | undefined {
  return users.find((u) => u.id === id);
}
export function findUserByExactEmail(email: string): UserRow | undefined {
  return users.find((u) => u.email === email);
}
export function getCrmStaffUsers(): UserRow[] {
  return users.filter((u) => u.role === "ADMIN" || u.role === "MANAGER");
}

// ── Sites & équipements ─────────────────────────────────────────────────────
export function getSitesForClient(entreprise: string): SiteRow[] {
  return sites.filter((s) => s.clientNom === entreprise && s.statut !== "ARCHIVE");
}
export function findActiveClientSite(id: number, entreprise: string): SiteRow | undefined {
  return sites.find((s) => s.id === id && s.clientNom === entreprise && s.statut !== "ARCHIVE");
}
export function findClientSite(id: number, entreprise: string): SiteRow | undefined {
  return sites.find((s) => s.id === id && s.clientNom === entreprise);
}
export function setClientSiteImage(id: number, entreprise: string, dataUrl: string | null): boolean {
  const site = findClientSite(id, entreprise);
  if (!site) return false;
  site.imageDataUrl = dataUrl;
  return true;
}
export function getSiteEquipementsForSite(siteId: number): SiteEquipementRow[] {
  return siteEquipements.filter((e) => e.siteId === siteId);
}
export function findSiteEquipementById(id: number): SiteEquipementRow | undefined {
  return siteEquipements.find((e) => e.id === id);
}
export function getActiveSiteEquipementsForSites(siteIds: Set<number>): SiteEquipementRow[] {
  return siteEquipements.filter((e) => siteIds.has(e.siteId) && e.statut !== "RETIRE");
}

// ── Offres / commandes / factures ───────────────────────────────────────────
export function getOffresForClient(entreprise: string): OffreRow[] {
  return offres.filter((o) => o.clientNom === entreprise);
}
export function findClientOffre(id: number, entreprise: string): OffreRow | undefined {
  return offres.find((o) => o.id === id && o.clientNom === entreprise);
}
export function getCommandesForClient(entreprise: string): CommandeRow[] {
  return commandes.filter((c) => c.clientNom === entreprise);
}
export function getFacturesForClient(entreprise: string): FactureRow[] {
  return factures.filter((f) => f.clientNom === entreprise);
}

// ── Messagerie client <-> CRM (ClientPortalMessage) ─────────────────────────
export function getMessageThreadsForClient(entreprise: string) {
  const msgs = clientMessages
    .filter((m) => m.entreprise === entreprise)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return groupThreads(msgs);
}
export function getAllMessageThreads() {
  const msgs = [...clientMessages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return groupThreads(msgs);
}
function groupThreads(msgs: ClientMessageRow[]) {
  const threads = new Map<string, ClientMessageRow[]>();
  for (const m of msgs) {
    const list = threads.get(m.threadId) ?? [];
    list.push(m);
    threads.set(m.threadId, list);
  }
  return [...threads.entries()].map(([threadId, messages]) => ({ threadId, messages }));
}
export function findThreadMessages(threadId: string): ClientMessageRow[] {
  return clientMessages.filter((m) => m.threadId === threadId);
}
export function findThreadSubject(threadId: string): string | undefined {
  return clientMessages.find((m) => m.threadId === threadId)?.subject;
}
export function addClientMessage(msg: ClientMessageRow): void {
  clientMessages.push(msg);
}
export function markThreadReadByClient(threadId: string, entreprise: string): void {
  for (const m of clientMessages) {
    if (m.threadId === threadId && m.entreprise === entreprise && m.senderType === "CRM") m.readByClient = true;
  }
}
export function markThreadReadByCrm(threadId: string): void {
  for (const m of clientMessages) {
    if (m.threadId === threadId && m.senderType === "CLIENT") m.readByCrm = true;
  }
}
export function nextClientMessageId(): number {
  return nextId(clientMessages);
}

// ── Documents client (ClientPortalDocument) ─────────────────────────────────
export function getClientDocuments(entreprise: string, siteId?: number | null): ClientDocumentRow[] {
  let list = clientDocuments.filter((d) => d.entreprise === entreprise);
  if (siteId != null && Number.isFinite(siteId)) list = list.filter((d) => d.siteId === siteId);
  return list;
}
export function getAllClientDocuments(filter?: { entreprise?: string; type?: string }): ClientDocumentRow[] {
  let list = [...clientDocuments];
  if (filter?.entreprise) list = list.filter((d) => d.entreprise === filter.entreprise);
  if (filter?.type) list = list.filter((d) => d.type === filter.type);
  return list;
}
export function findClientDocument(id: number, entreprise?: string): ClientDocumentRow | undefined {
  return clientDocuments.find((d) => d.id === id && (entreprise == null || d.entreprise === entreprise));
}
export function addClientDocument(doc: ClientDocumentRow): void {
  clientDocuments.push(doc);
}
export function removeClientDocument(id: number, entreprise?: string): ClientDocumentRow | undefined {
  const idx = clientDocuments.findIndex((d) => d.id === id && (entreprise == null || d.entreprise === entreprise));
  if (idx === -1) return undefined;
  const [doc] = clientDocuments.splice(idx, 1);
  return doc;
}
export function validateClientDocument(id: number): ClientDocumentRow | undefined {
  const doc = clientDocuments.find((d) => d.id === id);
  if (!doc) return undefined;
  doc.statut = "VALIDE";
  doc.motifRejet = null;
  doc.validatedAt = new Date().toISOString();
  return doc;
}
export function rejectClientDocument(id: number, motif: string | null): ClientDocumentRow | undefined {
  const doc = clientDocuments.find((d) => d.id === id);
  if (!doc) return undefined;
  doc.statut = "REJETE";
  doc.motifRejet = motif;
  doc.validatedAt = null;
  return doc;
}
export function nextClientDocumentId(): number {
  return nextId(clientDocuments);
}

// ── Notifications client (ClientPortalNotification) ─────────────────────────
export function getClientNotifications(entreprise: string): { notifications: ClientNotificationRow[]; unreadCount: number } {
  const notifs = clientNotifications
    .filter((n) => n.entreprise === entreprise)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 50);
  return { notifications: notifs, unreadCount: notifs.filter((n) => !n.read).length };
}
export function markClientNotificationRead(id: number, entreprise: string): void {
  const n = clientNotifications.find((n) => n.id === id && n.entreprise === entreprise);
  if (n) n.read = true;
}
export function markAllClientNotificationsRead(entreprise: string): void {
  for (const n of clientNotifications) if (n.entreprise === entreprise) n.read = true;
}
export function pushClientNotification(notif: Omit<ClientNotificationRow, "id" | "createdAt"> & { createdAt?: string }): ClientNotificationRow {
  const row = { id: nextId(clientNotifications), createdAt: notif.createdAt ?? new Date().toISOString(), ...notif } as ClientNotificationRow;
  clientNotifications.push(row);
  return row;
}

// ── Notifications CRM (CrmNotification) — écrites depuis des routes portail ─
export function pushCrmNotification(notif: Omit<CrmNotificationRow, "id" | "createdAt"> & { createdAt?: string }): CrmNotificationRow {
  const row = { id: nextId(crmNotifications), createdAt: notif.createdAt ?? new Date().toISOString(), ...notif } as CrmNotificationRow;
  crmNotifications.push(row);
  return row;
}
