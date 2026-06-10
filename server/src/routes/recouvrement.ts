import express from "express";

import { factures, pendingQuonto } from "../store.js";

export const recouvrementRouter = express.Router();

function joursRetard(dateEcheance: string | null): number {
  if (!dateEcheance) return 0;
  const d = new Date(dateEcheance + "T12:00:00");
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - d.getTime()) / 86400000);
}

function montantTtc(ht: number, frais: number) {
  return Math.round((ht + frais) * 1.2 * 100) / 100;
}

recouvrementRouter.get("/kpis", (_req, res) => {
  const imp = factures.filter((f) => f.statutPaiement !== "PAYE");
  const totalImpayeHt = imp.reduce((s, f) => s + f.montantHt + f.frais, 0);
  const facturesEnRetard = imp.filter((f) => joursRetard(f.dateEcheance) > 0).length;

  const byClient: Record<string, number> = {};
  for (const f of imp) {
    if (joursRetard(f.dateEcheance) <= 0) continue;
    byClient[f.clientNom] = (byClient[f.clientNom] || 0) + f.montantHt;
  }
  const topClientsEnRetard = Object.entries(byClient)
    .map(([clientNom, montantHt]) => ({ clientNom, montantHt }))
    .sort((a, b) => b.montantHt - a.montantHt)
    .slice(0, 5);

  const dsoJours = 38;

  res.json({
    totalImpayeHt,
    totalImpayeTtc: Math.round(totalImpayeHt * 1.2 * 100) / 100,
    facturesEnRetard,
    dsoJours,
    topClientsEnRetard,
  });
});

recouvrementRouter.get("/factures-impayees", (_req, res) => {
  const rows = factures
    .filter((f) => f.statutPaiement !== "PAYE")
    .map((f) => ({
      id: f.id,
      numeroFacture: f.numeroFacture,
      clientNom: f.clientNom,
      montantHt: f.montantHt,
      montantTtc: montantTtc(f.montantHt, f.frais),
      dateFacture: f.dateFacture,
      dateEcheance: f.dateEcheance,
      joursRetard: joursRetard(f.dateEcheance),
      niveauRelance: f.niveauRelance,
      statutPaiement: f.statutPaiement,
    }));
  res.json(rows);
});

recouvrementRouter.get("/transactions-en-attente", (_req, res) => {
  res.json(
    pendingQuonto
      .filter((t) => t.score >= 60 && t.score < 90)
      .map((t) => ({
        id: t.id,
        libelle: t.libelle,
        montant: t.montant,
        dateOperation: t.dateOperation,
        score: t.score,
      })),
  );
});

recouvrementRouter.post("/factures/:id/relance", (req, res) => {
  const id = Number(req.params.id);
  const f = factures.find((x) => x.id === id);
  if (!f) return res.status(404).json({ error: "Facture introuvable" });
  f.niveauRelance = Math.min(3, f.niveauRelance + 1);
  f.derniereRelanceAt = new Date().toISOString();
  res.json({ ok: true, niveauRelance: f.niveauRelance });
});

recouvrementRouter.post("/factures/:id/payer-manuel", (req, res) => {
  const id = Number(req.params.id);
  const f = factures.find((x) => x.id === id);
  if (!f) return res.status(404).json({ error: "Facture introuvable" });
  const body = req.body as { montant?: number; source?: string };
  const montant = Number(body.montant) || 0;
  const ttc = montantTtc(f.montantHt, f.frais);
  f.montantPaye = montant;
  if (montant >= ttc - 0.02) {
    f.statutPaiement = "PAYE";
    f.statutFacturation = "PAYEE";
  } else if (montant > 0) {
    f.statutPaiement = "PARTIELLEMENT_PAYE";
  }
  res.json({ ok: true, statutPaiement: f.statutPaiement });
});

recouvrementRouter.post("/transactions/:txId/rapprocher", (req, res) => {
  const txId = Number(req.params.txId);
  const factureId = Number((req.body as { factureId?: number }).factureId);
  const tx = pendingQuonto.find((t) => t.id === txId);
  const f = factures.find((x) => x.id === factureId);
  if (!tx || !f) return res.status(400).json({ error: "Transaction ou facture invalide" });
  const i = pendingQuonto.indexOf(tx);
  if (i >= 0) pendingQuonto.splice(i, 1);
  f.statutPaiement = "PAYE";
  f.montantPaye = montantTtc(f.montantHt, f.frais);
  f.statutFacturation = "PAYEE";
  res.json({ ok: true });
});

recouvrementRouter.post("/transactions/:txId/ignorer", (req, res) => {
  const txId = Number(req.params.txId);
  const i = pendingQuonto.findIndex((t) => t.id === txId);
  if (i < 0) return res.status(404).json({ error: "Transaction introuvable" });
  pendingQuonto.splice(i, 1);
  res.json({ ok: true });
});

recouvrementRouter.post("/sync-demo", (_req, res) => {
  res.json({ ok: true, message: "utiliser POST /api/quonto/sync-now" });
});
