import fs from "node:fs";

import express from "express";
import multer from "multer";

import type { AuthedRequest } from "../middleware.js";
import { requireRoles } from "../middleware.js";
import {
  appendAuditLog,
  auditLog,
  avoirs,
  clients,
  commandes,
  contacts,
  crmAppSettings,
  factures,
  fichierVersions,
  historiqueAnnulations,
  isClientDomTom,
  nextAvoirNumero,
  offreSignatures,
  offres,
  PHASES_REFERENTIEL,
  pushDocumentVersion,
  siteGestionnaires,
  sites,
  crmTasks,
  crmNotifications,
  refreshUserNotifications,
  siteEquipements,
  userProfileDto,
  users,
} from "../store.js";
import {
  buildArborescenceTree,
  deleteArborescenceFile,
  ensureSiteArborescence,
  findArborescenceNode,
  listArborescenceChildren,
  provisionSiteArborescence,
  saveUploadedFile,
} from "../site-arborescence.js";
import type { EquipementType } from "../store.js";
import type { ClientRow, CommandeRow, ContactRow, OffreRow, SiteRow } from "../store.js";

const arborescenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

function pdfStubLines(lines: string[]): Buffer {
  const body = ["%% LVO PDF stub (démo)", ...lines].join("\n");
  return Buffer.from(`%PDF-1.4\n%âãÏÓ\n1 0 obj<<>>endobj\ntrailer<<>>\n${body}\n`);
}

function jsonOrNull(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() ? v : null;
  try {
    return JSON.stringify(v);
  } catch {
    return null;
  }
}

function findById<T extends { id: number }>(arr: T[], id: number) {
  return arr.find((x) => x.id === id);
}

function forbidViewer(req: AuthedRequest, res: express.Response): boolean {
  const r = req.auth?.role;
  if (!r || r === "VIEWER") {
    res.status(403).json({ error: "Rôle VIEWER : lecture seule" });
    return true;
  }
  return false;
}

function auditMeta(req: AuthedRequest) {
  return {
    performed_by: req.auth?.email ?? "—",
    ip_address: (req.ip as string | undefined) ?? null,
    user_agent: typeof req.get === "function" ? req.get("user-agent") : null,
  };
}

function diffSnapshot(before: Record<string, unknown>, after: Record<string, unknown>) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (before[k] !== after[k]) out[k] = { before: before[k], after: after[k] };
  }
  return Object.keys(out).length ? out : null;
}

function contactEmailTaken(email: string, exceptId: number): boolean {
  const e = email.trim().toLowerCase();
  return contacts.some(
    (c) => c.id !== exceptId && c.statut === "ACTIF" && c.email.trim().toLowerCase() === e,
  );
}

function clientEmailTaken(email: string, exceptId: number): boolean {
  const e = email.trim().toLowerCase();
  return clients.some(
    (c) => c.id !== exceptId && c.statut === "ACTIF" && c.email.trim().toLowerCase() === e,
  );
}

function activeCommandesForEntreprise(entreprise: string) {
  return commandes.filter((c) => !c.numeroCommande.startsWith("X-") && c.clientNom === entreprise).length;
}

function siteDeleteBlockReason(siteNom: string): { msg: string } | null {
  const off = offres.some((o) => o.siteNom === siteNom && !String(o.statut).toUpperCase().includes("ANNUL"));
  if (off) return { msg: "Une offre active ou en cours est liée à ce site. Annulez ou finalisez l’offre d’abord." };
  const cmd = commandes.some((c) => !c.numeroCommande.startsWith("X-") && c.siteNom === siteNom);
  if (cmd) return { msg: "Une commande active est liée à ce site. Annulez la commande ou changez de site." };
  return null;
}

function clientDeleteBlockReason(cl: (typeof clients)[0]): { msg: string } | null {
  const rs = cl.raisonSociale;
  const t = isoToday();
  if (siteGestionnaires.some((g) => g.clientNom === rs && (!g.dateFin || g.dateFin >= t))) {
    return { msg: "Client encore gestionnaire actif d’au moins un site (Phase 6)." };
  }
  if (commandes.some((c) => !c.numeroCommande.startsWith("X-") && c.clientNom === rs)) {
    return { msg: "Commandes actives pour ce client." };
  }
  if (factures.some((f) => f.clientNom === rs)) {
    return { msg: "Factures existantes pour ce client." };
  }
  if (sites.some((s) => (s.statut ?? "ACTIF") !== "ARCHIVE" && s.clientNom === rs)) {
    return { msg: "Sites encore rattachés à ce client." };
  }
  return null;
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseEcheancierFacturationJson(raw: string | null | undefined): Array<{
  libelle?: string;
  pourcentage?: number;
  moisFacturation?: string;
}> {
  if (!raw || !String(raw).trim()) return [];
  try {
    const j = JSON.parse(raw) as unknown;
    return Array.isArray(j) ? (j as Array<{ libelle?: string; pourcentage?: number; moisFacturation?: string }>) : [];
  } catch {
    return [];
  }
}

const KNOWN_MISSION_TYPES = ["A", "ADC", "MOE", "ET", "MCM", "MCN", "MM", "MS"] as const;

const COMMANDE_STATUTS = new Set([
  "EN_ATTENTE",
  "SIGNATURE",
  "EN_COURS",
  "LIVRE",
  "FACTURE_PARTIELLE",
  "FACTUREE",
  "CLOTUREE",
  "ANNULEE",
]);

function normalizeCommandeStatut(raw: string): string {
  const u = raw.trim().toUpperCase();
  return COMMANDE_STATUTS.has(u) ? u : "EN_ATTENTE";
}

function primaryMissionFromSelection(codes: string[]): string {
  const set = new Set(codes.map((c) => c.toUpperCase()));
  for (const t of KNOWN_MISSION_TYPES) {
    if (set.has(t)) return t;
  }
  return codes[0]?.toUpperCase() || "MS";
}

function parseTypeMissionsJson(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const j = JSON.parse(raw) as unknown;
    if (!Array.isArray(j)) return [];
    return [...new Set(j.map((x) => String(x).toUpperCase()).filter(Boolean))];
  } catch {
    return [];
  }
}

function missionFamilyFromPhaseCode(code: string): string | null {
  const c = String(code || "").trim().toUpperCase();
  if (!c) return null;
  for (const tm of KNOWN_MISSION_TYPES) {
    if (c === tm || c.startsWith(`${tm}-`)) return tm;
  }
  return null;
}

function commandeMissionCodes(c: Pick<CommandeRow, "typeMission" | "typeMissionsJson">): string[] {
  const fromJson = parseTypeMissionsJson(c.typeMissionsJson ?? null);
  if (fromJson.length) return fromJson;
  if (c.typeMission?.trim()) return [c.typeMission.trim().toUpperCase()];
  return [];
}

function offreTypeMissionCodes(o: Pick<OffreRow, "typeMission" | "typeMissionsJson">): string[] {
  const fromJson = parseTypeMissionsJson(o.typeMissionsJson ?? null);
  if (fromJson.length) return fromJson;
  if (o.typeMission?.trim()) return [o.typeMission.trim().toUpperCase()];
  return [];
}

function offreMissionCodes(o: OffreRow): Set<string> {
  const set = new Set<string>();
  for (const t of offreTypeMissionCodes(o)) set.add(t);
  try {
    const arr = o.missionsJson ? (JSON.parse(o.missionsJson) as { code?: string }[]) : [];
    if (Array.isArray(arr)) {
      for (const m of arr) {
        const mf = m?.code != null ? missionFamilyFromPhaseCode(String(m.code)) : null;
        if (mf) set.add(mf);
      }
    }
  } catch {
    /* ignore */
  }
  return set;
}

function commandePourOffre(o: OffreRow): CommandeRow | undefined {
  const oCodes = offreMissionCodes(o);
  return commandes.find((c) => {
    if (String(c.numeroCommande).startsWith("X-")) return false;
    if (c.clientNom !== o.clientNom || c.siteNom !== o.siteNom) return false;
    const cCodes = commandeMissionCodes(c);
    if (!cCodes.length) return false;
    return cCodes.some((code) => oCodes.has(code));
  });
}

/** Racine du n° offre sans suffixe de duplication (lettre A–Z après un chiffre) ni -COPY */
function rootOffreNumero(numero: string): string {
  const cleaned = numero.replace(/-COPY$/i, "").trim();
  const m = cleaned.match(/^(.+\d)([A-Z])$/);
  return m ? m[1]! : cleaned;
}

/** Prochain n° libre : racine + A, B, C… (ex. LVO-MS-26002 → LVO-MS-26002A puis …B) */
function nextOffreDuplicateNumero(sourceNumero: string): string {
  const root = rootOffreNumero(sourceNumero);
  const taken = new Set(offres.map((o) => o.numeroOffre.toUpperCase()));
  for (let i = 0; i < 26; i++) {
    const candidate = `${root}${String.fromCharCode(65 + i)}`;
    if (!taken.has(candidate.toUpperCase())) return candidate;
  }
  return `${root}-X${Date.now()}`;
}

function requireManagerOrAdmin(req: AuthedRequest, res: express.Response): boolean {
  const r = req.auth?.role;
  if (!r || (r !== "MANAGER" && r !== "ADMIN")) {
    res.status(403).json({ error: "Action réservée aux rôles MANAGER ou ADMIN." });
    return true;
  }
  return false;
}

function gestionnairesActifsRows(siteId: number) {
  const t = isoToday();
  return siteGestionnaires.filter((g) => g.siteId === siteId && (!g.dateFin || g.dateFin >= t));
}

function demoteSitePrincipals(siteId: number) {
  const t = isoToday();
  for (const g of siteGestionnaires) {
    if (g.siteId !== siteId) continue;
    if (!g.dateFin || g.dateFin >= t) {
      if (g.isPrincipal) {
        g.isPrincipal = false;
        g.dateFin = t;
      }
    }
  }
}

function activeGestionnairePair(siteId: number, clientNom: string): boolean {
  const t = isoToday();
  return siteGestionnaires.some(
    (g) => g.siteId === siteId && g.clientNom === clientNom && (!g.dateFin || g.dateFin >= t),
  );
}

export const crmRouter = express.Router();

function authUserId(req: AuthedRequest): number | null {
  const id = req.auth?.userId;
  return id == null ? null : Number(id);
}

function findUserByAuth(req: AuthedRequest) {
  const uid = authUserId(req);
  if (uid == null) return null;
  return users.find((u) => u.id === uid) ?? null;
}

function activitySummary(a: (typeof auditLog)[0]): string {
  return `${a.entity_type} #${a.entity_id} — ${a.action} (${a.performed_by || "—"})`;
}

crmRouter.get("/me", (req: AuthedRequest, res) => {
  const u = findUserByAuth(req);
  if (!u) {
    res.status(404).json({ error: "Utilisateur introuvable" });
    return;
  }
  res.json(userProfileDto(u));
});

crmRouter.patch("/me/profile", (req: AuthedRequest, res) => {
  if (forbidViewer(req, res)) return;
  const u = findUserByAuth(req);
  if (!u) {
    res.status(404).json({ error: "Utilisateur introuvable" });
    return;
  }
  const b = req.body as { prenom?: string; nom?: string; telephone?: string };
  if (b.prenom !== undefined) u.prenom = String(b.prenom).trim() || null;
  if (b.nom !== undefined) u.nom = String(b.nom).trim() || null;
  if (b.telephone !== undefined) u.telephone = String(b.telephone).trim() || null;
  res.json(userProfileDto(u));
});

