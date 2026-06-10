import crypto from "node:crypto";
import cors from "cors";
import express from "express";

import { consumeRefreshToken, hashPassword, issueRefreshToken, signAccessToken, verifyPassword } from "./auth.js";
import { authMiddleware, requireRoles } from "./middleware.js";
import { crmRouter } from "./routes/crm.js";
import { quontoRouter } from "./routes/quonto.js";
import { recouvrementRouter } from "./routes/recouvrement.js";
import { checkDatabase } from "./db-health.js";
import { provisionSiteArborescence } from "./site-arborescence.js";
import { isQuontoProcessed, markQuontoProcessed, pendingQuonto, seedStore, sites, users } from "./store.js";

const PORT = Number(process.env.API_PORT) || 8080;

async function main() {
  await seedStore(async (plain) => hashPassword(plain));
  for (const s of sites) provisionSiteArborescence(s.id);

  const app = express();
  app.use(cors({ origin: true, credentials: true }));

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

  app.use("/api", (req, res, next) => {
    if (req.path.startsWith("/auth/")) return next();
    if (req.path.startsWith("/webhooks/")) return next();
    authMiddleware(req, res, next);
  });

  app.use("/api/recouvrement", requireRoles("ADMIN", "MANAGER"), recouvrementRouter);
  app.use("/api/quonto", requireRoles("ADMIN", "MANAGER"), quontoRouter);
  app.use("/api", crmRouter);

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "lvo-api-server", storage: "in-memory" });
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
