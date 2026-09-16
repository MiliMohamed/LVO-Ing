import crypto from "node:crypto";
import cors from "cors";
import express from "express";

import {
  consumeRefreshToken,
  hashPassword,
  issueRefreshToken,
  signAccessToken,
  verifyPassword,
} from "./auth.js";
import { authMiddleware, crmOrExploitationMiddleware, requireRoles } from "./middleware.js";
import { crmRouter, sweepEcheancesEnRetard } from "./routes/crm.js";
import { quontoRouter } from "./routes/quonto.js";
import { recouvrementRouter } from "./routes/recouvrement.js";
import { internalApiRouter } from "./internal-api.js";
import { checkDatabase } from "./db-health.js";
import { loadStoreSnapshot, persistStore, schedulePersistStore, storeSnapshotPath } from "./store-persist.js";
import { provisionSiteArborescence } from "./site-arborescence.js";
import { ensureMinioBuckets } from "./db.js";
import {
  users,
  sites,
  isQuontoProcessed,
  markQuontoProcessed,
  pendingQuonto,
  seedStore,
  ensureDefaultGroupementClients,
  ensureDefaultTypesEquipement,
} from "./store.js";

const PORT = Number(process.env.API_PORT) || 8081;

// Chemins de crm.ts accessibles aussi par un token Admin Exploitation (ancien projet) —
// même liste que dans l'ancien server/src/index.ts pour ces préfixes précis.
const EXPLOITATION_ALLOWED_PREFIXES = ["/documents", "/emails", "/ocr", "/ia", "/fichiers"];

async function main() {
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
  }
  if (ensureDefaultTypesEquipement()) {
    await persistStore();
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

  // ── Auth CRM ─────────────────────────────────────────────────────────────
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

  // ── API interne (Phase 3 — consommée par l'ancien projet, secret de service) ──
  app.use("/internal", internalApiRouter);

  // ── Routes CRM (token CRM, ou token Admin Exploitation pour les préfixes ci-dessus) ──
  app.use("/api", ((req, res, next) => {
    if (req.path.startsWith("/auth/")) return next();
    if (req.path.startsWith("/webhooks/")) return next();
    crmOrExploitationMiddleware(EXPLOITATION_ALLOWED_PREFIXES)(req, res, next);
  }) as express.RequestHandler);

  app.use("/api/recouvrement", requireRoles("ADMIN", "MANAGER"), recouvrementRouter);
  app.use("/api/quonto", requireRoles("ADMIN", "MANAGER"), quontoRouter);
  app.use("/api", crmRouter);

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "lvo-crm-server", storage: "file-backed", snapshot: storeSnapshotPath() });
  });

  app.get("/health/db", async (_req, res) => {
    const db = await checkDatabase();
    res.status(db.ok ? 200 : 503).json(db);
  });

  app.listen(PORT, () => {
    console.log(`LVO CRM API listening on http://localhost:${PORT}`);
    const facturedAuDemarrage = sweepEcheancesEnRetard();
    if (facturedAuDemarrage > 0) {
      console.log(`[echeancier] ${facturedAuDemarrage} échéance(s) facturée(s) automatiquement au démarrage.`);
      schedulePersistStore();
    }
    setInterval(() => {
      const n = sweepEcheancesEnRetard();
      if (n > 0) {
        console.log(`[echeancier] ${n} échéance(s) facturée(s) automatiquement.`);
        schedulePersistStore();
      }
    }, 60 * 60 * 1000);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
