/**
 * API interne serveur-à-serveur, consommée par l'ancien projet (site public + portails
 * client/ascensoriste/exploitation) une fois la Phase 3 de la migration réalisée : ces
 * portails n'ont plus d'accès direct à la base CRM et passent par ces routes à la place.
 * Protégée par un secret partagé (CRM_SERVICE_TOKEN), distinct des tokens utilisateur.
 */
import express from "express";

import * as crmClient from "./crm-client.js";

export const internalApiRouter = express.Router();

internalApiRouter.use((req, res, next) => {
  const expected = process.env.CRM_SERVICE_TOKEN;
  const provided = req.headers["x-service-token"];
  if (!expected || provided !== expected) {
    res.status(401).json({ error: "Service non autorisé" });
    return;
  }
  next();
});

internalApiRouter.use(express.json({ limit: "2mb" }));

// ── Identité / auth ──────────────────────────────────────────────────────────
internalApiRouter.get("/contacts/by-email/:email", (req, res) => {
  const contact = crmClient.findActiveContactByEmail(String(req.params.email).toLowerCase());
  res.json(contact ?? null);
});
internalApiRouter.get("/contacts/:id", (req, res) => {
  const contact = crmClient.findActiveContactById(Number(req.params.id));
  res.json(contact ?? null);
});
internalApiRouter.get("/ascensoristes/by-email/:email", (req, res) => {
  const a = crmClient.findActiveAscensoristeByEmail(String(req.params.email).toLowerCase());
  res.json(a ?? null);
});
internalApiRouter.get("/ascensoristes/:id", (req, res) => {
  const a = crmClient.findActiveAscensoristeById(Number(req.params.id));
  res.json(a ?? null);
});
internalApiRouter.get("/users/by-email/:email", (req, res) => {
  const u = crmClient.findUserByEmail(String(req.params.email).toLowerCase());
  res.json(u ?? null);
});
internalApiRouter.get("/users/:id", (req, res) => {
  const u = crmClient.findUserById(Number(req.params.id));
  res.json(u ?? null);
});
internalApiRouter.get("/users/staff/list", (_req, res) => {
  res.json(crmClient.getCrmStaffUsers());
});

// ── Sites & équipements ───────────────────────────────────────────────────────
internalApiRouter.get("/sites", (req, res) => {
  res.json(crmClient.getSitesForClient(String(req.query.entreprise || "")));
});
internalApiRouter.get("/sites/:id", (req, res) => {
  const entreprise = String(req.query.entreprise || "");
  const activeOnly = req.query.activeOnly !== "false";
  const site = activeOnly
    ? crmClient.findActiveClientSite(Number(req.params.id), entreprise)
    : crmClient.findClientSite(Number(req.params.id), entreprise);
  res.json(site ?? null);
});
internalApiRouter.post("/sites/:id/image", (req, res) => {
  const { entreprise, dataUrl } = req.body as { entreprise?: string; dataUrl?: string | null };
  const ok = crmClient.setClientSiteImage(Number(req.params.id), String(entreprise || ""), dataUrl ?? null);
  res.json({ ok });
});
internalApiRouter.get("/site-equipements", (req, res) => {
  res.json(crmClient.getSiteEquipementsForSite(Number(req.query.siteId)));
});
internalApiRouter.get("/site-equipements/:id", (req, res) => {
  res.json(crmClient.findSiteEquipementById(Number(req.params.id)) ?? null);
});
internalApiRouter.post("/site-equipements/active-for-sites", (req, res) => {
  const { siteIds } = req.body as { siteIds?: number[] };
  res.json(crmClient.getActiveSiteEquipementsForSites(new Set(siteIds ?? [])));
});

// ── Offres / commandes / factures ────────────────────────────────────────────
internalApiRouter.get("/offres", (req, res) => {
  res.json(crmClient.getOffresForClient(String(req.query.entreprise || "")));
});
internalApiRouter.get("/offres/:id", (req, res) => {
  const offre = crmClient.findClientOffre(Number(req.params.id), String(req.query.entreprise || ""));
  res.json(offre ?? null);
});
internalApiRouter.post("/offres/:id/decision", (req, res) => {
  const { entreprise, decision, commentaire, decidedBy } = req.body as {
    entreprise?: string; decision?: "ACCEPTEE" | "REFUSEE"; commentaire?: string; decidedBy?: string;
  };
  const offre = crmClient.findClientOffre(Number(req.params.id), String(entreprise || ""));
  if (!offre) { res.status(404).json({ error: "Offre introuvable" }); return; }
  if (offre.statut !== "ENVOYEE") { res.status(400).json({ error: "Cette offre ne peut plus être modifiée" }); return; }
  offre.statut = decision === "ACCEPTEE" ? "ACCEPTEE" : "REFUSEE";
  offre.clientDecisionJson = JSON.stringify({ decision, decidedAt: new Date().toISOString(), decidedBy: decidedBy || null, commentaire: commentaire?.trim() || null });
  res.json(offre);
});
internalApiRouter.get("/commandes", (req, res) => {
  res.json(crmClient.getCommandesForClient(String(req.query.entreprise || "")));
});
internalApiRouter.get("/factures", (req, res) => {
  res.json(crmClient.getFacturesForClient(String(req.query.entreprise || "")));
});

