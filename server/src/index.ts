import crypto from "node:crypto";
import cors from "cors";
import express from "express";

import {
  consumeRefreshToken,
  consumeClientRefreshToken,
  consumeAscensoristeRefreshToken,
  consumeExploitationRefreshToken,
  hashPassword,
  issueRefreshToken,
  issueClientRefreshToken,
  issueAscensoristeRefreshToken,
  issueExploitationRefreshToken,
  signAccessToken,
  signClientAccessToken,
  signAscensoristeAccessToken,
  signExploitationAccessToken,
  verifyClientAccessToken,
  verifyAscensoristeAccessToken,
  verifyExploitationAccessToken,
  verifyPassword,
} from "./auth.js";
import { authMiddleware, crmOrExploitationMiddleware, requireRoles } from "./middleware.js";
import { crmRouter } from "./routes/crm.js";
import { mmsRouter } from "./routes/mms.js";
import { quontoRouter } from "./routes/quonto.js";
import { recouvrementRouter } from "./routes/recouvrement.js";
import { devisGroupementRouter, registerClientDevisRoutes, registerAscensoristeDevisRoutes } from "./routes/devis-groupement.js";
import { suiviDevisRouter } from "./routes/suivi-devis.js";
import {
  appareilsArretRouter,
  registerAscensoristeAppareilsArretRoutes,
  registerClientAppareilsArretRoutes,
} from "./routes/appareils-arret.js";
import { checkDatabase } from "./db-health.js";
import { loadStoreSnapshot, persistStore, schedulePersistStore, storeSnapshotPath } from "./store-persist.js";
import { provisionSiteArborescence } from "./site-arborescence.js";
import { getMinio, MINIO_BUCKETS, ensureMinioBuckets } from "./db.js";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { commandes, contacts, ascensoristes, exploitationUsers, factures, isQuontoProcessed, markQuontoProcessed, mmsRapports, offres, pendingQuonto, seedStore, ensureDefaultGroupementClients, sites, siteEquipements, users, clientMessages, clientDocuments, clientNotifications, clientInterventions, clientContrats, clientAlertesConfigs, crmNotifications, clients, siteGestionnaires, siteArborescenceNodes, historiqueAnnulations, avoirs, crmTasks, appareils, devisGroupement, negociationMessages, appareilsArretUploads, appareilsArretRows, offreSignatures, type ClientAlertesConfig, type ClientDocumentType, type ClientInterventionType, type ClientInterventionPriorite, type ClientInterventionRow } from "./store.js";

const PORT = Number(process.env.API_PORT) || 8080;