crmRouter.post("/me/password", (req: AuthedRequest, res) => {
  if (forbidViewer(req, res)) return;
  res.json({ ok: true });
});

crmRouter.post("/me/avatar", (req: AuthedRequest, res) => {
  if (forbidViewer(req, res)) return;
  const u = findUserByAuth(req);
  if (!u) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  u.avatarDataUrl =
    "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect fill='%231A2B4C' width='64' height='64'/></svg>";
  res.json(userProfileDto(u));
});

crmRouter.delete("/me/avatar", (req: AuthedRequest, res) => {
  if (forbidViewer(req, res)) return;
  const u = findUserByAuth(req);
  if (!u) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  u.avatarDataUrl = null;
  res.json(userProfileDto(u));
});

crmRouter.get("/me/avatar", (req: AuthedRequest, res) => {
  const u = findUserByAuth(req);
  if (!u?.avatarDataUrl) {
    res.status(404).end();
    return;
  }
  res.redirect(u.avatarDataUrl);
});

crmRouter.get("/activity/recent", (req: AuthedRequest, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
  res.json(
    [...auditLog]
      .reverse()
      .slice(0, limit)
      .map((a) => ({
        id: a.id,
        entityType: a.entity_type,
        entityId: a.entity_id,
        action: a.action,
        performedBy: a.performed_by,
        performedAt: a.performed_at,
        summary: activitySummary(a),
      })),
  );
});

crmRouter.get("/notifications", (req: AuthedRequest, res) => {
  const uid = authUserId(req);
  if (uid == null) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  const role = req.auth?.role ?? "VIEWER";
  refreshUserNotifications(uid, role);
  const rows = crmNotifications
    .filter((n) => n.userId === uid)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unreadCount = rows.filter((n) => !n.read).length;
  res.json({ items: rows, unreadCount });
});

crmRouter.patch("/notifications/:id/read", (req: AuthedRequest, res) => {
  const uid = authUserId(req);
  if (uid == null) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  const id = Number(req.params.id);
  const n = crmNotifications.find((x) => x.id === id && x.userId === uid);
  if (!n) {
    res.status(404).json({ error: "Notification introuvable" });
    return;
  }
  n.read = true;
  res.json(n);
});

crmRouter.post("/notifications/read-all", (req: AuthedRequest, res) => {
  const uid = authUserId(req);
  if (uid == null) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  for (const n of crmNotifications) {
    if (n.userId === uid) n.read = true;
  }
  res.json({ ok: true });
});

function parseDueTime(
  dueHour: unknown,
  dueMinute: unknown,
): { dueHour: number | null; dueMinute: number | null } {
  if (dueHour == null && dueMinute == null) return { dueHour: null, dueMinute: null };
  const h = Number(dueHour);
  const m = Number(dueMinute);
  if (!Number.isInteger(h) || h < 0 || h > 23 || !Number.isInteger(m) || m < 0 || m > 59) {
    return { dueHour: null, dueMinute: null };
  }
  return { dueHour: h, dueMinute: m };
}

crmRouter.get("/tasks", (req: AuthedRequest, res) => {
  const uid = authUserId(req);
  if (uid == null) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  res.json(
    crmTasks
      .filter((t) => t.userId === uid)
      .sort((a, b) => Number(a.done) - Number(b.done) || b.createdAt.localeCompare(a.createdAt)),
  );
});

crmRouter.post("/tasks", (req: AuthedRequest, res) => {
  if (forbidViewer(req, res)) return;
  const uid = authUserId(req);
  if (uid == null) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  const b = req.body as {
    title?: string;
    dueDate?: string | null;
    dueHour?: number | null;
    dueMinute?: number | null;
  };
  const title = String(b.title || "").trim();
  if (!title) {
    res.status(400).json({ error: "title requis" });
    return;
  }
  const dueDate = b.dueDate ? String(b.dueDate).slice(0, 10) : null;
  const time = dueDate ? parseDueTime(b.dueHour, b.dueMinute) : { dueHour: null, dueMinute: null };
  const id = Math.max(0, ...crmTasks.map((t) => t.id)) + 1;
  const row = {
    id,
    userId: uid,
    title,
    dueDate,
    dueHour: time.dueHour,
    dueMinute: time.dueMinute,
    done: false,
    entityType: null,
    entityId: null,
    createdAt: new Date().toISOString(),
  };
  crmTasks.push(row);
  res.status(201).json(row);
});

crmRouter.patch("/tasks/:id", (req: AuthedRequest, res) => {
  if (forbidViewer(req, res)) return;
  const uid = authUserId(req);
  const id = Number(req.params.id);
  const t = crmTasks.find((x) => x.id === id && x.userId === uid);
  if (!t) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const b = req.body as {
    done?: boolean;
    title?: string;
    dueDate?: string | null;
    dueHour?: number | null;
    dueMinute?: number | null;
  };
  if (b.done !== undefined) t.done = Boolean(b.done);
  if (b.title !== undefined) t.title = String(b.title).trim() || t.title;
  if (b.dueDate !== undefined) {
    t.dueDate = b.dueDate ? String(b.dueDate).slice(0, 10) : null;
    if (!t.dueDate) {
      t.dueHour = null;
      t.dueMinute = null;
    }
  }
  if (b.dueHour !== undefined || b.dueMinute !== undefined) {
    const time = parseDueTime(
      b.dueHour !== undefined ? b.dueHour : t.dueHour,
      b.dueMinute !== undefined ? b.dueMinute : t.dueMinute,
    );
    t.dueHour = t.dueDate ? time.dueHour : null;
    t.dueMinute = t.dueDate ? time.dueMinute : null;
  }
  res.json(t);
});