// ── Messagerie client <-> CRM ─────────────────────────────────────────────────
internalApiRouter.get("/messages/threads", (req, res) => {
  res.json(crmClient.getMessageThreadsForClient(String(req.query.entreprise || "")));
});
internalApiRouter.get("/messages/threads/all", (_req, res) => {
  res.json(crmClient.getAllMessageThreads());
});
internalApiRouter.get("/messages/thread/:threadId", (req, res) => {
  res.json(crmClient.findThreadMessages(req.params.threadId));
});
internalApiRouter.post("/messages", (req, res) => {
  const msg = req.body;
  crmClient.addClientMessage(msg);
  res.json(msg);
});
internalApiRouter.get("/messages/next-id", (_req, res) => {
  res.json({ id: crmClient.nextClientMessageId() });
});
internalApiRouter.get("/messages/thread/:threadId/subject", (req, res) => {
  res.json({ subject: crmClient.findThreadSubject(req.params.threadId) ?? null });
});
internalApiRouter.patch("/messages/thread/:threadId/read-by-client", (req, res) => {
  const { entreprise } = req.body as { entreprise?: string };
  crmClient.markThreadReadByClient(req.params.threadId, String(entreprise || ""));
  res.json({ ok: true });
});
internalApiRouter.patch("/messages/thread/:threadId/read-by-crm", (_req, res) => {
  crmClient.markThreadReadByCrm(_req.params.threadId);
  res.json({ ok: true });
});

// ── Documents client ──────────────────────────────────────────────────────────
internalApiRouter.get("/client-documents", (req, res) => {
  const { entreprise, siteId } = req.query as Record<string, string | undefined>;
  res.json(crmClient.getClientDocuments(String(entreprise || ""), siteId ? Number(siteId) : null));
});
internalApiRouter.get("/client-documents/all", (req, res) => {
  const { entreprise, type } = req.query as Record<string, string | undefined>;
  res.json(crmClient.getAllClientDocuments({ entreprise, type }));
});
internalApiRouter.get("/client-documents/:id", (req, res) => {
  const entreprise = req.query.entreprise as string | undefined;
  res.json(crmClient.findClientDocument(Number(req.params.id), entreprise) ?? null);
});
internalApiRouter.post("/client-documents", (req, res) => {
  const doc = req.body;
  crmClient.addClientDocument(doc);
  res.json(doc);
});
internalApiRouter.delete("/client-documents/:id", (req, res) => {
  const entreprise = req.query.entreprise as string | undefined;
  const doc = crmClient.removeClientDocument(Number(req.params.id), entreprise);
  res.json(doc ?? null);
});
internalApiRouter.get("/client-documents/next-id", (_req, res) => {
  res.json({ id: crmClient.nextClientDocumentId() });
});
internalApiRouter.patch("/client-documents/:id/validate", (req, res) => {
  res.json(crmClient.validateClientDocument(Number(req.params.id)) ?? null);
});
internalApiRouter.patch("/client-documents/:id/reject", (req, res) => {
  const { motif } = req.body as { motif?: string | null };
  res.json(crmClient.rejectClientDocument(Number(req.params.id), motif ?? null) ?? null);
});

// ── Notifications client ──────────────────────────────────────────────────────
internalApiRouter.get("/client-notifications", (req, res) => {
  res.json(crmClient.getClientNotifications(String(req.query.entreprise || "")));
});
internalApiRouter.patch("/client-notifications/:id/read", (req, res) => {
  const { entreprise } = req.body as { entreprise?: string };
  crmClient.markClientNotificationRead(Number(req.params.id), String(entreprise || ""));
  res.json({ ok: true });
});
internalApiRouter.post("/client-notifications/read-all", (req, res) => {
  const { entreprise } = req.body as { entreprise?: string };
  crmClient.markAllClientNotificationsRead(String(entreprise || ""));
  res.json({ ok: true });
});
internalApiRouter.post("/client-notifications", (req, res) => {
  res.json(crmClient.pushClientNotification(req.body));
});

// ── Notifications CRM ─────────────────────────────────────────────────────────
internalApiRouter.post("/crm-notifications", (req, res) => {
  res.json(crmClient.pushCrmNotification(req.body));
});