async function main() {
  // Initialisation buckets MinIO (non bloquant si indisponible)
  await ensureMinioBuckets().catch((e) => console.warn("[minio] Init buckets :", (e as Error).message));

  const restored = await loadStoreSnapshot();
  if (restored) {
    console.log(`[store] Données restaurées depuis ${storeSnapshotPath()}`);
  } else {
    await seedStore(async (plain) => hashPassword(plain));
    await persistStore();
    console.log(`[store] Jeu de démo initialisé → ${storeSnapshotPath()}`);
  }
  if (ensureDefaultGroupementClients()) {
    await persistStore();
    console.log("[store] Clients groupement par défaut ajoutés (SIDR, SODIAC, SEMADER)");
  }
  if (exploitationUsers.length === 0) {
    exploitationUsers.push({
      id: Math.max(0, ...exploitationUsers.map((u) => u.id)) + 1,
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
    await persistStore();
    console.log("[store] Compte Admin Exploitation par défaut créé (admin@exploitation.lvo-ing.fr / lvo123)");
  }
  for (const s of sites) provisionSiteArborescence(s.id);

  const app = express();
  app.use(cors({ origin: true, credentials: true }));

  app.use((req, res, next) => {
    if (req.method !== "GET") {
      res.on("finish", () => {
        if (res.statusCode < 400) schedulePersistStore();
      });
    }
    next();
  });

  app.post("/api/webhooks/quonto", express.raw({ type: "*/*" }), (req, res) => {
    const secret = process.env.QUONTO_WEBHOOK_SECRET;
    const raw = req.body instanceof Buffer ? req.body : Buffer.from("");
    const sig = req.headers["x-qonto-signature"];
    if (secret && typeof sig === "string") {
      const h = crypto.createHmac("sha256", secret).update(raw).digest("hex");
      if (h !== sig) {
        res.status(401).json({ error: "Invalid signature" });
        return;
      }
    }
    let body: { transaction_id?: string; amount?: string | number; label?: string };
    try {
      body = JSON.parse(raw.toString("utf8") || "{}");
    } catch {
      res.status(400).json({ error: "Invalid JSON" });
      return;
    }
    const tid = String(body.transaction_id || "");
    if (!tid) {
      res.status(400).json({ error: "transaction_id required" });
      return;
    }
    if (isQuontoProcessed(tid)) {
      res.json({ ok: true, duplicate: true });
      return;
    }
    markQuontoProcessed(tid);
    const amount = typeof body.amount === "string" ? Number(body.amount.replace(",", ".")) : Number(body.amount);
    if (!Number.isFinite(amount) || amount === 0) {
      res.json({ ok: true, ignored: true });
      return;
    }
    const id = Math.max(0, ...pendingQuonto.map((t) => t.id), 0) + 1;
    const label = String(body.label || "");
    const score = /LVO-F\d{4}-\d{3}/i.test(label) ? 75 : 45;
    pendingQuonto.push({
      id,
      libelle: label || `Mouvement ${tid}`,
      montant: amount,
      dateOperation: new Date().toISOString().slice(0, 10),
      score,
      quontoTransactionId: tid,
    });
    res.json({ ok: true, id });
  });

  app.use(express.json({ limit: "2mb" }));

  app.post("/api/auth/login", async (req, res) => {
    const email = String((req.body as { email?: string })?.email || "").trim().toLowerCase();
    const password = String((req.body as { password?: string })?.password || "");
    const u = users.find((x) => x.email.toLowerCase() === email);
    if (!u || !(await verifyPassword(password, u.passwordHash))) {
      res.status(401).json({ error: "Identifiants invalides" });
      return;
    }
    const refreshToken = issueRefreshToken(u.id);
    res.json({
      token: signAccessToken({ sub: u.id, email: u.email, role: u.role }),
      refreshToken,
      email: u.email,
      role: u.role,
      userId: u.id,
      agenceId: 1,
    });
  });

  app.post("/api/auth/refresh", (req, res) => {
    const refreshToken = String((req.body as { refreshToken?: string })?.refreshToken || "");
    const uid = consumeRefreshToken(refreshToken);
    if (uid == null) {
      res.status(401).json({ error: "Refresh invalide" });
      return;
    }
    const u = users.find((x) => x.id === uid);
    if (!u) {
      res.status(401).json({ error: "Utilisateur introuvable" });
      return;
    }
    const nextRefresh = issueRefreshToken(u.id);
    res.json({
      token: signAccessToken({ sub: u.id, email: u.email, role: u.role }),
      refreshToken: nextRefresh,
      email: u.email,
      role: u.role,
      userId: u.id,
      agenceId: 1,
    });
  });

  // ── Espace client auth (pas besoin de token CRM) ───────────────────────────
  app.post("/api/client-auth/login", async (req, res) => {
    const email = String((req.body as { email?: string })?.email || "").trim().toLowerCase();
    const password = String((req.body as { password?: string })?.password || "");
    const contact = contacts.find((c) => c.email.toLowerCase() === email && c.statut === "ACTIF");
    if (!contact || !contact.clientPasswordHash || !(await verifyPassword(password, contact.clientPasswordHash))) {
      res.status(401).json({ error: "Identifiants invalides" });
      return;
    }
    const refreshToken = issueClientRefreshToken(contact.id);
    res.json({
      token: signClientAccessToken({ sub: contact.id, email: contact.email }),
      refreshToken,
      email: contact.email,
      contactId: contact.id,
      nom: contact.nom,
      prenom: contact.prenom,
      entreprise: contact.entreprise,
    });
  });

  app.post("/api/client-auth/refresh", (req, res) => {
    const refreshToken = String((req.body as { refreshToken?: string })?.refreshToken || "");
    const contactId = consumeClientRefreshToken(refreshToken);
    if (contactId == null) {
      res.status(401).json({ error: "Refresh invalide" });
      return;
    }
    const contact = contacts.find((c) => c.id === contactId && c.statut === "ACTIF");
    if (!contact) {
      res.status(401).json({ error: "Contact introuvable" });
      return;
    }
    const nextRefresh = issueClientRefreshToken(contact.id);
    res.json({
      token: signClientAccessToken({ sub: contact.id, email: contact.email }),
      refreshToken: nextRefresh,
      email: contact.email,
      contactId: contact.id,
      nom: contact.nom,
      prenom: contact.prenom,
      entreprise: contact.entreprise,
    });
  });

  // Middleware auth espace client
  function clientAuthMiddleware(req: express.Request & { clientContact?: typeof contacts[0] }, res: express.Response, next: express.NextFunction) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const payload = verifyClientAccessToken(token);
    if (!payload) {
      res.status(401).json({ error: "Non authentifié (espace client)" });
      return;
    }
    const contact = contacts.find((c) => c.id === payload.sub && c.statut === "ACTIF");
    if (!contact) {
      res.status(401).json({ error: "Contact introuvable ou inactif" });
      return;
    }
    req.clientContact = contact;
    next();
  }

  app.get("/api/client/me", clientAuthMiddleware, (req: express.Request & { clientContact?: typeof contacts[0] }, res) => {
    const c = req.clientContact!;
    res.json({ id: c.id, nom: c.nom, prenom: c.prenom, email: c.email, entreprise: c.entreprise, civilite: c.civilite, fonction: c.fonction, telephone: c.telephone, mobile: c.mobile });
  });

  // ── Espace ascensoriste auth (pas besoin de token CRM) ─────────────────────
  app.post("/api/ascensoriste-auth/login", async (req, res) => {
    const email = String((req.body as { email?: string })?.email || "").trim().toLowerCase();
    const password = String((req.body as { password?: string })?.password || "");
    const ascensoriste = ascensoristes.find((a) => a.email.toLowerCase() === email && a.statut === "ACTIF");
    if (!ascensoriste || !ascensoriste.ascensoristePasswordHash || !(await verifyPassword(password, ascensoriste.ascensoristePasswordHash))) {
      res.status(401).json({ error: "Identifiants invalides" });
      return;
    }
    const refreshToken = issueAscensoristeRefreshToken(ascensoriste.id);
    res.json({
      token: signAscensoristeAccessToken({ sub: ascensoriste.id, email: ascensoriste.email }),
      refreshToken,
      email: ascensoriste.email,
      ascensoristeId: ascensoriste.id,
      nom: ascensoriste.nom,
      prenom: ascensoriste.prenom,
      entreprise: ascensoriste.entreprise,
    });
  });

  app.post("/api/ascensoriste-auth/refresh", (req, res) => {
    const refreshToken = String((req.body as { refreshToken?: string })?.refreshToken || "");
    const ascensoristeId = consumeAscensoristeRefreshToken(refreshToken);
    if (ascensoristeId == null) {
      res.status(401).json({ error: "Refresh invalide" });
      return;
    }
    const ascensoriste = ascensoristes.find((a) => a.id === ascensoristeId && a.statut === "ACTIF");
    if (!ascensoriste) {
      res.status(401).json({ error: "Ascensoriste introuvable" });
      return;
    }
    const nextRefresh = issueAscensoristeRefreshToken(ascensoriste.id);
    res.json({
      token: signAscensoristeAccessToken({ sub: ascensoriste.id, email: ascensoriste.email }),
      refreshToken: nextRefresh,
      email: ascensoriste.email,
      ascensoristeId: ascensoriste.id,
      nom: ascensoriste.nom,
      prenom: ascensoriste.prenom,
      entreprise: ascensoriste.entreprise,
    });
  });

  // Middleware auth espace ascensoriste
  function ascensoristeAuthMiddleware(req: express.Request & { ascensoriste?: typeof ascensoristes[0] }, res: express.Response, next: express.NextFunction) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const payload = verifyAscensoristeAccessToken(token);
    if (!payload) {
      res.status(401).json({ error: "Non authentifié (espace ascensoriste)" });
      return;
    }
    const ascensoriste = ascensoristes.find((a) => a.id === payload.sub && a.statut === "ACTIF");
    if (!ascensoriste) {
      res.status(401).json({ error: "Ascensoriste introuvable ou inactif" });
      return;
    }
    req.ascensoriste = ascensoriste;
    next();
  }

  app.get("/api/ascensoriste/me", ascensoristeAuthMiddleware, (req: express.Request & { ascensoriste?: typeof ascensoristes[0] }, res) => {
    const a = req.ascensoriste!;
    res.json({ id: a.id, nom: a.nom, prenom: a.prenom, email: a.email, entreprise: a.entreprise, telephone: a.telephone });
  });

  // ── Admin Exploitation auth (comptes distincts de l'Admin CRM) ─────────────
  app.post("/api/exploitation-auth/login", async (req, res) => {
    const email = String((req.body as { email?: string })?.email || "").trim().toLowerCase();
    const password = String((req.body as { password?: string })?.password || "");
    const exploitationUser = exploitationUsers.find((u) => u.email.toLowerCase() === email && u.statut === "ACTIF");
    if (!exploitationUser || !exploitationUser.exploitationPasswordHash || !(await verifyPassword(password, exploitationUser.exploitationPasswordHash))) {
      res.status(401).json({ error: "Identifiants invalides" });
      return;
    }
    const refreshToken = issueExploitationRefreshToken(exploitationUser.id);
    res.json({
      token: signExploitationAccessToken({ sub: exploitationUser.id, email: exploitationUser.email, role: exploitationUser.role }),
      refreshToken,
      email: exploitationUser.email,
      exploitationUserId: exploitationUser.id,
      nom: exploitationUser.nom,
      prenom: exploitationUser.prenom,
      role: exploitationUser.role,
      poste: exploitationUser.poste,
    });
  });

  app.post("/api/exploitation-auth/refresh", (req, res) => {
    const refreshToken = String((req.body as { refreshToken?: string })?.refreshToken || "");
    const exploitationUserId = consumeExploitationRefreshToken(refreshToken);
    if (exploitationUserId == null) {
      res.status(401).json({ error: "Refresh invalide" });
      return;
    }
    const exploitationUser = exploitationUsers.find((u) => u.id === exploitationUserId && u.statut === "ACTIF");
    if (!exploitationUser) {
      res.status(401).json({ error: "Utilisateur introuvable" });
      return;
    }
    const nextRefresh = issueExploitationRefreshToken(exploitationUser.id);
    res.json({
      token: signExploitationAccessToken({ sub: exploitationUser.id, email: exploitationUser.email, role: exploitationUser.role }),
      refreshToken: nextRefresh,
      email: exploitationUser.email,
      exploitationUserId: exploitationUser.id,
      nom: exploitationUser.nom,
      prenom: exploitationUser.prenom,
      role: exploitationUser.role,
      poste: exploitationUser.poste,
    });
  });

  // Middleware auth Admin Exploitation
  function exploitationAuthMiddleware(req: express.Request & { exploitationUser?: typeof exploitationUsers[0] }, res: express.Response, next: express.NextFunction) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const payload = verifyExploitationAccessToken(token);
    if (!payload) {
      res.status(401).json({ error: "Non authentifié (Admin Exploitation)" });
      return;
    }
    const exploitationUser = exploitationUsers.find((u) => u.id === payload.sub && u.statut === "ACTIF");
    if (!exploitationUser) {
      res.status(401).json({ error: "Utilisateur introuvable ou inactif" });
      return;
    }
    req.exploitationUser = exploitationUser;
    next();
  }

  app.get("/api/exploitation/me", exploitationAuthMiddleware, (req: express.Request & { exploitationUser?: typeof exploitationUsers[0] }, res) => {
    const u = req.exploitationUser!;
    res.json({ id: u.id, nom: u.nom, prenom: u.prenom, email: u.email, telephone: u.telephone, poste: u.poste, role: u.role });
  });

  app.get("/api/client/sites", clientAuthMiddleware, (req: express.Request & { clientContact?: typeof contacts[0] }, res) => {
    const entreprise = req.clientContact!.entreprise;
    res.json(sites.filter((s) => s.clientNom === entreprise && s.statut !== "ARCHIVE"));
  });

  // Upload image pour un site (client connecté, son propre site uniquement)
  const siteImageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype));
    },
  });
  app.post("/api/client/sites/:id/image", clientAuthMiddleware, siteImageUpload.single("image"), (req: ClientReq, res) => {
    const entreprise = req.clientContact!.entreprise;
    const id = Number(req.params.id);
    const site = sites.find((s) => s.id === id && s.clientNom === entreprise && s.statut !== "ARCHIVE");
    if (!site) { res.status(404).json({ error: "Site introuvable." }); return; }
    if (!req.file) { res.status(400).json({ error: "Aucun fichier fourni." }); return; }
    const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    site.imageDataUrl = dataUrl;
    res.json({ ok: true });
  });
  app.delete("/api/client/sites/:id/image", clientAuthMiddleware, (req: ClientReq, res) => {
    const entreprise = req.clientContact!.entreprise;
    const id = Number(req.params.id);
    const site = sites.find((s) => s.id === id && s.clientNom === entreprise);
    if (!site) { res.status(404).json({ error: "Site introuvable." }); return; }
    site.imageDataUrl = null;
    res.json({ ok: true });
  });

  app.get("/api/client/offres", clientAuthMiddleware, (req: express.Request & { clientContact?: typeof contacts[0] }, res) => {
    const entreprise = req.clientContact!.entreprise;
    res.json(offres.filter((o) => o.clientNom === entreprise));
  });

  app.get("/api/client/commandes", clientAuthMiddleware, (req: express.Request & { clientContact?: typeof contacts[0] }, res) => {
    const entreprise = req.clientContact!.entreprise;
    res.json(commandes.filter((c) => c.clientNom === entreprise));
  });

  app.get("/api/client/factures", clientAuthMiddleware, (req: express.Request & { clientContact?: typeof contacts[0] }, res) => {
    const entreprise = req.clientContact!.entreprise;
    res.json(factures.filter((f) => f.clientNom === entreprise));
  });

  app.post("/api/client/change-password", clientAuthMiddleware, async (req: express.Request & { clientContact?: typeof contacts[0] }, res) => {
    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
    const contact = req.clientContact!;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "Champs requis" });
      return;
    }
    if (!contact.clientPasswordHash || !(await verifyPassword(currentPassword, contact.clientPasswordHash))) {
      res.status(401).json({ error: "Mot de passe actuel incorrect" });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: "Le nouveau mot de passe doit faire au moins 8 caractères" });
      return;
    }
    contact.clientPasswordHash = await hashPassword(newPassword);
    res.json({ ok: true });
  });

  // ── Espace Client — Messagerie ─────────────────────────────────────────────
  type ClientReq = express.Request & { clientContact?: typeof contacts[0] };

  app.get("/api/client/messages", clientAuthMiddleware, (req: ClientReq, res) => {
    const entreprise = req.clientContact!.entreprise;
    const msgs = clientMessages
      .filter((m) => m.entreprise === entreprise)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    // group by threadId
    const threads = new Map<string, typeof msgs>();
    for (const m of msgs) {
      const list = threads.get(m.threadId) ?? [];
      list.push(m);
      threads.set(m.threadId, list);
    }
    const result = [...threads.entries()].map(([threadId, messages]) => ({
      threadId,
      subject: messages[0].subject,
      lastMessage: messages[messages.length - 1],
      messages,
      unreadCount: messages.filter((m) => m.senderType === "CRM" && !m.readByClient).length,
    }));
    result.sort((a, b) => b.lastMessage.createdAt.localeCompare(a.lastMessage.createdAt));
    res.json(result);
  });

  app.post("/api/client/messages", clientAuthMiddleware, (req: ClientReq, res) => {
    const { subject, body, threadId } = req.body as { subject?: string; body?: string; threadId?: string };
    if (!body?.trim()) { res.status(400).json({ error: "Message requis" }); return; }
    const contact = req.clientContact!;
    const tid = threadId || randomUUID();
    const id = Math.max(0, ...clientMessages.map((m) => m.id), 0) + 1;
    const msg = {
      id,
      threadId: tid,
      entreprise: contact.entreprise,
      subject: subject?.trim() || (threadId ? clientMessages.find((m) => m.threadId === threadId)?.subject ?? "Sans objet" : "Sans objet"),
      body: body.trim(),
      senderType: "CLIENT" as const,
      senderName: `${contact.prenom} ${contact.nom}`,
      senderEmail: contact.email,
      createdAt: new Date().toISOString(),
      readByClient: true,
      readByCrm: false,
    };
    clientMessages.push(msg);
    // notif CRM pour chaque admin/manager
    for (const u of users.filter((u) => u.role === "ADMIN" || u.role === "MANAGER")) {
      const nid = Math.max(0, ...crmNotifications.map((n) => n.id), 0) + 1;
      crmNotifications.push({ id: nid, userId: u.id, kind: "INFO", title: "Nouveau message client", message: `${contact.prenom} ${contact.nom} (${contact.entreprise}) : ${body.trim().slice(0, 80)}`, href: "/crm/messagerie-clients", entityType: "MESSAGE", entityId: id, read: false, createdAt: new Date().toISOString(), source: "system" });
    }
    res.json(msg);
  });

  app.patch("/api/client/messages/:threadId/read", clientAuthMiddleware, (req: ClientReq, res) => {
    const { threadId } = req.params;
    const entreprise = req.clientContact!.entreprise;
    for (const m of clientMessages) {
      if (m.threadId === threadId && m.entreprise === entreprise && m.senderType === "CRM") {
        m.readByClient = true;
      }
    }
    res.json({ ok: true });
  });

  // ── Espace Client — Documents ───────────────────────────────────────────────
  // Upload en mémoire → MinIO (avec fallback local si MinIO indisponible)
  const clientDocUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

  app.get("/api/client/documents", clientAuthMiddleware, (req: ClientReq, res) => {
    const entreprise = req.clientContact!.entreprise;
    const rawSiteId = (req.query as Record<string, string | undefined>).siteId;
    const siteId = rawSiteId != null && rawSiteId !== "" ? Number(rawSiteId) : null;

    let list = clientDocuments.filter((d) => d.entreprise === entreprise);
    if (Number.isFinite(siteId as number)) {
      list = list.filter((d) => d.siteId === siteId);
    }

    res.json(list.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)));
  });

  app.post("/api/client/documents", clientAuthMiddleware, clientDocUpload.single("file"), async (req: ClientReq, res) => {
    const file = (req as express.Request & { file?: Express.Multer.File }).file;
    if (!file) { res.status(400).json({ error: "Fichier requis" }); return; }
    const contact = req.clientContact!;
    const { type, nom, notes, offreId, commandeId, siteId } = req.body as Record<string, string>;
    const validTypes: ClientDocumentType[] = ["DEVIS", "BON_COMMANDE", "PLAN", "RAPPORT", "CERTIFICAT", "AUTRE"];
    const docType: ClientDocumentType = validTypes.includes(type as ClientDocumentType) ? (type as ClientDocumentType) : "AUTRE";
    const id = Math.max(0, ...clientDocuments.map((d) => d.id), 0) + 1;

    const parsedSiteId = siteId != null && String(siteId).trim() !== "" ? Number(siteId) : null;
    const safeName    = `${randomUUID()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const minioKey    = `client-docs/${safeName}`;
    let storedPath    = minioKey;

    try {
      await getMinio().putObject(MINIO_BUCKETS.clientDocs, safeName, file.buffer, file.size, { "Content-Type": file.mimetype });
    } catch (e) {
      // Fallback local
      const docsDir = path.resolve("uploads", "client-docs");
      fs.mkdirSync(docsDir, { recursive: true });
      storedPath = path.join(docsDir, safeName);
      fs.writeFileSync(storedPath, file.buffer);
      console.warn("[client-docs] MinIO indisponible, fallback local :", (e as Error).message);
    }

    const doc = {
      id,
      entreprise: contact.entreprise,
      contactId: contact.id,
      siteId: Number.isFinite(parsedSiteId as number) ? parsedSiteId : null,
      nom: nom?.trim() || file.originalname,
      type: docType,
      fileName: file.originalname,
      storedPath,
      sizeBytes: file.size,
      contentType: file.mimetype,
      uploadedAt: new Date().toISOString(),
      statut: "EN_ATTENTE" as const,
      motifRejet: null,
      validatedAt: null,
      offreId: offreId ? Number(offreId) : null,
      commandeId: commandeId ? Number(commandeId) : null,
      notes: notes?.trim() || null,
    };
    clientDocuments.push(doc);
    schedulePersistStore();
    res.json(doc);
  });

  app.delete("/api/client/documents/:id", clientAuthMiddleware, async (req: ClientReq, res) => {
    const id = Number(req.params.id);
    const entreprise = req.clientContact!.entreprise;
    const idx = clientDocuments.findIndex((d) => d.id === id && d.entreprise === entreprise);
    if (idx === -1) { res.status(404).json({ error: "Document introuvable" }); return; }
    const [doc] = clientDocuments.splice(idx, 1);
    try {
      if (doc.storedPath && !path.isAbsolute(doc.storedPath)) {
        const key = doc.storedPath.replace(/^client-docs\//, "");
        await getMinio().removeObject(MINIO_BUCKETS.clientDocs, key);
      } else if (doc.storedPath && fs.existsSync(doc.storedPath)) {
        fs.unlinkSync(doc.storedPath);
      }
    } catch { /* ignore */ }
    schedulePersistStore();
    res.json({ ok: true });
  });

  app.get("/api/client/documents/:id/download", clientAuthMiddleware, async (req: ClientReq, res) => {
    const id = Number(req.params.id);
    const entreprise = req.clientContact!.entreprise;
    const doc = clientDocuments.find((d) => d.id === id && d.entreprise === entreprise);
    if (!doc) { res.status(404).json({ error: "Fichier introuvable" }); return; }
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.fileName)}"`);
    res.setHeader("Content-Type", doc.contentType ?? "application/octet-stream");
    try {
      if (doc.storedPath && !path.isAbsolute(doc.storedPath)) {
        const key = doc.storedPath.replace(/^client-docs\//, "");
        const stream = await getMinio().getObject(MINIO_BUCKETS.clientDocs, key);
        stream.pipe(res);
      } else if (doc.storedPath && fs.existsSync(doc.storedPath)) {
        fs.createReadStream(doc.storedPath).pipe(res);
      } else {
        res.status(404).json({ error: "Fichier introuvable" });
      }
    } catch { res.status(404).json({ error: "Fichier introuvable" }); }
  });

  // ── Espace Client — Offre accept / refuse ───────────────────────────────────
  app.post("/api/client/offres/:id/accept", clientAuthMiddleware, (req: ClientReq, res) => {
    const id = Number(req.params.id);
    const contact = req.clientContact!;
    const offre = offres.find((o) => o.id === id && o.clientNom === contact.entreprise);
    if (!offre) { res.status(404).json({ error: "Offre introuvable" }); return; }
    if (offre.statut !== "ENVOYEE") { res.status(400).json({ error: "Cette offre ne peut plus être acceptée" }); return; }
    const { commentaire } = req.body as { commentaire?: string };
    offre.statut = "ACCEPTEE";
    offre.clientDecisionJson = JSON.stringify({ decision: "ACCEPTEE", decidedAt: new Date().toISOString(), decidedBy: `${contact.prenom} ${contact.nom}`, commentaire: commentaire?.trim() || null });
    // notif CRM
    const notifId = Math.max(0, ...clientNotifications.map((n) => n.id), 0) + 1;
    clientNotifications.push({ id: notifId, entreprise: contact.entreprise, title: "Offre acceptée", message: `${offre.numeroOffre} a été acceptée par ${contact.prenom} ${contact.nom}`, kind: "OFFRE_UPDATE", href: "/crm/offres", read: false, createdAt: new Date().toISOString() });
    res.json({ ok: true, offre });
  });

  app.post("/api/client/offres/:id/refuse", clientAuthMiddleware, (req: ClientReq, res) => {
    const id = Number(req.params.id);
    const contact = req.clientContact!;
    const offre = offres.find((o) => o.id === id && o.clientNom === contact.entreprise);
    if (!offre) { res.status(404).json({ error: "Offre introuvable" }); return; }
    if (offre.statut !== "ENVOYEE") { res.status(400).json({ error: "Cette offre ne peut plus être refusée" }); return; }
    const { commentaire } = req.body as { commentaire?: string };
    offre.statut = "REFUSEE";
    offre.clientDecisionJson = JSON.stringify({ decision: "REFUSEE", decidedAt: new Date().toISOString(), decidedBy: `${contact.prenom} ${contact.nom}`, commentaire: commentaire?.trim() || null });
    res.json({ ok: true, offre });
  });

  // ── Espace Client — Notifications ───────────────────────────────────────────
  app.get("/api/client/notifications", clientAuthMiddleware, (req: ClientReq, res) => {
    const entreprise = req.clientContact!.entreprise;
    const notifs = clientNotifications
      .filter((n) => n.entreprise === entreprise)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50);
    res.json({ notifications: notifs, unreadCount: notifs.filter((n) => !n.read).length });
  });

  app.patch("/api/client/notifications/:id/read", clientAuthMiddleware, (req: ClientReq, res) => {
    const id = Number(req.params.id);
    const entreprise = req.clientContact!.entreprise;
    const n = clientNotifications.find((n) => n.id === id && n.entreprise === entreprise);
    if (n) n.read = true;
    res.json({ ok: true });
  });

  app.post("/api/client/notifications/read-all", clientAuthMiddleware, (req: ClientReq, res) => {
    const entreprise = req.clientContact!.entreprise;
    for (const n of clientNotifications) {
      if (n.entreprise === entreprise) n.read = true;
    }
    res.json({ ok: true });
  });

  // ── Espace Client — Interventions & Pannes ──────────────────────────────────
  app.get("/api/client/interventions", clientAuthMiddleware, (req: ClientReq, res) => {
    const entreprise = req.clientContact!.entreprise;
    const siteId = req.query.siteId ? Number(req.query.siteId) : null;
    let rows = clientInterventions.filter((i) => i.entreprise === entreprise);
    if (siteId) rows = rows.filter((i) => i.siteId === siteId);
    res.json(rows.sort((a, b) => b.declaredAt.localeCompare(a.declaredAt)));
  });

  app.post("/api/client/interventions", clientAuthMiddleware, (req: ClientReq, res) => {
    const contact = req.clientContact!;
    const { siteId, equipementId, type, priorite, description } = req.body as {
      siteId?: number; equipementId?: number; type?: string; priorite?: string; description?: string;
    };
    if (!description?.trim()) return res.status(400).json({ error: "Description requise." });
    const site = siteId ? sites.find((s) => s.id === Number(siteId) && s.clientNom === contact.entreprise) : null;
    const equip = equipementId ? siteEquipements.find((e) => e.id === Number(equipementId)) : null;
    const year = new Date().getFullYear();
    const count = clientInterventions.filter((i) => i.reference.startsWith(`INT-${year}-`)).length + 1;
    const reference = `INT-${year}-${String(count).padStart(4, "0")}`;
    const id = Math.max(0, ...clientInterventions.map((i) => i.id)) + 1;
    const row: ClientInterventionRow = {
      id, entreprise: contact.entreprise, reference,
      siteId: site?.id ?? null, siteNom: site?.nom ?? "—",
      equipementId: equip?.id ?? null,
      equipementLibelle: equip ? `${equip.marque} ${equip.modele} (${equip.numeroSerie})` : null,
      type: (type ?? "PANNE") as ClientInterventionType,
      priorite: (priorite ?? "NORMALE") as ClientInterventionPriorite,
      statut: "CREEE", description: description.trim(),
      prestataire: null, declaredAt: new Date().toISOString(),
      assignedAt: null, resolvedAt: null, compteRendu: null,
      declaredByContactId: contact.id, declaredByName: `${contact.prenom} ${contact.nom}`,
    };
    clientInterventions.push(row);
    const notifId = Math.max(0, ...clientNotifications.map((n) => n.id)) + 1;
    clientNotifications.push({
      id: notifId, entreprise: contact.entreprise,
      title: `Déclaration enregistrée — ${reference}`,
      message: `${site?.nom ?? "Site non précisé"} : ${description.trim().slice(0, 80)}`,
      kind: "INFO", href: "/espace-client/interventions", read: false,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(row);
  });

  app.get("/api/client/equipements", clientAuthMiddleware, (req: ClientReq, res) => {
    const contact = req.clientContact!;
    const siteId = req.query.siteId ? Number(req.query.siteId) : null;
    if (!siteId) return res.json([]);
    const site = sites.find((s) => s.id === siteId && s.clientNom === contact.entreprise);
    if (!site) return res.json([]);
    res.json(
      siteEquipements
        .filter((e) => e.siteId === siteId)
        .map((e) => ({ id: e.id, libelle: `${e.marque} ${e.modele} (${e.numeroSerie})`, type: e.type, statut: e.statut })),
    );
  });

  // ── Espace Client — Config Alertes ──────────────────────────────────────────
  const defaultAlertesConfig = (entreprise: string): ClientAlertesConfig => ({
    entreprise,
    factureImpayee: true,
    factureImpayeeDelaiJours: 30,
    contratExpirant: true,
    panneSignalee: true,
    mmsSousSeuilCritique: true,
    mmsSeuil: 70,
    offreExpirant: true,
    visiteReglementaire: true,
    updatedAt: new Date().toISOString(),
  });

  app.get("/api/client/alertes-config", clientAuthMiddleware, (req: ClientReq, res) => {
    const entreprise = req.clientContact!.entreprise;
    const existing = clientAlertesConfigs.find((c) => c.entreprise === entreprise);
    res.json(existing ?? defaultAlertesConfig(entreprise));
  });

  app.post("/api/client/alertes-config", clientAuthMiddleware, (req: ClientReq, res) => {
    const entreprise = req.clientContact!.entreprise;
    const body = req.body as Partial<ClientAlertesConfig>;
    const idx = clientAlertesConfigs.findIndex((c) => c.entreprise === entreprise);
    const current = idx >= 0 ? clientAlertesConfigs[idx] : defaultAlertesConfig(entreprise);
    const updated: ClientAlertesConfig = {
      ...current,
      ...body,
      entreprise,
      updatedAt: new Date().toISOString(),
    };
    if (idx >= 0) clientAlertesConfigs[idx] = updated;
    else clientAlertesConfigs.push(updated);
    res.json(updated);
  });

  // ── Espace Client — Portail Réglementaire ───────────────────────────────────
  app.get("/api/client/reglementaire", clientAuthMiddleware, (req: ClientReq, res) => {
    const entreprise = req.clientContact!.entreprise;
    const clientSites = sites.filter((s) => s.clientNom === entreprise && s.statut !== "ARCHIVE");
    const siteIds = new Set(clientSites.map((s) => s.id));
    const equips = siteEquipements.filter((e) => siteIds.has(e.siteId) && e.statut !== "RETIRE");

    const today = new Date();
    const obligations = equips.flatMap((e) => {
      const site = clientSites.find((s) => s.id === e.siteId);
      const annee = e.anneeInstallation ?? 2010;
      const baseDate = new Date(`${annee}-01-01`);

      const obligations = [];

      // Contrôle périodique quinquennal (tous les 5 ans)
      const anneesDernier5 = Math.floor((today.getFullYear() - annee) / 5) * 5 + annee;
      const prochainControle5 = new Date(`${anneesDernier5 + 5}-01-01`);
      obligations.push({
        equipementId: e.id,
        siteNom: site?.nom ?? "—",
        equipementLibelle: `${e.marque} ${e.modele} (${e.numeroSerie})`,
        type: "CONTROLE_QUINQUENNAL",
        libelle: "Contrôle technique quinquennal",
        dateEcheance: prochainControle5.toISOString().slice(0, 10),
        organisme: "APAVE / Bureau Veritas",
        statut: prochainControle5 < today ? "EN_RETARD" : (prochainControle5.getTime() - today.getTime()) < 90 * 86400000 ? "PROCHE" : "OK",
      });

      // Visite de sécurité annuelle
      const prochainAnnuel = new Date(today.getFullYear(), today.getMonth() < 6 ? 5 : 11, 30);
      obligations.push({
        equipementId: e.id,
        siteNom: site?.nom ?? "—",
        equipementLibelle: `${e.marque} ${e.modele} (${e.numeroSerie})`,
        type: "VISITE_SECURITE",
        libelle: "Visite de sécurité annuelle",
        dateEcheance: prochainAnnuel.toISOString().slice(0, 10),
        organisme: "Prestataire de maintenance",
        statut: prochainAnnuel < today ? "EN_RETARD" : (prochainAnnuel.getTime() - today.getTime()) < 30 * 86400000 ? "PROCHE" : "OK",
      });

      return obligations;
    });

    const total = obligations.length;
    const enRetard = obligations.filter((o) => o.statut === "EN_RETARD").length;
    const proche = obligations.filter((o) => o.statut === "PROCHE").length;
    const conformes = total - enRetard - proche;
    const tauxConformite = total > 0 ? Math.round((conformes / total) * 100) : 100;

    obligations.sort((a, b) => a.dateEcheance.localeCompare(b.dateEcheance));
    res.json({ obligations, tauxConformite, total, enRetard, proche, conformes });
  });

  // ── Espace Client — Recouvrement & DSO ──────────────────────────────────────
  app.get("/api/client/recouvrement", clientAuthMiddleware, (req: ClientReq, res) => {
    const entreprise = req.clientContact!.entreprise;
    const today = new Date();
    const clientFactures = factures.filter((f) => f.clientNom === entreprise);

    const impayees = clientFactures
      .filter((f) => f.statutPaiement !== "PAYE" && f.statutPaiement !== undefined)
      .map((f) => {
        const echeance = f.dateEcheance ? new Date(f.dateEcheance) : null;
        const joursRetard = echeance ? Math.max(0, Math.ceil((today.getTime() - echeance.getTime()) / 86400000)) : 0;
        const restantDu = f.montantHt - (f.montantPaye ?? 0);
        return {
          id: f.id,
          numeroFacture: f.numeroFacture,
          montantHt: f.montantHt,
          restantDu,
          dateEcheance: f.dateEcheance,
          joursRetard,
          statutPaiement: f.statutPaiement,
          niveauRelance: f.niveauRelance,
          tranche: joursRetard === 0 ? "0-30" : joursRetard <= 30 ? "0-30" : joursRetard <= 60 ? "31-60" : joursRetard <= 90 ? "61-90" : "+90",
        };
      });

    const totalImpaye = impayees.reduce((s, f) => s + f.restantDu, 0);
    const totalFacture = clientFactures.reduce((s, f) => s + f.montantHt, 0);
    const totalPaye = clientFactures.filter((f) => f.statutPaiement === "PAYE").reduce((s, f) => s + f.montantHt, 0);

    const dso = totalFacture > 0
      ? Math.round((totalImpaye / (totalFacture / 12)) * 30)
      : 0;

    const tranches = {
      "0-30":  impayees.filter((f) => f.tranche === "0-30").reduce((s, f) => s + f.restantDu, 0),
      "31-60": impayees.filter((f) => f.tranche === "31-60").reduce((s, f) => s + f.restantDu, 0),
      "61-90": impayees.filter((f) => f.tranche === "61-90").reduce((s, f) => s + f.restantDu, 0),
      "+90":   impayees.filter((f) => f.tranche === "+90").reduce((s, f) => s + f.restantDu, 0),
    };

    res.json({ impayees, totalImpaye, totalPaye, totalFacture, dso, tranches });
  });

  // ── Espace Client — Analyse MMS ─────────────────────────────────────────────
  app.get("/api/client/mms", clientAuthMiddleware, (req: ClientReq, res) => {
    const entreprise = req.clientContact!.entreprise;
    const { annee, trimestre, prestataire, siteId } = req.query as Record<string, string | undefined>;
    let rows = mmsRapports.filter((r) => r.client === entreprise);
    if (annee)       rows = rows.filter((r) => String(r.annee) === annee);
    if (trimestre)   rows = rows.filter((r) => r.trimestre === trimestre);
    if (prestataire) rows = rows.filter((r) => r.prestataire === prestataire);
    if (siteId) {
      const sid = Number(siteId);
      rows = rows.filter((r) => r.siteId === sid);
    }
    rows = [...rows].sort((a, b) => {
      if (b.annee !== a.annee) return b.annee - a.annee;
      return b.trimestre.localeCompare(a.trimestre);
    });
    const mapped = rows.map((r) => ({
      id: r.id, prestataire: r.prestataire, trimestre: r.trimestre, annee: r.annee,
      nbAppareils: r.nbAppareils, nbInterventions: r.nbInterventions,
      nbPannes: r.nbPannes, nbVisites: r.nbVisites,
      penaliteTotale: r.penaliteTotale, createdAt: r.createdAt,
      scoreMms: r.nbVisites > 0
        ? Math.max(0, Math.round(100 - (r.nbPannes / r.nbVisites) * 100))
        : null,
      hasExcel: !!(r.excelPath && r.excelNom),
      hasWord:  !!(r.wordPath  && r.wordNom),
      hasPdf:   !!(r.pdfPath   && r.pdfNom),
      excelNom: r.excelNom ?? null,
      wordNom:  r.wordNom  ?? null,
      pdfNom:   r.pdfNom   ?? null,
    }));
    res.json(mapped);
  });

  // Téléchargement sécurisé des fichiers MMS pour le client
  app.get("/api/client/mms/:id/download/:type", clientAuthMiddleware, (req: ClientReq, res) => {
    const entreprise = req.clientContact!.entreprise;
    const id = Number(req.params.id);
    const rapport = mmsRapports.find((r) => r.id === id);
    if (!rapport || rapport.client !== entreprise) {
      res.status(404).json({ error: "Rapport introuvable." });
      return;
    }
    const fileType = req.params.type as "excel" | "word" | "pdf";
    const filePath = fileType === "excel" ? rapport.excelPath : fileType === "word" ? rapport.wordPath : rapport.pdfPath;
    const fileName = fileType === "excel" ? rapport.excelNom  : fileType === "word" ? rapport.wordNom  : rapport.pdfNom;
    if (!filePath || !fileName || !fs.existsSync(filePath)) {
      res.status(404).json({ error: "Fichier non disponible." });
      return;
    }
    const mime: Record<string, string> = {
      excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      word:  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      pdf:   "application/pdf",
    };
    res.setHeader("Content-Type", mime[fileType] ?? "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
    fs.createReadStream(filePath).pipe(res);
  });

  // ── Espace Client — Contrats ────────────────────────────────────────────────
  app.get("/api/client/contrats", clientAuthMiddleware, (req: ClientReq, res) => {
    const entreprise = req.clientContact!.entreprise;
    const rows = clientContrats
      .filter((c) => c.entreprise === entreprise)
      .sort((a, b) => a.dateFin.localeCompare(b.dateFin));
    res.json(rows);
  });

  app.post("/api/client/contrats/:id/renouvellement", clientAuthMiddleware, (req: ClientReq, res) => {
    const entreprise = req.clientContact!.entreprise;
    const id = Number(req.params.id);
    const contrat = clientContrats.find((c) => c.id === id && c.entreprise === entreprise);
    if (!contrat) return res.status(404).json({ error: "Contrat introuvable." });
    contrat.demandeRenouvellementAt = new Date().toISOString();
    if (contrat.statut === "ACTIF" || contrat.statut === "EXPIRE") contrat.statut = "EN_RENOUVELLEMENT";
    const notifId = Math.max(0, ...clientNotifications.map((n) => n.id)) + 1;
    clientNotifications.push({
      id: notifId, entreprise,
      title: `Demande de renouvellement — ${contrat.reference}`,
      message: `Votre demande de renouvellement pour "${contrat.intitule}" a été transmise à LVO Ingénierie.`,
      kind: "INFO", href: "/espace-client/contrats", read: false,
      createdAt: new Date().toISOString(),
    });
    res.json({ ok: true, contrat });
  });

  // Chemins gérés par l'espace Admin Exploitation (comptes séparés de l'Admin CRM) — voir crmOrExploitationMiddleware
  const EXPLOITATION_API_PREFIXES = [
    "/mms",
    "/devis-groupement",
    "/appareils",
    "/suivi-devis",
    "/appareils-arret",
    "/documents",
    "/emails",
    "/ocr",
    "/ia",
    "/fichiers",
    "/crm-client-documents",
  ];

  // ── Routes CRM (nécessitent token CRM, ou token Admin Exploitation pour les chemins ci-dessus) ──
  app.use("/api", (req, res, next) => {
    if (req.path.startsWith("/auth/")) return next();
    if (req.path.startsWith("/webhooks/")) return next();
    if (req.path.startsWith("/client-auth/")) return next();
    if (req.path.startsWith("/client/")) return next();
    if (req.path.startsWith("/ascensoriste-auth/")) return next();
    if (req.path.startsWith("/ascensoriste/")) return next();
    if (req.path.startsWith("/exploitation-auth/")) return next();
    if (req.path.startsWith("/exploitation/")) return next();
    crmOrExploitationMiddleware(EXPLOITATION_API_PREFIXES)(req, res, next);
  });

  app.use("/api/recouvrement", requireRoles("ADMIN", "MANAGER"), recouvrementRouter);
  app.use("/api/quonto", requireRoles("ADMIN", "MANAGER"), quontoRouter);
  app.use("/api/mms", mmsRouter);
  app.use("/api", ((req, res, next) => {
    // Les routes /api/client/* et /api/ascensoriste/* utilisent leur propre middleware — ne pas leur appliquer l'auth CRM
    if ((req as express.Request).path.startsWith("/client/")) { next(); return; }
    if ((req as express.Request).path.startsWith("/ascensoriste/")) { next(); return; }
    (crmOrExploitationMiddleware([""]) as express.RequestHandler)(req, res, next);
  }) as express.RequestHandler, devisGroupementRouter);
  app.use("/api", ((req, res, next) => {
    if ((req as express.Request).path.startsWith("/client/")) { next(); return; }
    if ((req as express.Request).path.startsWith("/ascensoriste/")) { next(); return; }
    (crmOrExploitationMiddleware([""]) as express.RequestHandler)(req, res, next);
  }) as express.RequestHandler, suiviDevisRouter);
  app.use("/api", ((req, res, next) => {
    if ((req as express.Request).path.startsWith("/client/")) { next(); return; }
    if ((req as express.Request).path.startsWith("/ascensoriste/")) { next(); return; }
    (crmOrExploitationMiddleware([""]) as express.RequestHandler)(req, res, next);
  }) as express.RequestHandler, appareilsArretRouter);
  app.use("/api", ((req, res, next) => {
    if ((req as express.Request).path.startsWith("/client/")) { next(); return; }
    if ((req as express.Request).path.startsWith("/ascensoriste/")) { next(); return; }
    (crmOrExploitationMiddleware(["/documents", "/emails", "/ocr", "/ia", "/fichiers"]) as express.RequestHandler)(req, res, next);
  }) as express.RequestHandler, crmRouter);

  // ── CRM — Messagerie clients ────────────────────────────────────────────────
  app.get("/api/messages-clients", authMiddleware, (_req, res) => {
    const threads = new Map<string, typeof clientMessages>();
    for (const m of clientMessages.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      const list = threads.get(m.threadId) ?? [];
      list.push(m);
      threads.set(m.threadId, list);
    }
    const result = [...threads.entries()].map(([threadId, messages]) => ({
      threadId,
      entreprise: messages[0].entreprise,
      subject: messages[0].subject,
      lastMessage: messages[messages.length - 1],
      messages,
      unreadCount: messages.filter((m) => m.senderType === "CLIENT" && !m.readByCrm).length,
    }));
    result.sort((a, b) => b.lastMessage.createdAt.localeCompare(a.lastMessage.createdAt));
    res.json(result);
  });

  app.post("/api/messages-clients/:threadId/reply", authMiddleware, (req, res) => {
    const { threadId } = req.params;
    const { body } = req.body as { body?: string };
    if (!body?.trim()) { res.status(400).json({ error: "Message requis" }); return; }
    const thread = clientMessages.filter((m) => m.threadId === threadId);
    if (!thread.length) { res.status(404).json({ error: "Thread introuvable" }); return; }
    const auth = (req as express.Request & { auth?: { email?: string } }).auth;
    const u = users.find((u) => u.email === auth?.email);
    const senderName = u ? `${u.prenom ?? ""} ${u.nom ?? ""}`.trim() || u.email : "LVO";
    const id = Math.max(0, ...clientMessages.map((m) => m.id), 0) + 1;
    const msg = {
      id,
      threadId,
      entreprise: thread[0].entreprise,
      subject: thread[0].subject,
      body: body.trim(),
      senderType: "CRM" as const,
      senderName,
      senderEmail: auth?.email ?? "crm@lvo-ing.fr",
      createdAt: new Date().toISOString(),
      readByClient: false,
      readByCrm: true,
    };
    clientMessages.push(msg);
    // mark thread as read by CRM
    for (const m of thread) { if (m.senderType === "CLIENT") m.readByCrm = true; }
    // notification client
    const notifId = Math.max(0, ...clientNotifications.map((n) => n.id), 0) + 1;
    clientNotifications.push({ id: notifId, entreprise: thread[0].entreprise, title: "Nouveau message de LVO", message: body.trim().slice(0, 120), kind: "MESSAGE", href: "/espace-client/messagerie", read: false, createdAt: new Date().toISOString() });
    res.json(msg);
  });

  app.patch("/api/messages-clients/:threadId/read", authMiddleware, (req, res) => {
    const { threadId } = req.params;
    for (const m of clientMessages) {
      if (m.threadId === threadId && m.senderType === "CLIENT") m.readByCrm = true;
    }
    res.json({ ok: true });
  });

  // ── Devis Groupement — Routes espace client ───────────────────────────────
  const devisClientUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });
  registerClientDevisRoutes(app, clientAuthMiddleware as express.RequestHandler, devisClientUpload);

  // ── Devis Groupement — Routes espace ascensoriste ──────────────────────────
  registerAscensoristeDevisRoutes(app, ascensoristeAuthMiddleware as express.RequestHandler, devisClientUpload);

  // ── Appareils à l'arrêt — Routes espace ascensoriste et espace client ──────
  registerAscensoristeAppareilsArretRoutes(app, ascensoristeAuthMiddleware as express.RequestHandler);
  registerClientAppareilsArretRoutes(app, clientAuthMiddleware as express.RequestHandler);

  // ── CRM — Documents déposés par les clients (accès admin CRM ou Admin Exploitation) ──
  const crmClientDocumentsAuth = crmOrExploitationMiddleware(["/api/crm-client-documents"]) as express.RequestHandler;
  app.get("/api/crm-client-documents", crmClientDocumentsAuth, (req, res) => {
    const { entreprise, type } = req.query as Record<string, string | undefined>;
    let list = [...clientDocuments].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
    if (entreprise) list = list.filter((d) => d.entreprise === entreprise);
    if (type) list = list.filter((d) => d.type === type);
    res.json(list.map(({ storedPath, ...rest }) => rest));
  });

  app.get("/api/crm-client-documents/:id/download", crmClientDocumentsAuth, async (req, res) => {
    const id = Number(req.params.id);
    const doc = clientDocuments.find((d) => d.id === id);
    if (!doc) { res.status(404).json({ error: "Fichier introuvable" }); return; }
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.fileName)}"`);
    res.setHeader("Content-Type", doc.contentType ?? "application/octet-stream");
    try {
      if (doc.storedPath && !path.isAbsolute(doc.storedPath)) {
        const key = doc.storedPath.replace(/^client-docs\//, "");
        const stream = await getMinio().getObject(MINIO_BUCKETS.clientDocs, key);
        stream.pipe(res);
      } else if (doc.storedPath && fs.existsSync(doc.storedPath)) {
        fs.createReadStream(doc.storedPath).pipe(res);
      } else {
        res.status(404).json({ error: "Fichier introuvable" });
      }
    } catch { res.status(404).json({ error: "Fichier introuvable" }); }
  });

  app.delete("/api/crm-client-documents/:id", crmClientDocumentsAuth, requireRoles("ADMIN", "MANAGER"), async (req, res) => {
    const id = Number(req.params.id);
    const idx = clientDocuments.findIndex((d) => d.id === id);
    if (idx === -1) { res.status(404).json({ error: "Document introuvable" }); return; }
    const [doc] = clientDocuments.splice(idx, 1);
    try {
      if (doc.storedPath && !path.isAbsolute(doc.storedPath)) {
        const key = doc.storedPath.replace(/^client-docs\//, "");
        await getMinio().removeObject(MINIO_BUCKETS.clientDocs, key);
      } else if (doc.storedPath && fs.existsSync(doc.storedPath)) {
        fs.unlinkSync(doc.storedPath);
      }
    } catch { /* ignore */ }
    schedulePersistStore();
    res.json({ ok: true });
  });

  app.patch("/api/crm-client-documents/:id/validate", crmClientDocumentsAuth, requireRoles("ADMIN", "MANAGER"), (req, res) => {
    const id = Number(req.params.id);
    const doc = clientDocuments.find((d) => d.id === id);
    if (!doc) { res.status(404).json({ error: "Document introuvable" }); return; }
    doc.statut = "VALIDE";
    doc.motifRejet = null;
    doc.validatedAt = new Date().toISOString();
    const notifId = Math.max(0, ...clientNotifications.map((n) => n.id), 0) + 1;
    clientNotifications.push({
      id: notifId,
      entreprise: doc.entreprise,
      title: "Document validé",
      message: `Votre document « ${doc.nom} » a été validé.`,
      kind: "DOCUMENT",
      href: "/espace-client/documents",
      read: false,
      createdAt: new Date().toISOString(),
    });
    res.json({ ok: true });
  });

  app.patch("/api/crm-client-documents/:id/reject", crmClientDocumentsAuth, requireRoles("ADMIN", "MANAGER"), (req, res) => {
    const id = Number(req.params.id);
    const doc = clientDocuments.find((d) => d.id === id);
    if (!doc) { res.status(404).json({ error: "Document introuvable" }); return; }
    const { motif } = req.body as { motif?: string };
    doc.statut = "REJETE";
    doc.motifRejet = motif?.trim() || null;
    doc.validatedAt = null;
    const notifId = Math.max(0, ...clientNotifications.map((n) => n.id), 0) + 1;
    clientNotifications.push({
      id: notifId,
      entreprise: doc.entreprise,
      title: "Document refusé",
      message: `Votre document « ${doc.nom} » a été refusé${doc.motifRejet ? ` : ${doc.motifRejet}` : ""}.`,
      kind: "DOCUMENT",
      href: "/espace-client/documents",
      read: false,
      createdAt: new Date().toISOString(),
    });
    res.json({ ok: true });
  });

  app.post("/api/crm/push-client-notification", authMiddleware, (req, res) => {
    const { entreprise, title, message, kind, href } = req.body as { entreprise?: string; title?: string; message?: string; kind?: string; href?: string };
    if (!entreprise || !title || !message) { res.status(400).json({ error: "entreprise, title, message requis" }); return; }
    const id = Math.max(0, ...clientNotifications.map((n) => n.id), 0) + 1;
    const validKinds = ["MESSAGE", "OFFRE_UPDATE", "FACTURE", "DOCUMENT", "INFO"];
    clientNotifications.push({ id, entreprise, title, message, kind: (validKinds.includes(kind ?? "") ? kind : "INFO") as never, href: href ?? null, read: false, createdAt: new Date().toISOString() });
    res.json({ ok: true, id });
  });

  // ── Reset des données de test : Devis Groupement, Suivi, Appareils à l'arrêt, ───
  // Ascensoristes, et tout le périmètre commercial CRM lié aux clients (cascade).
  // Conserve les comptes utilisateurs (CRM + Exploitation) et les paramètres.
  app.post("/api/admin/reset-test-data", authMiddleware, requireRoles("ADMIN"), async (_req, res) => {
    appareils.length = 0;
    devisGroupement.length = 0;
    negociationMessages.length = 0;
    appareilsArretUploads.length = 0;
    appareilsArretRows.length = 0;
    ascensoristes.length = 0;

    clients.length = 0;
    contacts.length = 0;
    sites.length = 0;
    siteGestionnaires.length = 0;
    siteEquipements.length = 0;
    siteArborescenceNodes.length = 0;
    offres.length = 0;
    commandes.length = 0;
    factures.length = 0;
    historiqueAnnulations.length = 0;
    avoirs.length = 0;
    pendingQuonto.length = 0;
    crmTasks.length = 0;
    crmNotifications.length = 0;
    clientMessages.length = 0;
    clientDocuments.length = 0;
    clientNotifications.length = 0;
    clientInterventions.length = 0;
    clientContrats.length = 0;
    clientAlertesConfigs.length = 0;
    offreSignatures.clear();

    await persistStore();
    res.json({ ok: true, message: "Données de test réinitialisées (devis, suivi, appareils à l'arrêt, ascensoristes, périmètre clients CRM)." });
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "lvo-api-server", storage: "file-backed", snapshot: storeSnapshotPath() });
  });

  app.get("/health/db", async (_req, res) => {
    const db = await checkDatabase();
    res.status(db.ok ? 200 : 503).json(db);
  });

  app.listen(PORT, () => {
    console.log(`LVO API listening on http://localhost:${PORT}`);
    console.log("Comptes démo : admin@lvo-ing.fr / lvo123 (ADMIN), manager@lvo-ing.fr / lvo123 (MANAGER), consultant@ / viewer@ — mot de passe lvo123");
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
