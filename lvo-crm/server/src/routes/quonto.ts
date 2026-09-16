import express from "express";

import { pendingQuonto } from "../store.js";

export const quontoRouter = express.Router();

quontoRouter.post("/sync-now", (_req, res) => {
  if (pendingQuonto.length < 4) {
    const id = Math.max(0, ...pendingQuonto.map((t) => t.id), 0) + 1;
    pendingQuonto.push({
      id,
      libelle: `Virement sync ${new Date().toISOString().slice(0, 10)} LVO-F2026-003`,
      montant: 7260,
      dateOperation: new Date().toISOString().slice(0, 10),
      score: 68,
      quontoTransactionId: `qonto-sync-${id}`,
    });
  }
  res.json({ ok: true, pending: pendingQuonto.length });
});