crmRouter.delete("/tasks/:id", (req: AuthedRequest, res) => {
  if (forbidViewer(req, res)) return;
  const uid = authUserId(req);
  const id = Number(req.params.id);
  const idx = crmTasks.findIndex((x) => x.id === id && x.userId === uid);
  if (idx < 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  crmTasks.splice(idx, 1);
  res.status(204).end();
});

/** Réponses liste — champs attendus par le front */
crmRouter.get("/contacts", (_req, res) => {
  res.json(contacts.filter((c) => c.statut === "ACTIF"));
});

crmRouter.get("/clients", (_req, res) => {
  res.json(clients.filter((c) => c.statut === "ACTIF"));
});

function toSiteListDto(s: SiteRow) {
  const act = gestionnairesActifsRows(s.id);
  const principal = act.find((g) => g.isPrincipal);
  const gestionnairesActifsNoms = [...new Set(act.map((g) => g.clientNom))];
  const equipementsActifs = siteEquipements.filter((e) => e.siteId === s.id && e.statut !== "RETIRE").length;
  const owner = clients.find((c) => c.raisonSociale === s.clientNom && c.statut === "ACTIF");
  return {
    ...s,
    statut: s.statut ?? "ACTIF",
    clientEntite: owner?.entite ?? null,
    gestionnairePrincipal: principal?.clientNom ?? null,
    gestionnairesActifs: gestionnairesActifsNoms,
    equipementsCount: equipementsActifs,
  };
}

crmRouter.get("/sites", (_req, res) => {
  const list = sites.filter((s) => (s.statut ?? "ACTIF") !== "ARCHIVE");
  res.json(list.map(toSiteListDto));
});

crmRouter.get("/sites/meta/gestionnaires-filters", (_req, res) => {
  const t = isoToday();
  const noms = new Set<string>();
  for (const g of siteGestionnaires) {
    if (!g.dateFin || g.dateFin >= t) noms.add(g.clientNom);
  }
  res.json({ noms: [...noms].sort((a, b) => a.localeCompare(b, "fr")) });
});

function clientResponsableContact(raisonSociale: string): string | null {
  const cl = clients.find((c) => c.raisonSociale === raisonSociale && c.statut === "ACTIF");
  const r = cl?.responsableEmail?.trim();
  return r || null;
}

/** Destinataire offre + gestionnaire (syndic / prestataire / propriétaire — Phase 6) */
function offrePartiesForSite(siteId: number) {
  const site = findById(sites, siteId);
  if (!site) return null;
  const act = gestionnairesActifsRows(siteId);
  const principal = act.find((g) => g.isPrincipal);
  const defaultClientNom = principal?.clientNom ?? site.clientNom;
  const defaultGestionnaireNom = defaultClientNom;
  const defaultGestionnaireContact = clientResponsableContact(defaultGestionnaireNom);
  type Opt = { clientNom: string; label: string; role: string; responsableContact: string | null };
  const optMap = new Map<string, Opt>();
  optMap.set(site.clientNom, {
    clientNom: site.clientNom,
    label: `${site.clientNom} — Propriétaire`,
    role: "Propriétaire",
    responsableContact: clientResponsableContact(site.clientNom),
  });
  for (const g of act) {
    const role = g.isPrincipal ? "Gestionnaire principal" : "Gestionnaire (prestataire / syndic)";
    const existing = optMap.get(g.clientNom);
    if (!existing || g.isPrincipal) {
      optMap.set(g.clientNom, {
        clientNom: g.clientNom,
        label: `${g.clientNom} — ${role}`,
        role,
        responsableContact: clientResponsableContact(g.clientNom),
      });
    }
  }
  const options = [...optMap.values()].sort((a, b) => a.clientNom.localeCompare(b.clientNom, "fr"));
  return { defaultClientNom, defaultGestionnaireNom, defaultGestionnaireContact, options };
}

function gestionnaireLibelle(o: OffreRow): string {
  const nom = o.gestionnaireNom?.trim();
  const contact = o.gestionnaireContact?.trim();
  if (nom && contact) return `${nom} — ${contact}`;
  if (nom) return nom;
  if (contact) return contact;
  const legacy = o.gestionnaireEmail?.trim();
  return legacy || "—";
}

function assertGestionnaireOnSite(siteNom: string, gestionnaireNom: string): string | null {
  const site = sites.find((s) => s.nom === siteNom && (s.statut ?? "ACTIF") !== "ARCHIVE");
  if (!site) return null;
  const parties = offrePartiesForSite(site.id);
  if (!parties) return "Site introuvable.";
  if (!parties.options.some((o) => o.clientNom === gestionnaireNom)) {
    return "Gestionnaire non reconnu pour ce site (propriétaire ou gestionnaire actif Phase 6).";
  }
  return null;
}

crmRouter.get("/sites/:siteId/offre-destinataires", (req, res) => {
  const siteId = Number(req.params.siteId);
  const site = findById(sites, siteId);
  if (!site || (site.statut ?? "ACTIF") === "ARCHIVE") {
    res.status(404).json({ error: "Site introuvable" });
    return;
  }
  const data = offrePartiesForSite(siteId);
  if (!data) {
    res.status(404).json({ error: "Site introuvable" });
    return;
  }
  res.json(data);
});

crmRouter.get("/sites/:siteId/gestionnaires", (req, res) => {
  const siteId = Number(req.params.siteId);
  if (!findById(sites, siteId)) {
    res.status(404).json({ error: "Site introuvable" });
    return;
  }
  const rows = siteGestionnaires
    .filter((g) => g.siteId === siteId)
    .slice()
    .sort((a, b) => a.id - b.id);
  res.json(rows);
});

crmRouter.post("/sites/:siteId/gestionnaires", (req: AuthedRequest, res) => {
  if (forbidViewer(req, res)) return;
  const siteId = Number(req.params.siteId);
  const site = findById(sites, siteId);
  if (!site) {
    res.status(404).json({ error: "Site introuvable" });
    return;
  }
  const body = req.body as {
    clientNom?: string;
    isPrincipal?: boolean;
    dateDebut?: string;
    notes?: string | null;
  };
  const clientNom = String(body.clientNom || "").trim();
  if (!clientNom) {
    res.status(400).json({ error: "clientNom obligatoire" });
    return;
  }
  if (!clients.some((c) => c.raisonSociale === clientNom && c.statut === "ACTIF")) {
    res.status(400).json({ error: "Client inconnu ou inactif" });
    return;
  }
  if (activeGestionnairePair(siteId, clientNom)) {
    res.status(400).json({ error: "Ce client est déjà gestionnaire actif pour ce site." });
    return;
  }
  const isPrincipal = body.isPrincipal === true;
  if (isPrincipal) demoteSitePrincipals(siteId);
  const id = Math.max(0, ...siteGestionnaires.map((g) => g.id)) + 1;
  const row = {
    id,
    siteId,
    clientNom,
    isPrincipal,
    dateDebut: String(body.dateDebut || "").trim() || isoToday(),
    dateFin: null as string | null,
    notes: body.notes != null && String(body.notes).trim() ? String(body.notes).trim() : null,
  };
  siteGestionnaires.push(row);
  appendAuditLog({
    entity_type: "SITE_GESTIONNAIRE",
    entity_id: id,
    action: "CREATE",
    changes: { siteId, clientNom, isPrincipal },
    ...auditMeta(req),
  });
  res.status(201).json(row);
});

crmRouter.patch("/sites/:siteId/gestionnaires/:gestionnaireId", (req: AuthedRequest, res) => {
  if (forbidViewer(req, res)) return;
  const siteId = Number(req.params.siteId);
  const gid = Number(req.params.gestionnaireId);
  const g = siteGestionnaires.find((x) => x.id === gid && x.siteId === siteId);
  if (!g) {
    res.status(404).json({ error: "Lien site / gestionnaire introuvable" });
    return;
  }
  const body = req.body as { dateFin?: string | null; notes?: string | null; isPrincipal?: boolean };
  if (body.isPrincipal === true) {
    demoteSitePrincipals(siteId);
    g.isPrincipal = true;
    g.dateFin = null;
  }
  if (body.dateFin !== undefined) {
    g.dateFin = body.dateFin === null || body.dateFin === "" ? null : String(body.dateFin);
  }
  if (body.notes !== undefined) {
    g.notes = body.notes == null || String(body.notes).trim() === "" ? null : String(body.notes);
  }
  appendAuditLog({
    entity_type: "SITE_GESTIONNAIRE",
    entity_id: gid,
    action: "UPDATE",
    changes: { ...body },
    ...auditMeta(req),
  });
  res.json(g);
});

crmRouter.delete("/sites/:siteId/gestionnaires/:gestionnaireId", (req: AuthedRequest, res) => {
  if (forbidViewer(req, res)) return;
  const siteId = Number(req.params.siteId);
  const gid = Number(req.params.gestionnaireId);
  const g = siteGestionnaires.find((x) => x.id === gid && x.siteId === siteId);
  if (!g) {
    res.status(404).json({ error: "Lien site / gestionnaire introuvable" });
    return;
  }
  const t = isoToday();
  g.dateFin = t;
  g.isPrincipal = false;
  appendAuditLog({
    entity_type: "SITE_GESTIONNAIRE",
    entity_id: gid,
    action: "DELETE_SOFT",
    changes: { dateFin: t },
    ...auditMeta(req),
  });
  res.json({ ok: true });
});

crmRouter.get("/sites/:siteId/arborescence/tree", (req, res) => {
  const siteId = Number(req.params.siteId);
  if (!findById(sites, siteId)) {
    res.status(404).json({ error: "Site introuvable" });
    return;
  }
  ensureSiteArborescence(siteId);
  res.json(buildArborescenceTree(siteId));
});

crmRouter.get("/sites/:siteId/arborescence", (req, res) => {
  const siteId = Number(req.params.siteId);
  if (!findById(sites, siteId)) {
    res.status(404).json({ error: "Site introuvable" });
    return;
  }
  ensureSiteArborescence(siteId);
  const rawParent = (req.query as { parentId?: string }).parentId;
  const parentId = rawParent != null && rawParent !== "" ? Number(rawParent) : null;
  res.json(listArborescenceChildren(siteId, parentId));
});

crmRouter.post(
  "/sites/:siteId/arborescence/nodes/:folderId/files",
  arborescenceUpload.single("file"),
  (req: AuthedRequest, res) => {
    if (forbidViewer(req, res)) return;
    const siteId = Number(req.params.siteId);
    const folderId = Number(req.params.folderId);
    if (!findById(sites, siteId)) {
      res.status(404).json({ error: "Site introuvable" });
      return;
    }
    const file = req.file;
    if (!file || !file.buffer?.length) {
      res.status(400).json({ error: "Fichier requis" });
      return;
    }
    try {
      const row = saveUploadedFile(
        siteId,
        folderId,
        file.originalname || "fichier",
        file.buffer,
        file.mimetype || null,
        req.auth?.userId ?? null,
      );
      res.status(201).json({
        id: row.id,
        parentId: row.parentId,
        nom: row.nom,
        nodeType: row.nodeType,
        sortOrder: row.sortOrder,
        sizeBytes: row.sizeBytes,
        contentType: row.contentType,
        childCount: 0,
        createdAt: row.createdAt,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload échoué";
      res.status(msg.includes("introuvable") ? 404 : 400).json({ error: msg });
    }
  },
);

crmRouter.get("/sites/:siteId/arborescence/files/:fileId/download", (req, res) => {
  const siteId = Number(req.params.siteId);
  const fileId = Number(req.params.fileId);
  const node = findArborescenceNode(siteId, fileId);
  if (!node || node.nodeType !== "FILE" || !node.storedPath) {
    res.status(404).json({ error: "Fichier introuvable" });
    return;
  }
  if (!fs.existsSync(node.storedPath)) {
    res.status(404).json({ error: "Fichier physique introuvable" });
    return;
  }
  res.download(node.storedPath, node.nom);
});

crmRouter.delete("/sites/:siteId/arborescence/files/:fileId", (req: AuthedRequest, res) => {
  if (forbidViewer(req, res)) return;
  const siteId = Number(req.params.siteId);
  const fileId = Number(req.params.fileId);
  if (!findById(sites, siteId)) {
    res.status(404).json({ error: "Site introuvable" });
    return;
  }
  try {
    deleteArborescenceFile(siteId, fileId);
    res.status(204).end();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Suppression échouée";
    res.status(404).json({ error: msg });
  }
});

const EQUIPEMENT_TYPES: EquipementType[] = ["ASCENSEUR", "MONTE_CHARGE", "MONTE_VOITURE", "PLATEFORME", "DAE"];

function parseEquipementType(raw: unknown): EquipementType | null {
  const v = String(raw || "").trim().toUpperCase();
  return EQUIPEMENT_TYPES.includes(v as EquipementType) ? (v as EquipementType) : null;
}

crmRouter.get("/sites/:siteId/equipements", (req, res) => {
  const siteId = Number(req.params.siteId);
  if (!findById(sites, siteId)) {
    res.status(404).json({ error: "Site introuvable" });
    return;
  }
  const rows = siteEquipements
    .filter((e) => e.siteId === siteId)
    .slice()
    .sort((a, b) => a.id - b.id);
  res.json(rows);
});

crmRouter.post("/sites/:siteId/equipements", (req: AuthedRequest, res) => {
  if (forbidViewer(req, res)) return;
  const siteId = Number(req.params.siteId);
  if (!findById(sites, siteId)) {
    res.status(404).json({ error: "Site introuvable" });
    return;
  }
  const body = req.body as {
    type?: string;
    marque?: string;
    modele?: string;
    numeroSerie?: string;
    anneeInstallation?: number | null;
    capaciteKg?: number | null;
    etages?: string | null;
    statut?: string;
    notes?: string | null;
  };
  const type = parseEquipementType(body.type);
  if (!type) {
    res.status(400).json({ error: "type invalide (ASCENSEUR, MONTE_CHARGE, MONTE_VOITURE, PLATEFORME, DAE)" });
    return;
  }
  const marque = String(body.marque || "").trim();
  const modele = String(body.modele || "").trim();
  const numeroSerie = String(body.numeroSerie || "").trim();
  if (!marque || !modele || !numeroSerie) {
    res.status(400).json({ error: "marque, modele et numeroSerie obligatoires" });
    return;
  }
  const statutRaw = String(body.statut || "ACTIF").trim().toUpperCase();
  const statut = statutRaw === "HORS_SERVICE" || statutRaw === "RETIRE" ? statutRaw : "ACTIF";
  const id = Math.max(0, ...siteEquipements.map((e) => e.id)) + 1;
  const row = {
    id,
    siteId,
    type,
    marque,
    modele,
    numeroSerie,
    anneeInstallation:
      body.anneeInstallation != null && Number.isFinite(Number(body.anneeInstallation))
        ? Number(body.anneeInstallation)
        : null,
    capaciteKg:
      body.capaciteKg != null && Number.isFinite(Number(body.capaciteKg)) ? Number(body.capaciteKg) : null,
    etages: body.etages != null && String(body.etages).trim() ? String(body.etages).trim() : null,
    statut: statut as "ACTIF" | "HORS_SERVICE" | "RETIRE",
    notes: body.notes != null && String(body.notes).trim() ? String(body.notes).trim() : null,
    createdAt: new Date().toISOString(),
  };
  siteEquipements.push(row);
  appendAuditLog({
    entity_type: "SITE_EQUIPEMENT",
    entity_id: id,
    action: "CREATE",
    changes: { siteId, type, numeroSerie },
    ...auditMeta(req),
  });
  res.status(201).json(row);
});

crmRouter.patch("/sites/:siteId/equipements/:equipementId", (req: AuthedRequest, res) => {
  if (forbidViewer(req, res)) return;
  const siteId = Number(req.params.siteId);
  const eid = Number(req.params.equipementId);
  const e = siteEquipements.find((x) => x.id === eid && x.siteId === siteId);
  if (!e) {
    res.status(404).json({ error: "Équipement introuvable" });
    return;
  }
  const body = req.body as {
    type?: string;
    marque?: string;
    modele?: string;
    numeroSerie?: string;
    anneeInstallation?: number | null;
    capaciteKg?: number | null;
    etages?: string | null;
    statut?: string;
    notes?: string | null;
  };
  if (body.type !== undefined) {
    const t = parseEquipementType(body.type);
    if (!t) {
      res.status(400).json({ error: "type invalide" });
      return;
    }
    e.type = t;
  }
  if (body.marque !== undefined) e.marque = String(body.marque).trim() || e.marque;
  if (body.modele !== undefined) e.modele = String(body.modele).trim() || e.modele;
  if (body.numeroSerie !== undefined) e.numeroSerie = String(body.numeroSerie).trim() || e.numeroSerie;
  if (body.anneeInstallation !== undefined) {
    e.anneeInstallation =
      body.anneeInstallation == null || !Number.isFinite(Number(body.anneeInstallation))
        ? null
        : Number(body.anneeInstallation);
  }
  if (body.capaciteKg !== undefined) {
    e.capaciteKg =
      body.capaciteKg == null || !Number.isFinite(Number(body.capaciteKg)) ? null : Number(body.capaciteKg);
  }
  if (body.etages !== undefined) {
    e.etages = body.etages == null || !String(body.etages).trim() ? null : String(body.etages).trim();
  }
  if (body.statut !== undefined) {
    const s = String(body.statut).trim().toUpperCase();
    if (s === "ACTIF" || s === "HORS_SERVICE" || s === "RETIRE") e.statut = s;
  }
  if (body.notes !== undefined) {
    e.notes = body.notes == null || !String(body.notes).trim() ? null : String(body.notes).trim();
  }
  appendAuditLog({
    entity_type: "SITE_EQUIPEMENT",
    entity_id: eid,
    action: "UPDATE",
    changes: { ...body },
    ...auditMeta(req),
  });
  res.json(e);
});

crmRouter.delete("/sites/:siteId/equipements/:equipementId", (req: AuthedRequest, res) => {
  if (forbidViewer(req, res)) return;
  const siteId = Number(req.params.siteId);
  const eid = Number(req.params.equipementId);
  const e = siteEquipements.find((x) => x.id === eid && x.siteId === siteId);
  if (!e) {
    res.status(404).json({ error: "Équipement introuvable" });
    return;
  }
  e.statut = "RETIRE";
  appendAuditLog({
    entity_type: "SITE_EQUIPEMENT",
    entity_id: eid,
    action: "DELETE_SOFT",
    changes: { statut: "RETIRE" },
    ...auditMeta(req),
  });
  res.json({ ok: true });
});

crmRouter.post("/sites/:siteId/gestionnaires/:gestionnaireId/promouvoir", (req: AuthedRequest, res) => {
  if (forbidViewer(req, res)) return;
  const siteId = Number(req.params.siteId);
  const gid = Number(req.params.gestionnaireId);
  const g = siteGestionnaires.find((x) => x.id === gid && x.siteId === siteId);
  if (!g) {
    res.status(404).json({ error: "Lien site / gestionnaire introuvable" });
    return;
  }
  const t = isoToday();
  if (g.dateFin && g.dateFin < t) {
    res.status(400).json({ error: "Ce gestionnaire n’est plus actif — rouvrez une ligne ou créez-en une nouvelle." });
    return;
  }
  demoteSitePrincipals(siteId);
  g.isPrincipal = true;
  g.dateFin = null;
  appendAuditLog({
    entity_type: "SITE_GESTIONNAIRE",
    entity_id: gid,
    action: "PROMOTE_PRINCIPAL",
    changes: { siteId, clientNom: g.clientNom },
    ...auditMeta(req),
  });
  res.json(g);
});

crmRouter.get("/offres", (_req, res) => {
  const list = offres.filter((o) => !String(o.statut).toUpperCase().includes("ANNUL"));
  res.json(
    list.map((o) => {
      let missionsCount = 0;
      try {
        const m = o.missionsJson ? (JSON.parse(o.missionsJson) as unknown[]) : [];
        missionsCount = Array.isArray(m) ? m.length : 0;
      } catch {
        missionsCount = 0;
      }
      return {
        ...o,
        missionsCount,
        gestionnaireLibelle: gestionnaireLibelle(o),
        missionsLibelle: offreTypeMissionCodes(o).join(" + ") || o.typeMission,
      };
    }),
  );
});

crmRouter.get("/commandes", (_req, res) => {
  res.json(
    commandes
      .filter((c) => !String(c.numeroCommande).startsWith("X-"))
      .map((c) => ({
        ...c,
        missionsLibelle: commandeMissionCodes(c).join(" + ") || c.typeMission,
      })),
  );
});

crmRouter.get("/factures", (_req, res) => {
  res.json(
    factures.map((f) => ({
      id: f.id,
      numeroFacture: f.numeroFacture,
      dateFacture: f.dateFacture,
      numeroCommande: f.numeroCommande,
      numeroCommandeClient: f.numeroCommandeClient ?? null,
      clientNom: f.clientNom,
      montantHt: f.montantHt,
      frais: f.frais,
      modeReglement: f.modeReglement,
      commandeId: f.commandeId,
      statutFacturation: f.statutFacturation ?? "ENVOYEE",
      statutPaiement: f.statutPaiement,
    })),
  );
});

/** Jalons à facturer par mois (champ moisFacturation YYYY-MM dans l’échéancier JSON de l’offre) */
crmRouter.get("/facturation/echeances-par-mois", (req, res) => {
  const ymFilter = String(req.query.ym || "").trim();
  type Ligne = {
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
  const lignes: Ligne[] = [];
  for (const o of offres) {
    if (String(o.statut).toUpperCase().includes("ANNUL")) continue;
    const cmd = commandePourOffre(o);
    if (!cmd) continue;
    const lines = parseEcheancierFacturationJson(o.echeancierFacturationJson);
    for (const line of lines) {
      const ym = String(line.moisFacturation || "").slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(ym)) continue;
      const pct = Number(line.pourcentage);
      const pourcentage = Number.isFinite(pct) ? pct : 0;
      const montantHtEstime = Math.round((pourcentage / 100) * o.montantHt * 100) / 100;
      lignes.push({
        moisFacturation: ym,
        offreId: o.id,
        numeroOffre: o.numeroOffre,
        clientNom: o.clientNom,
        siteNom: o.siteNom,
        typeMission: o.typeMission,
        libelle: String(line.libelle || "Jalon"),
        pourcentage,
        montantHtEstime,
        numeroCommande: cmd.numeroCommande,
        commandeId: cmd.id,
      });
    }
  }
  const mois = [...new Set(lignes.map((l) => l.moisFacturation))].sort();
  const filtered = ymFilter ? lignes.filter((l) => l.moisFacturation === ymFilter) : lignes;
  res.json({ mois, lignes: filtered, ymSelection: ymFilter || null });
});

crmRouter.get("/settings", (_req, res) => {
  res.json({
    defaultConsultantEmail: crmAppSettings.defaultConsultantEmail,
    tvaMetropolePercent: crmAppSettings.tvaMetropolePercent,
    tvaDomPercent: crmAppSettings.tvaDomPercent,
  });
});

crmRouter.get("/phases-referentiel", (req, res) => {
  const tm = String(req.query.typeMission || "MS").toUpperCase();
  res.json(PHASES_REFERENTIEL.filter((p) => p.typeMission === tm).sort((a, b) => a.ordre - b.ordre));
});

crmRouter.get("/users/consultants", (_req, res) => {
  res.json(
    users
      .filter((u) => ["CONSULTANT", "MANAGER", "ADMIN"].includes(u.role))
      .map((u) => ({ id: u.id, email: u.email, role: u.role })),
  );
});

crmRouter.post("/search", (req, res) => {
  const q = String((req.body as { q?: string })?.q || "").trim().toLowerCase();
  if (!q) {
    res.json({ offres: [], commandes: [], clients: [], contacts: [], sites: [] });
    return;
  }
  const match = (s: string) => s.toLowerCase().includes(q);
  res.json({
    offres: offres
      .filter((o) => match(o.numeroOffre) || match(o.clientNom) || match(o.siteNom))
      .slice(0, 12)
      .map((o) => ({ kind: "offre" as const, id: o.id, label: o.numeroOffre, sub: o.clientNom })),
    commandes: commandes
      .filter((c) => !c.numeroCommande.startsWith("X-"))
      .filter((c) => match(c.numeroCommande) || match(c.clientNom) || match(c.numeroClient || ""))
      .slice(0, 12)
      .map((c) => ({ kind: "commande" as const, id: c.id, label: c.numeroCommande, sub: c.clientNom })),
    clients: clients
      .filter((c) => c.statut === "ACTIF" && (match(c.raisonSociale) || match(c.email)))
      .slice(0, 12)
      .map((c) => ({ kind: "client" as const, id: c.id, label: c.raisonSociale, sub: c.entite })),
    contacts: contacts
      .filter((c) => c.statut === "ACTIF" && (match(c.nom) || match(c.prenom) || match(c.email) || match(c.entreprise)))
      .slice(0, 12)
      .map((c) => ({ kind: "contact" as const, id: c.id, label: `${c.prenom} ${c.nom}`, sub: c.entreprise })),
    sites: sites
      .filter((s) => (s.statut ?? "ACTIF") !== "ARCHIVE" && (match(s.nom) || match(s.clientNom)))
      .slice(0, 12)
      .map((s) => ({ kind: "site" as const, id: s.id, label: s.nom, sub: s.clientNom })),
  });
});

crmRouter.post("/ia/suggerer-configuration", (req, res) => {
  const b = req.body as { typeMission?: string; nombreAppareils?: number; typeBatiment?: string };
  const tm = String(b.typeMission || "MS").toUpperCase();
  const n = Number(b.nombreAppareils);
  const rows = PHASES_REFERENTIEL.filter((p) => p.typeMission === tm).sort((a, b) => a.ordre - b.ordre);
  let rationale = `Référentiel ${tm} : ${rows.length} phase(s) standard.`;
  if (Number.isFinite(n) && n > 6) {
    rationale += " Volume d’équipements élevé : ajuster les temps de visite / coordination.";
  }
  if (String(b.typeBatiment || "").toLowerCase().includes("hopital")) {
    rationale += " Bâtiment sensible : renforcer la mission réglementaire et la coordination sécurité.";
  }
  const mult = Number.isFinite(n) && n > 10 ? 1.15 : 1;
  const suggestedPhases = rows.map((r) => ({
    code: r.code,
    libelle: r.libelle,
    montantHt: Math.round(r.prixIndicatifHt * mult * 100) / 100,
    inclus: true,
  }));
  res.json({ typeMission: tm, suggestedPhases, rationale });
});

crmRouter.post("/ocr/bon-commande", (req, res) => {
  const text = String((req.body as { pdfText?: string })?.pdfText || "");
  const demo = !text.trim();
  const src = demo
    ? "Bon de commande n° PO-2026-8841\nMontant HT 12 500,00 EUR\nRéférence client SIDR Engineering"
    : text;
  const numeroBon =
    src.match(/(?:n°|N°|nº|#|BC|PO|bon\s+de\s+commande)[\s:.-]*([A-Z0-9][A-Z0-9-]{3,})/i)?.[1] ?? null;
  const mtRaw = src.match(/montant\s*(?:HT)?[\s:]*([\d\s.,]+)\s*(?:EUR|€)?/i)?.[1]?.replace(/\s/g, "").replace(",", ".");
  const montantHt = mtRaw && Number.isFinite(Number(mtRaw)) ? Number(mtRaw) : null;
  res.json({
    demo,
    extracted: { numeroBon, montantHt },
    snippet: src.slice(0, 800),
  });
});

crmRouter.post("/contacts", (req: AuthedRequest, res) => {
  if (forbidViewer(req, res)) return;
  const b = req.body as Record<string, string>;
  const id = Math.max(0, ...contacts.map((c) => c.id)) + 1;
  contacts.push({
    id,
    civilite: b.civilite || "M.",
    nom: b.nom || "",
    prenom: b.prenom || "",
    entreprise: b.clientNom || b.entreprise || "",
    fonction: b.fonction || "",
    email: b.email || "",
    telephone: b.telephone || "",
    mobile: b.mobile || "",
    statut: "ACTIF",
    ownerUserId: req.auth?.userId ?? null,
  });
  appendAuditLog({
    entity_type: "CONTACT",
    entity_id: id,
    action: "CREATE",
    changes: { id },
    ...auditMeta(req),
  });
  res.status(201).json({ id });
});

crmRouter.post("/clients", (req: AuthedRequest, res) => {
  if (forbidViewer(req, res)) return;
  const b = req.body as Record<string, string>;
  const id = Math.max(0, ...clients.map((c) => c.id)) + 1;
  clients.push({
    id,
    raisonSociale: b.raisonSociale || "",
    entite: b.entite || "",
    email: b.email || "",
    telephone: b.telephone || "",
    createdAtIso: new Date().toISOString(),
    statut: "ACTIF",
    siret: b.siret ? String(b.siret).replace(/\s/g, "") : null,
    codePostal: b.codePostal ? String(b.codePostal).replace(/\s/g, "") : null,
    responsableEmail:
      b.responsableEmail != null && String(b.responsableEmail).trim() ? String(b.responsableEmail).trim() : null,
  });
  appendAuditLog({
    entity_type: "CLIENT",
    entity_id: id,
    action: "CREATE",
    changes: { id },
    ...auditMeta(req),
  });
  res.status(201).json({ id });
});

crmRouter.post("/sites", (req: AuthedRequest, res) => {
  if (forbidViewer(req, res)) return;
  const b = req.body as Record<string, string>;
  const nom = String(b.nom || "").trim();
  const clientNom = String(b.clientNom || "").trim();
  const typeSite = String(b.typeSite || "").trim();
  if (!nom) {
    res.status(400).json({ error: "Nom du site obligatoire" });
    return;
  }
  if (!clientNom) {
    res.status(400).json({ error: "Client rattaché obligatoire" });
    return;
  }
  if (!clients.some((c) => c.raisonSociale === clientNom && c.statut === "ACTIF")) {
    res.status(400).json({ error: "Client inconnu ou inactif" });
    return;
  }
  const id = Math.max(0, ...sites.map((s) => s.id)) + 1;
  const row: SiteRow = {
    id,
    nom,
    typeSite,
    clientNom,
    statut: "ACTIF",
  };
  sites.push(row);
  provisionSiteArborescence(id);
  appendAuditLog({
    entity_type: "SITE",
    entity_id: id,
    action: "CREATE",
    changes: { id, nom, clientNom },
    ...auditMeta(req),
  });
  res.status(201).json(toSiteListDto(row));
});

crmRouter.post("/offres", (req: AuthedRequest, res) => {
  if (forbidViewer(req, res)) return;
  const b = req.body as Record<string, unknown>;
  const siteNom = String(b.siteNom || "");
  const gestionnaireNom =
    b.gestionnaireNom != null && String(b.gestionnaireNom).trim() ? String(b.gestionnaireNom).trim() : null;
  if (gestionnaireNom && siteNom) {
    const gestErr = assertGestionnaireOnSite(siteNom, gestionnaireNom);
    if (gestErr) {
      res.status(400).json({ error: gestErr });
      return;
    }
  }
  const id = Math.max(0, ...offres.map((o) => o.id)) + 1;
  const rawMode = String(b.phasesMode || "SELECTION").toUpperCase();
  const phasesMode = (rawMode === "ALL" || rawMode === "CUSTOM" ? rawMode : "SELECTION") as "ALL" | "SELECTION" | "CUSTOM";
  const gestionnaireContact =
    b.gestionnaireContact != null && String(b.gestionnaireContact).trim()
      ? String(b.gestionnaireContact).trim()
      : null;
  let typeMissions: string[] = [];
  const arrOffre = b.typeMissions;
  if (Array.isArray(arrOffre)) {
    typeMissions = [...new Set(arrOffre.map((x) => String(x).toUpperCase()).filter(Boolean))];
  }
  const fallbackOffreTm = String(b.typeMission || "MS").toUpperCase();
  if (!typeMissions.length) typeMissions = [fallbackOffreTm];
  const primaryOffreTm = primaryMissionFromSelection(typeMissions);
  offres.push({
    id,
    numeroOffre: String(b.numeroOffre || ""),
    typeMission: primaryOffreTm,
    typeMissionsJson: JSON.stringify(typeMissions),
    statut: String(b.statut || "ENVOYEE"),
    montantHt: Number(b.montantHt) || 0,
    dateOffre: b.dateOffre ? String(b.dateOffre) : null,
    clientNom: String(b.clientNom || ""),
    siteNom,
    phasesMode,
    phasesLinesJson: jsonOrNull(b.phasesLines),
    echeancierFacturationJson: jsonOrNull(b.echeancierFacturation),
    echeancierExecutionJson: jsonOrNull(b.echeancierExecution),
    tauxTva: Number.isFinite(Number(b.tauxTva)) ? Number(b.tauxTva) : crmAppSettings.tvaMetropolePercent,
    consultantEmail: b.consultantEmail ? String(b.consultantEmail) : crmAppSettings.defaultConsultantEmail,
    gestionnaireNom,
    gestionnaireContact,
    gestionnaireEmail: null,
    missionsJson: jsonOrNull(b.missions),
  });
  res.status(201).json({ id });
});

crmRouter.post("/commandes", (req: AuthedRequest, res) => {
  if (forbidViewer(req, res)) return;
  const b = req.body as Record<string, unknown>;
  const id = Math.max(0, ...commandes.map((c) => c.id)) + 1;
  const nc = b.numeroClient != null && String(b.numeroClient).trim() ? String(b.numeroClient).trim() : null;
  let typeMissions: string[] = [];
  const arr = b.typeMissions;
  if (Array.isArray(arr)) {
    typeMissions = [...new Set(arr.map((x) => String(x).toUpperCase()).filter(Boolean))];
  }
  const fallbackTm = String(b.typeMission || "MS").toUpperCase();
  if (!typeMissions.length) typeMissions = [fallbackTm];
  const primaryTm = primaryMissionFromSelection(typeMissions);
  const statut = normalizeCommandeStatut(String(b.statut || "EN_ATTENTE"));
  commandes.push({
    id,
    numeroCommande: String(b.numeroCommande || ""),
    dateCommande: b.dateCommande ? String(b.dateCommande) : null,
    montantHt: Number(b.montantHt) || 0,
    montantFacture: Number(b.montantFacture) || 0,
    typeMission: primaryTm,
    typeMissionsJson: JSON.stringify(typeMissions),
    statut,
    siteNom: String(b.siteNom || ""),
    clientNom: String(b.clientNom || ""),
    numeroClient: nc,
  });
  res.status(201).json({ id });
});

crmRouter.post("/factures", (req: AuthedRequest, res) => {
  if (forbidViewer(req, res)) return;
  const b = req.body as Record<string, string | number | null | undefined>;
  const id = Math.max(0, ...factures.map((f) => f.id)) + 1;
  const numeroCommande = String(b.numeroCommande || "");
  const cmdId = Number(b.commandeId) || 0;
  const cmd = cmdId ? findById(commandes, cmdId) : commandes.find((c) => c.numeroCommande === numeroCommande);
  const numeroCommandeClient =
    cmd?.numeroClient ??
    (b.numeroCommandeClient != null && String(b.numeroCommandeClient).trim()
      ? String(b.numeroCommandeClient).trim()
      : null);
  const rawStatut = String(b.statutFacturation || "CREEE").toUpperCase();
  const statutFacturation =
    rawStatut === "ENVOYEE" || rawStatut === "ANNULEE" || rawStatut === "PAYEE" || rawStatut === "CREEE"
      ? rawStatut
      : "CREEE";
  factures.push({
    id,
    numeroFacture: String(b.numeroFacture || ""),
    dateFacture: b.dateFacture ? String(b.dateFacture) : null,
    numeroCommande,
    numeroCommandeClient,
    clientNom: String(b.clientNom || ""),
    montantHt: Number(b.montantHt) || 0,
    frais: Number(b.frais) || 0,
    modeReglement: String(b.modeReglement || "VIREMENT"),
    dateEcheance: b.dateFacture ? String(b.dateFacture) : null,
    statutPaiement: statutFacturation === "PAYEE" ? "PAYE" : "NON_PAYE",
    montantPaye: statutFacturation === "PAYEE" ? Number(b.montantHt) || 0 : 0,
    niveauRelance: 0,
    derniereRelanceAt: null,
    commandeId: cmd?.id ?? cmdId,
    statutFacturation: statutFacturation as "CREEE" | "ENVOYEE" | "ANNULEE" | "PAYEE",
  });
  res.status(201).json({ id });
});

function putDelete<T extends { id: number }>(arr: T[], id: number, body: Partial<T>, res: express.Response, del?: boolean) {
  const i = arr.findIndex((x) => x.id === id);
  if (i < 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (del) {
    arr.splice(i, 1);
    res.status(204).end();
    return;
  }
  arr[i] = { ...arr[i], ...body, id } as T;
  res.json(arr[i]);
}

function consultantOwnsContact(role: string, cur: ContactRow, userId: number): boolean {
  if (role !== "CONSULTANT") return true;
  if (cur.ownerUserId == null) return false;
  return cur.ownerUserId === userId;
}

function updateContact(req: AuthedRequest, res: express.Response) {
  if (forbidViewer(req, res)) return;
  const id = Number(req.params.id);
  const cur = findById(contacts, id);
  if (!cur) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const role = req.auth!.role;
  if (!consultantOwnsContact(role, cur, req.auth!.userId)) {
    res.status(403).json({
      error:
        "Modification réservée au consultant assigné, ou contact non assigné (MANAGER/ADMIN uniquement).",
    });
    return;
  }
  const body = req.body as Record<string, unknown>;
  const patch: Partial<ContactRow> = {};
  for (const k of ["civilite", "nom", "prenom", "entreprise", "fonction", "email", "telephone", "mobile"] as const) {
    if (body[k] !== undefined) (patch as Record<string, unknown>)[k] = String(body[k] ?? "");
  }
  const next: ContactRow = { ...cur, ...patch, id };
  if (next.email.trim().toLowerCase() !== cur.email.trim().toLowerCase() && contactEmailTaken(next.email, id)) {
    res.status(400).json({ error: "Email déjà utilisé par un autre contact actif." });
    return;
  }
  const before = { ...cur } as Record<string, unknown>;
  const after = { ...next } as Record<string, unknown>;
  const idx = contacts.findIndex((c) => c.id === id);
  contacts[idx] = next;
  const d = diffSnapshot(before, after);
  if (d) {
    appendAuditLog({
      entity_type: "CONTACT",
      entity_id: id,
      action: "UPDATE",
      changes: d,
      ...auditMeta(req),
    });
  }
  if (next.email.trim().toLowerCase() !== cur.email.trim().toLowerCase()) {
    appendAuditLog({
      entity_type: "CONTACT",
      entity_id: id,
      action: "EMAIL_CONFIRMATION_SIMULATED",
      changes: {
        note: "En production : envoi d’un e-mail de confirmation sur la nouvelle adresse",
        ancien: cur.email,
        nouveau: next.email,
      },
      ...auditMeta(req),
    });
  }
  res.json(next);
}

function updateClient(req: AuthedRequest, res: express.Response) {
  if (forbidViewer(req, res)) return;
  const id = Number(req.params.id);
  const cur = findById(clients, id);
  if (!cur) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const body = req.body as Record<string, unknown>;
  const patch: Partial<ClientRow> = {};
  for (const k of ["raisonSociale", "entite", "email", "telephone"] as const) {
    if (body[k] !== undefined) (patch as Record<string, unknown>)[k] = String(body[k] ?? "");
  }
  if (body.siret !== undefined) {
    const raw = body.siret;
    (patch as { siret?: string | null }).siret =
      raw == null || raw === "" ? null : String(raw).replace(/\s/g, "");
  }
  if (body.codePostal !== undefined) {
    const raw = body.codePostal;
    (patch as { codePostal?: string | null }).codePostal =
      raw == null || raw === "" ? null : String(raw).replace(/\s/g, "");
  }
  if (body.responsableEmail !== undefined) {
    const raw = body.responsableEmail;
    (patch as { responsableEmail?: string | null }).responsableEmail =
      raw == null || raw === "" ? null : String(raw).trim();
  }
  const next: ClientRow = { ...cur, ...patch, id };
  if (next.email.trim().toLowerCase() !== cur.email.trim().toLowerCase() && clientEmailTaken(next.email, id)) {
    res.status(400).json({ error: "Email déjà utilisé par un autre client actif." });
    return;
  }
  const siretOld = cur.siret ?? null;
  const siretNew = next.siret ?? null;
  const before = { ...cur } as Record<string, unknown>;
  const after = { ...next } as Record<string, unknown>;
  const idx = clients.findIndex((c) => c.id === id);
  clients[idx] = next;
  const d = diffSnapshot(before, after);
  if (d) {
    appendAuditLog({
      entity_type: "CLIENT",
      entity_id: id,
      action: "UPDATE",
      changes: d,
      ...auditMeta(req),
    });
  }
  if (siretOld !== siretNew) {
    appendAuditLog({
      entity_type: "CLIENT",
      entity_id: id,
      action: "SIRET_CHANGED",
      changes: { before: siretOld, after: siretNew },
      ...auditMeta(req),
    });
  }
  if (next.email.trim().toLowerCase() !== cur.email.trim().toLowerCase()) {
    appendAuditLog({
      entity_type: "CLIENT",
      entity_id: id,
      action: "EMAIL_CONFIRMATION_SIMULATED",
      changes: { ancien: cur.email, nouveau: next.email },
      ...auditMeta(req),
    });
  }
  res.json(next);
}

function updateSite(req: AuthedRequest, res: express.Response) {
  if (forbidViewer(req, res)) return;
  const id = Number(req.params.id);
  const cur = findById(sites, id);
  if (!cur) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const body = req.body as Record<string, unknown>;
  const next: SiteRow = { ...cur, id };
  if (body.nom !== undefined) next.nom = String(body.nom);
  if (body.typeSite !== undefined) next.typeSite = String(body.typeSite);
  if (body.clientNom !== undefined) next.clientNom = String(body.clientNom);
  if (body.statut !== undefined) {
    const s = String(body.statut).toUpperCase();
    if (s === "ARCHIVE" || s === "ACTIF") next.statut = s as "ACTIF" | "ARCHIVE";
  }
  if (next.clientNom !== cur.clientNom) {
    appendAuditLog({
      entity_type: "SITE",
      entity_id: id,
      action: "CLIENT_OWNER_CHANGED",
      changes: { before: cur.clientNom, after: next.clientNom },
      ...auditMeta(req),
    });
  }
  const before = { ...cur } as Record<string, unknown>;
  const after = { ...next } as Record<string, unknown>;
  const idx = sites.findIndex((s) => s.id === id);
  sites[idx] = next;
  const d = diffSnapshot(before, after);
  if (d) {
    appendAuditLog({
      entity_type: "SITE",
      entity_id: id,
      action: "UPDATE",
      changes: d,
      ...auditMeta(req),
    });
  }
  res.json(next);
}

crmRouter.patch("/contacts/:id", updateContact);
crmRouter.put("/contacts/:id", updateContact);

crmRouter.delete("/contacts/:id", (req: AuthedRequest, res) => {
  if (forbidViewer(req, res)) return;
  const id = Number(req.params.id);
  const ct = findById(contacts, id);
  if (!ct) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const role = req.auth!.role;
  if (role === "CONSULTANT" && !consultantOwnsContact(role, ct, req.auth!.userId)) {
    res.status(403).json({ error: "Suppression réservée au consultant assigné à ce contact." });
    return;
  }
  const n = activeCommandesForEntreprise(ct.entreprise);
  if (n > 0) {
    res.status(400).json({
      error: `Impossible de supprimer : ${n} commande(s) liée(s) au rattachement « ${ct.entreprise} ». Annulez les commandes ou utilisez l’annulation contact.`,
      linkedCommandesCount: n,
      suggestCancel: true,
    });
    return;
  }
  const idx = contacts.findIndex((c) => c.id === id);
  contacts.splice(idx, 1);
  appendAuditLog({
    entity_type: "CONTACT",
    entity_id: id,
    action: "DELETE",
    changes: { snapshot: { nom: ct.nom, prenom: ct.prenom, entreprise: ct.entreprise, email: ct.email } },
    ...auditMeta(req),
  });
  res.status(204).end();
});

crmRouter.patch("/clients/:id", updateClient);
crmRouter.put("/clients/:id", updateClient);

crmRouter.delete("/clients/:id", (req: AuthedRequest, res) => {
  if (forbidViewer(req, res)) return;
  if (req.auth!.role !== "ADMIN") {
    res.status(403).json({ error: "Suppression client réservée ADMIN." });
    return;
  }
  const id = Number(req.params.id);
  const cl = findById(clients, id);
  if (!cl) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const br = clientDeleteBlockReason(cl);
  if (br) {
    res.status(400).json({
      error: `Impossible de supprimer ce client. ${br.msg}`,
      suggestCancel: false,
    });
    return;
  }
  const idx = clients.findIndex((c) => c.id === id);
  clients.splice(idx, 1);
  appendAuditLog({
    entity_type: "CLIENT",
    entity_id: id,
    action: "DELETE",
    changes: { raisonSociale: cl.raisonSociale },
    ...auditMeta(req),
  });
  res.status(204).end();
});

crmRouter.patch("/sites/:id", updateSite);
crmRouter.put("/sites/:id", updateSite);

crmRouter.delete("/sites/:id", (req: AuthedRequest, res) => {
  if (forbidViewer(req, res)) return;
  const role = req.auth!.role;
  if (role !== "ADMIN" && role !== "MANAGER") {
    res.status(403).json({ error: "Suppression site : ADMIN ou MANAGER uniquement." });
    return;
  }
  const id = Number(req.params.id);
  const site = findById(sites, id);
  if (!site) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const br = siteDeleteBlockReason(site.nom);
  if (br) {
    res.status(400).json({
      error: `${br.msg} Vous pouvez archiver le site (champ statut = ARCHIVE).`,
      suggestArchive: true,
    });
    return;
  }
  const idx = sites.findIndex((s) => s.id === id);
  sites.splice(idx, 1);
  appendAuditLog({
    entity_type: "SITE",
    entity_id: id,
    action: "DELETE",
    changes: { nom: site.nom },
    ...auditMeta(req),
  });
  res.status(204).end();
});

crmRouter.put("/offres/:id", (req: AuthedRequest, res) => {
  if (forbidViewer(req, res)) return;
  const id = Number(req.params.id);
  const cur = findById(offres, id);
  if (!cur) return res.status(404).json({ error: "Not found" });
  const body = req.body as Record<string, unknown>;
  const siteNom = body.siteNom != null ? String(body.siteNom) : cur.siteNom;
  if (body.gestionnaireNom !== undefined) {
    const gn =
      body.gestionnaireNom == null || String(body.gestionnaireNom).trim() === ""
        ? null
        : String(body.gestionnaireNom).trim();
    if (gn) {
      const gestErr = assertGestionnaireOnSite(siteNom, gn);
      if (gestErr) {
        res.status(400).json({ error: gestErr });
        return;
      }
    }
  }
  const patch = { ...cur, ...body, id } as OffreRow;
  if (body.typeMissions !== undefined && Array.isArray(body.typeMissions)) {
    const tms = [...new Set((body.typeMissions as unknown[]).map((x) => String(x).toUpperCase()).filter(Boolean))];
    if (tms.length) {
      patch.typeMissionsJson = JSON.stringify(tms);
      patch.typeMission = primaryMissionFromSelection(tms);
    }
  } else if (body.typeMissionsJson !== undefined) {
    const tms = parseTypeMissionsJson(
      body.typeMissionsJson == null ? null : String(body.typeMissionsJson),
    );
    if (tms.length) {
      patch.typeMissionsJson = JSON.stringify(tms);
      patch.typeMission = primaryMissionFromSelection(tms);
    }
  }
  putDelete(offres, id, patch, res);
});

crmRouter.delete("/offres/:id", (req: AuthedRequest, res) => {
  if (forbidViewer(req, res)) return;
  putDelete(offres, Number(req.params.id), {}, res, true);
});

crmRouter.put("/commandes/:id", (req: AuthedRequest, res) => {
  if (forbidViewer(req, res)) return;
  const id = Number(req.params.id);
  const cur = findById(commandes, id);
  if (!cur) return res.status(404).json({ error: "Not found" });
  putDelete(commandes, id, { ...cur, ...req.body, id }, res);
});

crmRouter.delete("/commandes/:id", (req: AuthedRequest, res) => {
  if (forbidViewer(req, res)) return;
  putDelete(commandes, Number(req.params.id), {}, res, true);
});

crmRouter.put("/factures/:id", (req: AuthedRequest, res) => {
  if (forbidViewer(req, res)) return;
  const id = Number(req.params.id);
  const cur = findById(factures, id);
  if (!cur) return res.status(404).json({ error: "Not found" });
  const body = req.body as Record<string, unknown>;
  const next = { ...cur, ...body, id } as typeof cur;
  if (typeof body.statutFacturation === "string") {
    const s = String(body.statutFacturation).toUpperCase();
    if (s === "PAYEE") {
      next.statutPaiement = "PAYE";
      next.montantPaye = next.montantHt + next.frais;
    }
    if (s === "ANNULEE") {
      next.statutPaiement = "NON_PAYE";
    }
  }
  const i = factures.findIndex((x) => x.id === id);
  factures[i] = next;
  appendAuditLog({
    entity_type: "FACTURE",
    entity_id: id,
    action: "UPDATE",
    changes: body as Record<string, unknown>,
    ...auditMeta(req),
  });
  res.json({
    id: next.id,
    numeroFacture: next.numeroFacture,
    dateFacture: next.dateFacture,
    numeroCommande: next.numeroCommande,
    numeroCommandeClient: next.numeroCommandeClient ?? null,
    clientNom: next.clientNom,
    montantHt: next.montantHt,
    frais: next.frais,
    modeReglement: next.modeReglement,
    commandeId: next.commandeId,
    statutFacturation: next.statutFacturation ?? "ENVOYEE",
    statutPaiement: next.statutPaiement,
  });
});

crmRouter.post("/factures/:id/envoyer", (req: AuthedRequest, res) => {
  if (forbidViewer(req, res)) return;
  const id = Number(req.params.id);
  const f = findById(factures, id);
  if (!f) {
    res.status(404).json({ error: "Facture introuvable" });
    return;
  }
  const st = f.statutFacturation ?? "ENVOYEE";
  if (st !== "CREEE") {
    res.status(400).json({ error: "Seules les factures au statut « Créée » peuvent être envoyées." });
    return;
  }
  f.statutFacturation = "ENVOYEE";
  appendAuditLog({
    entity_type: "FACTURE",
    entity_id: id,
    action: "ENVOYER",
    changes: { statutFacturation: { before: "CREEE", after: "ENVOYEE" } },
    ...auditMeta(req),
  });
  res.json({
    ok: true,
    message: "Facture marquée comme envoyée (envoi e-mail / PDF : intégration à brancher).",
    statutFacturation: f.statutFacturation,
  });
});

crmRouter.post("/factures/:id/supprimer", (req: AuthedRequest, res) => {
  if (requireManagerOrAdmin(req, res)) return;
  const id = Number(req.params.id);
  const idx = factures.findIndex((x) => x.id === id);
  if (idx < 0) {
    res.status(404).json({ error: "Facture introuvable" });
    return;
  }
  const f = factures[idx]!;
  const body = req.body as { motif?: string; creerAvoir?: boolean; commentaire?: string | null };
  const motif = String(body.motif || "").trim();
  if (!motif) {
    res.status(400).json({ error: "Motif obligatoire pour la suppression (traçabilité)." });
    return;
  }
  const snapshot = JSON.stringify({
    numeroFacture: f.numeroFacture,
    montantHt: f.montantHt,
    frais: f.frais,
    clientNom: f.clientNom,
    commandeId: f.commandeId,
    statutFacturation: f.statutFacturation ?? "ENVOYEE",
  });
  historiqueAnnulations.push({
    id: Math.max(0, ...historiqueAnnulations.map((h) => h.id)) + 1,
    entityType: "FACTURE",
    entityId: id,
    reference: f.numeroFacture,
    motif,
    commentaire: body.commentaire != null ? String(body.commentaire) : snapshot,
    montantHt: f.montantHt + f.frais,
    clientNom: f.clientNom,
    cancelledAt: new Date().toISOString(),
  });
  if (body.creerAvoir === true) {
    const cl = clients.find((c) => c.raisonSociale === f.clientNom && c.statut === "ACTIF");
    const tva = isClientDomTom(cl) ? crmAppSettings.tvaDomPercent : crmAppSettings.tvaMetropolePercent;
    const ht = f.montantHt + f.frais;
    const ttc = Math.round(ht * (1 + tva / 100) * 100) / 100;
    const aid = Math.max(0, ...avoirs.map((x) => x.id)) + 1;
    avoirs.push({
      id: aid,
      numero: nextAvoirNumero(),
      factureOrigineId: f.id,
      commandeId: f.commandeId,
      motif,
      montantHt: ht,
      tauxTva: tva,
      montantTtc: ttc,
      createdAt: new Date().toISOString(),
    });
  }
  appendAuditLog({
    entity_type: "FACTURE",
    entity_id: id,
    action: "DELETE",
    changes: { motif, creerAvoir: body.creerAvoir === true, snapshot: JSON.parse(snapshot) as Record<string, unknown> },
    ...auditMeta(req),
  });
  factures.splice(idx, 1);
  res.json({ ok: true, avoirCree: body.creerAvoir === true });
});

crmRouter.delete("/factures/:id", (_req, res) => {
  res.status(400).json({
    error: "Suppression directe désactivée. Utilisez POST /api/factures/:id/supprimer avec { motif, creerAvoir? }.",
  });
});

crmRouter.post("/offres/:id/duplicate", (req, res) => {
  const id = Number(req.params.id);
  const o = findById(offres, id);
  if (!o) return res.status(404).json({ error: "Not found" });
  const nid = Math.max(0, ...offres.map((x) => x.id)) + 1;
  const numeroOffre = nextOffreDuplicateNumero(o.numeroOffre);
  offres.push({ ...o, id: nid, numeroOffre, statut: "ENVOYEE" });
  res.json({ id: nid, numeroOffre });
});

crmRouter.post("/offres/:id/cancel", (req, res) => {
  const id = Number(req.params.id);
  const o = findById(offres, id);
  if (!o) return res.status(404).json({ error: "Not found" });
  o.statut = "ANNULEE";
  historiqueAnnulations.push({
    id: Math.max(0, ...historiqueAnnulations.map((h) => h.id)) + 1,
    entityType: "OFFRE",
    entityId: id,
    reference: o.numeroOffre,
    motif: String((req.body as { motif?: string })?.motif || "Annulation"),
    commentaire: null,
    montantHt: o.montantHt,
    clientNom: o.clientNom,
    cancelledAt: new Date().toISOString(),
  });
  res.json({ ok: true });
});

crmRouter.patch("/offres/:id/phases", (req: AuthedRequest, res) => {
  if (forbidViewer(req, res)) return;
  const id = Number(req.params.id);
  const cur = findById(offres, id);
  if (!cur) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const b = req.body as Record<string, unknown>;
  const pm = String(b.phasesMode || cur.phasesMode || "SELECTION").toUpperCase();
  const phasesMode = (pm === "ALL" || pm === "CUSTOM" ? pm : "SELECTION") as "ALL" | "SELECTION" | "CUSTOM";
  const i = offres.findIndex((o) => o.id === id);
  const next = {
    ...cur,
    id,
    phasesMode,
    phasesLinesJson: b.phasesLines !== undefined ? jsonOrNull(b.phasesLines) : cur.phasesLinesJson,
    montantHt: b.montantHt !== undefined ? Number(b.montantHt) || 0 : cur.montantHt,
  };
  offres[i] = next;
  res.json(next);
});

crmRouter.post("/offres/:id/demander-signature", (req: AuthedRequest, res) => {
  if (forbidViewer(req, res)) return;
  const o = findById(offres, Number(req.params.id));
  if (!o) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const pid = `YOUSIGN-STUB-${o.id}-${Date.now()}`;
  offreSignatures.set(o.id, { procedureId: pid, status: "PENDING" });
  res.json({ procedureId: pid, status: "PENDING", provider: "YOUSIGN_STUB" });
});

crmRouter.get("/offres/:id/signature-status", (req, res) => {
  const st = offreSignatures.get(Number(req.params.id));
  if (!st) {
    res.json({ status: "NONE", procedureId: null });
    return;
  }
  res.json({ procedureId: st.procedureId, status: st.status });
});

crmRouter.get("/commandes/:id/factures", (req, res) => {
  const id = Number(req.params.id);
  const c = findById(commandes, id);
  if (!c || c.numeroCommande.startsWith("X-")) {
    res.status(404).json({ error: "Commande introuvable" });
    return;
  }
  const list = factures.filter((f) => f.commandeId === id);
  res.json(
    list.map((f) => ({
      id: f.id,
      numeroFacture: f.numeroFacture,
      montantHt: f.montantHt,
      frais: f.frais,
      statutPaiement: f.statutPaiement,
      payee: f.statutPaiement === "PAYE",
      dateFacture: f.dateFacture,
    })),
  );
});

crmRouter.get("/avoirs", (_req, res) => {
  res.json(avoirs);
});

crmRouter.get("/avoirs/:id/pdf", (req, res) => {
  const id = Number(req.params.id);
  const a = findById(avoirs, id);
  if (!a) {
    res.status(404).json({ error: "Avoir introuvable" });
    return;
  }
  const text = `%PDF-1.4 AVOIR ${a.numero} facture origine ${a.factureOrigineId} montant HT ${a.montantHt}`;
  res.type("application/pdf").send(Buffer.from(text));
});

crmRouter.post("/contacts/:id/cancel", (req: AuthedRequest, res) => {
  const role = req.auth?.role;
  if (role !== "ADMIN" && role !== "MANAGER") {
    res.status(403).json({ error: "Réservé ADMIN ou MANAGER" });
    return;
  }
  const id = Number(req.params.id);
  const ct = findById(contacts, id);
  if (!ct) {
    res.status(404).json({ error: "Contact introuvable" });
    return;
  }
  const motif = String((req.body as { motif?: string })?.motif || "").trim();
  if (!motif) {
    res.status(400).json({ error: "Motif obligatoire" });
    return;
  }
  const linked = commandes.some((co) => !co.numeroCommande.startsWith("X-") && co.clientNom === ct.entreprise);
  if (linked) {
    res.status(400).json({
      error: "Impossible d'annuler : ce contact est rattaché à une ou plusieurs commandes actives.",
    });
    return;
  }
  ct.statut = "ANNULE";
  ct.cancelledAt = new Date().toISOString();
  ct.cancellationReason = motif;
  historiqueAnnulations.push({
    id: Math.max(0, ...historiqueAnnulations.map((h) => h.id)) + 1,
    entityType: "CONTACT",
    entityId: id,
    reference: `${ct.prenom} ${ct.nom}`,
    motif,
    commentaire: String((req.body as { commentaire?: string })?.commentaire || "") || null,
    montantHt: 0,
    clientNom: ct.entreprise,
    cancelledAt: new Date().toISOString(),
  });
  res.json({ ok: true });
});

crmRouter.post("/contacts/:id/restore", (req: AuthedRequest, res) => {
  if (req.auth?.role !== "ADMIN") {
    res.status(403).json({ error: "Réservé ADMIN" });
    return;
  }
  const id = Number(req.params.id);
  const ct = findById(contacts, id);
  if (!ct) {
    res.status(404).json({ error: "Contact introuvable" });
    return;
  }
  ct.statut = "ACTIF";
  ct.cancelledAt = null;
  ct.cancellationReason = null;
  res.json({ ok: true });
});

crmRouter.post("/clients/:id/cancel", (req: AuthedRequest, res) => {
  if (req.auth?.role !== "ADMIN") {
    res.status(403).json({ error: "Annulation client réservée ADMIN" });
    return;
  }
  const id = Number(req.params.id);
  const cl = findById(clients, id);
  if (!cl) {
    res.status(404).json({ error: "Client introuvable" });
    return;
  }
  const activeCmd = commandes.some((co) => !co.numeroCommande.startsWith("X-") && co.clientNom === cl.raisonSociale);
  if (activeCmd) {
    res.status(400).json({ error: "Client avec commande active — annulation impossible." });
    return;
  }
  cl.statut = "ANNULE";
  cl.cancelledAt = new Date().toISOString();
  cl.cancellationReason = String((req.body as { motif?: string })?.motif || "Annulation");
  historiqueAnnulations.push({
    id: Math.max(0, ...historiqueAnnulations.map((h) => h.id)) + 1,
    entityType: "CLIENT",
    entityId: id,
    reference: cl.raisonSociale,
    motif: String((req.body as { motif?: string })?.motif || "Annulation"),
    commentaire: null,
    montantHt: 0,
    clientNom: cl.raisonSociale,
    cancelledAt: new Date().toISOString(),
  });
  res.json({ ok: true });
});

crmRouter.post("/commandes/:id/duplicate", (_req, res) => {
  res.status(400).json({
    error: "La duplication de commande n’est plus proposée : créez une nouvelle commande si nécessaire.",
  });
});

crmRouter.post("/commandes/:id/cancel", (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const c = findById(commandes, id);
  if (!c) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (c.numeroCommande.startsWith("X-")) {
    res.status(400).json({ error: "Commande déjà annulée" });
    return;
  }

  const body = req.body as {
    motif?: string;
    commentaire?: string | null;
    factureIds?: number[];
    emitAvoirs?: boolean;
  };
  const motif = String(body.motif || "").trim();
  if (!motif) {
    res.status(400).json({ error: "Motif obligatoire" });
    return;
  }

  const advanced =
    Array.isArray(body.factureIds) &&
    body.factureIds.length > 0 &&
    body.emitAvoirs === true;

  if (advanced) {
    const role = req.auth?.role;
    if (role !== "ADMIN" && role !== "MANAGER") {
      res.status(403).json({ error: "Annulation avec avoirs : rôle MANAGER ou ADMIN requis" });
      return;
    }
    for (const fid of body.factureIds!) {
      const f = findById(factures, fid);
      if (!f || f.commandeId !== c.id) {
        res.status(400).json({ error: `Facture ${fid} invalide pour cette commande` });
        return;
      }
      const tva = 20;
      const ttc = Math.round((f.montantHt + f.frais) * (1 + tva / 100) * 100) / 100;
      const aid = Math.max(0, ...avoirs.map((x) => x.id)) + 1;
      avoirs.push({
        id: aid,
        numero: nextAvoirNumero(),
        factureOrigineId: f.id,
        commandeId: c.id,
        motif,
        montantHt: f.montantHt + f.frais,
        tauxTva: tva,
        montantTtc: ttc,
        createdAt: new Date().toISOString(),
      });
    }
  }

  const refBefore = c.numeroCommande;
  c.numeroCommande = `X-${c.numeroCommande}`;
  historiqueAnnulations.push({
    id: Math.max(0, ...historiqueAnnulations.map((h) => h.id)) + 1,
    entityType: "COMMANDE",
    entityId: id,
    reference: refBefore,
    motif,
    commentaire: body.commentaire ?? null,
    montantHt: c.montantHt,
    clientNom: c.clientNom,
    cancelledAt: new Date().toISOString(),
  });
  res.json({ ok: true, avoirsCrees: advanced ? body.factureIds!.length : 0 });
});

crmRouter.get("/dashboard/counts", requireRoles("ADMIN"), (_req, res) => {
  res.json({
    contacts: contacts.filter((c) => c.statut === "ACTIF").length,
    clients: clients.filter((c) => c.statut === "ACTIF").length,
    sites: sites.filter((s) => (s.statut ?? "ACTIF") !== "ARCHIVE").length,
    offresActives: offres.filter((o) => !String(o.statut).toUpperCase().includes("ANNUL")).length,
    commandesActives: commandes.filter((c) => !c.numeroCommande.startsWith("X-")).length,
    factures: factures.length,
  });
});

crmRouter.get("/audit-log", requireRoles("ADMIN"), (_req, res) => {
  res.json([...auditLog].reverse().slice(0, 800));
});

crmRouter.get("/audit-log/export.csv", requireRoles("ADMIN"), (_req, res) => {
  const headers = ["id", "entity_type", "entity_id", "action", "performed_by", "performed_at", "changes_json", "ip_address"];
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [headers.join(",")];
  for (const a of [...auditLog].reverse()) {
    lines.push(
      [
        a.id,
        a.entity_type,
        a.entity_id,
        a.action,
        a.performed_by,
        a.performed_at,
        JSON.stringify(a.changes ?? {}),
        a.ip_address ?? "",
      ]
        .map((x) => esc(String(x)))
        .join(","),
    );
  }
  res.type("text/csv; charset=utf-8").send(lines.join("\n"));
});

crmRouter.get("/rapports/kpis", requireRoles("ADMIN"), (_req, res) => {
  const avoirsMontantHt = avoirs.reduce((s, a) => s + a.montantHt, 0);
  res.json({
    offresActives: offres.length,
    commandesActives: commandes.length,
    facturesImpayees: factures.filter((f) => f.statutPaiement !== "PAYE").length,
    caHtMois: 125000,
    avoirsEmis: avoirs.length,
    avoirsMontantHt,
    totalOffres: offres.filter((o) => !String(o.statut).toUpperCase().includes("ANNUL")).length,
    totalCommandes: commandes.filter((c) => !c.numeroCommande.startsWith("X-")).length,
    totalFactures: factures.length,
  });
});

crmRouter.get("/rapports/top-gestionnaires", (_req, res) => {
  const by: Record<string, number> = {};
  for (const o of offres) {
    if (String(o.statut).toUpperCase().includes("ANNUL")) continue;
    const g = o.gestionnaireNom?.trim() || o.clientNom?.trim();
    if (!g) continue;
    by[g] = (by[g] || 0) + o.montantHt;
  }
  const items = Object.entries(by)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([gestionnaire, caHt]) => ({ gestionnaire, caHt }));
  res.json({ items });
});

crmRouter.get("/rapports/export/kpis.csv", (_req, res) => {
  res.type("text/csv").send("metric,value\noffres,42\n");
});

crmRouter.get("/rapports/export/annulations.csv", (_req, res) => {
  res.type("text/csv").send("reference,motif\n");
});

crmRouter.get("/historique/annulations", (_req, res) => {
  res.json(historiqueAnnulations);
});

crmRouter.get("/historique/annulations/:type", (req, res) => {
  const t = req.params.type.toUpperCase();
  res.json(historiqueAnnulations.filter((h) => h.entityType === t));
});

type GenBody = { reference?: string; content?: string; format?: string };

crmRouter.get("/documents/versions", (req, res) => {
  const ref = String(req.query.reference || "");
  const docTypeQ = String(req.query.docType || "").toUpperCase();
  let list = fichierVersions.filter((v) => v.reference === ref);
  if (docTypeQ === "OFFRE" || docTypeQ === "COMMANDE" || docTypeQ === "FACTURE") {
    list = list.filter((v) => v.docType === docTypeQ);
  }
  const sorted = [...list].sort((a, b) => b.version - a.version);
  res.json(
    sorted.map((v) => ({
      version: v.version,
      reference: v.reference,
      docType: v.docType,
      createdAt: v.createdAt,
      storageKey: v.storageKey,
      storage: v.storage,
    })),
  );
});

crmRouter.post("/documents/offre/generate", (req, res) => {
  const b = req.body as GenBody;
  const ref = String(b.reference || "REF-OFFRE");
  const fmt = b.format === "docx" ? "docx" : "pdf";
  pushDocumentVersion({ reference: ref, docType: "OFFRE", format: fmt });
  const o = offres.find((x) => x.numeroOffre === ref);
  const lines: string[] = [`Document: Offre ${ref}`, String(b.content || "").slice(0, 2000)];
  if (o) {
    lines.push(`Client: ${o.clientNom} | Site: ${o.siteNom} | TVA ${o.tauxTva ?? 20}%`);
    if (o.phasesLinesJson) lines.push(`Phases: ${o.phasesLinesJson.slice(0, 800)}`);
    if (o.echeancierFacturationJson) lines.push(`Échéancier facturation: ${o.echeancierFacturationJson.slice(0, 400)}`);
  }
  const buf = fmt === "pdf" ? pdfStubLines(lines) : Buffer.from(lines.join("\n"), "utf8");
  res
    .type(
      fmt === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
    .send(buf);
});

crmRouter.post("/documents/commande/generate", (req, res) => {
  const b = req.body as GenBody;
  const ref = String(b.reference || "REF-CMD");
  const fmt = b.format === "docx" ? "docx" : "pdf";
  pushDocumentVersion({ reference: ref, docType: "COMMANDE", format: fmt });
  const c = commandes.find((x) => x.numeroCommande === ref);
  const lines: string[] = [`Document: Commande ${ref}`, String(b.content || "").slice(0, 2000)];
  if (c) {
    lines.push(`Client: ${c.clientNom} | N° commande client: ${c.numeroClient ?? "—"}`);
  }
  const buf = fmt === "pdf" ? pdfStubLines(lines) : Buffer.from(lines.join("\n"), "utf8");
  res
    .type(
      fmt === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
    .send(buf);
});

crmRouter.post("/documents/facture/generate", (req, res) => {
  const b = req.body as GenBody;
  const ref = String(b.reference || "REF-FAC");
  const fmt = b.format === "docx" ? "docx" : "pdf";
  pushDocumentVersion({ reference: ref, docType: "FACTURE", format: fmt });
  const f = factures.find((x) => x.numeroFacture === ref);
  const lines: string[] = [`Document: Facture ${ref}`, String(b.content || "").slice(0, 2000)];
  if (f) {
    const cmd = findById(commandes, f.commandeId);
    lines.push(
      `Commande LVO: ${f.numeroCommande} | N° commande client: ${f.numeroCommandeClient ?? cmd?.numeroClient ?? "—"}`,
    );
  }
  const buf = fmt === "pdf" ? pdfStubLines(lines) : Buffer.from(lines.join("\n"), "utf8");
  res
    .type(
      fmt === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
    .send(buf);
});

crmRouter.post("/webhooks/yousign", (req, res) => {
  const body = req.body as { procedure_id?: string; data?: { procedure_id?: string } };
  const proc = String(body.procedure_id || body.data?.procedure_id || "");
  if (proc) {
    for (const [oid, s] of offreSignatures) {
      if (s.procedureId === proc) {
        offreSignatures.set(oid, { ...s, status: "SIGNED" });
        break;
      }
    }
  }
  res.json({ ok: true });
});

crmRouter.post("/fichiers/presign", (_req, res) => {
  res.json({ url: "https://example.com/upload", fields: {} });
});

crmRouter.post("/fichiers/upload", (_req, res) => {
  res.json({ ok: true });
});

crmRouter.get("/planning/jalons", (_req, res) => {
  const now = Date.now();
  const due = (daysFromNow: number) => new Date(now + daysFromNow * 86400000).toISOString();
  res.json([
    {
      id: "m-close",
      label: "Clôture mensuelle — export CRM",
      period: "MONTH",
      dueAt: due(12),
      alertLevel: "info",
    },
    {
      id: "q-review",
      label: "Revue trimestrielle pipeline",
      period: "QUARTER",
      dueAt: due(45),
      alertLevel: "warn",
    },
    {
      id: "phase-end",
      label: "Fin de phase — jalons techniques",
      period: "PHASE_END",
      dueAt: due(5),
      alertLevel: "critical",
    },
  ]);
});

crmRouter.post("/emails/send", (_req, res) => {
  res.json({ ok: true });
});

crmRouter.get("/rgpd/politiques-retention", (_req, res) => {
  res.json([{ domaine: "Contacts", dureeAns: 3, baseLegale: "Contrat" }]);
});

crmRouter.get("/rgpd/export", (_req, res) => {
  res.json({ status: "queued" });
});

crmRouter.post("/rgpd/anonymize", requireRoles("ADMIN"), (req, res) => {
  const id = Number((req.query as { contactId?: string }).contactId);
  const c = findById(contacts, id);
  if (c) {
    c.email = "anonymise@lvo.local";
    c.telephone = "";
    c.mobile = "";
  }
  res.json({ ok: true });
});
