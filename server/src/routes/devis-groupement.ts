import fs from "node:fs";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { overlaySignatureOnPdf } from "../pdf-overlay.js";
import ExcelJS from "exceljs";
import { pieChartSvg, barChartSvg, type ChartSlice } from "../excel-charts.js";
import {
  NAVY,
  ORANGE,
  addBrandBanner,
  addImageFromSvg,
  styleHeaderRow,
  zebraStripe,
} from "../lib/excel-style.js";

const execFileAsync = promisify(execFile);

import express from "express";
import multer from "multer";

import type { AuthedRequest } from "../middleware.js";
import { requireRoles } from "../middleware.js";
import {
  appareils,
  devisGroupement,
  negociationMessages,
  clientNotifications,
  type AppareilRow,
  type DevisGroupementRow,
  type DevisGroupementStatut,
  type NegociationMessageRow,
  type PvFichierRow,
  type BonCommandeExtractionRow,
} from "../store.js";
import { getMinio, MINIO_BUCKETS } from "../db.js";
import { schedulePersistStore } from "../store-persist.js";
import { sendMail, getAdminEmails, getClientEmails, getAscensoristeEmail, renderMailHtml } from "../lib/mailer.js";

// ─── Extracteur PDF Python ────────────────────────────────────────────────────

type ExtractedDevis = {
  numero_devis: string | null;
  marque: string | null;
  numero_appareil: string | null;
  date_devis: string | null;
  objet: string | null;
  batiment: string | null;
  adresse: string | null;
  montant_ht: number | null;
  taux_tva: number;
  montant_tva: number | null;
  montant_ttc: number | null;
  ascenseur_arret: boolean;
  client_nom: string | null;
  motif: string | null;
  error?: string;
};

const MARQUE_LABEL: Record<string, string> = {
  OTIS: "OTIS",
  CEGELEC: "CEGELEC",
  RIVIERE_SCHINDLER: "RIVIÈRE Schindler",
};

// Cherche le script dans les emplacements possibles selon le cwd au lancement
function findExtractorScript(scriptName = "devis_extractor.py"): string | null {
  const candidates = [
    path.resolve(process.cwd(), "..", "mms-analyzer", scriptName),
    path.resolve(process.cwd(), "mms-analyzer", scriptName),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

async function runPythonExtractor(scriptName: string, pdfPath: string): Promise<string> {
  const scriptPath = findExtractorScript(scriptName);
  if (!scriptPath) {
    console.warn(`[extractor] Script introuvable (mms-analyzer/${scriptName})`);
    return "";
  }
  for (const cmd of ["python3", "python", "py"]) {
    try {
      const result = await execFileAsync(cmd, [scriptPath, pdfPath], {
        timeout: 30_000,
        encoding: "utf8",
        // Force Python à écrire son stdout en UTF-8 (sinon il utilise le codepage console
        // Windows par défaut, ce qui corrompt les caractères accentués type "à", "é").
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      });
      return result.stdout.trim();
    } catch {
      continue;
    }
  }
  return "";
}

type ExtractedBonCommande = {
  numero: string | null;
  adresse: string | null;
  fournisseur: string | null;
  client: string | null;
  montant_ttc: number | null;
  reference_devis: string | null;
  error?: string;
};

export async function tryExtractBonCommande(buffer: Buffer): Promise<BonCommandeExtractionRow | null> {
  const tmpPath = path.join(os.tmpdir(), `bon-commande-lvo-${randomUUID()}.pdf`);
  try {
    fs.writeFileSync(tmpPath, buffer);
    const stdout = await runPythonExtractor("bon_commande_extractor.py", tmpPath);
    if (!stdout) {
      console.warn("[bon-commande-extractor] Aucun résultat Python — vérifiez que pdfplumber est installé");
      return null;
    }
    const data = JSON.parse(stdout) as ExtractedBonCommande;
    if (data.error) {
      console.warn("[bon-commande-extractor] Erreur extraction :", data.error);
      return null;
    }
    console.log(`[bon-commande-extractor] Extraction OK — numero=${data.numero ?? "?"} fournisseur=${data.fournisseur ?? "?"} client=${data.client ?? "?"}`);
    return {
      numero: data.numero ?? null,
      adresse: data.adresse ?? null,
      fournisseur: data.fournisseur ?? null,
      client: data.client ?? null,
      montantTtc: data.montant_ttc ?? null,
      referenceDevis: data.reference_devis ?? null,
    };
  } catch (e) {
    console.warn("[bon-commande-extractor] Extraction échouée :", (e as Error).message);
    return null;
  } finally {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
  }
}

async function tryExtractDevis(buffer: Buffer): Promise<Partial<DevisGroupementRow>> {
  const tmpPath = path.join(os.tmpdir(), `devis-lvo-${randomUUID()}.pdf`);
  try {
    fs.writeFileSync(tmpPath, buffer);

    const scriptPath = findExtractorScript();
    if (!scriptPath) {
      console.warn("[devis-extractor] Script introuvable (mms-analyzer/devis_extractor.py)");
      return {};
    }

    let stdout = "";
    // Essaie plusieurs commandes Python (Windows = python ou py, Linux/Mac = python3)
    for (const cmd of ["python3", "python", "py"]) {
      try {
        const result = await execFileAsync(cmd, [scriptPath, tmpPath], {
          timeout: 30_000,
          encoding: "utf8",
          // Force Python à écrire son stdout en UTF-8 (sinon il utilise le codepage console
          // Windows par défaut, ce qui corrompt les caractères accentués type "à", "é").
          env: { ...process.env, PYTHONIOENCODING: "utf-8" },
        });
        stdout = result.stdout.trim();
        break;
      } catch {
        continue;
      }
    }

    if (!stdout) {
      console.warn("[devis-extractor] Aucun résultat Python — vérifiez que pdfplumber est installé");
      return {};
    }

    const data = JSON.parse(stdout) as ExtractedDevis;
    if (data.error) {
      console.warn("[devis-extractor] Erreur extraction :", data.error);
      return {};
    }

    const str = (v: string | null | undefined): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
    const num = (v: number | null | undefined): number | null => (typeof v === "number" && isFinite(v) ? v : null);

    console.log(`[devis-extractor] Extraction OK — marque=${data.marque ?? "?"} n°=${data.numero_devis ?? "?"} montant=${data.montant_ht ?? "?"}`);

    const result: Partial<DevisGroupementRow> = {};
    if (str(data.numero_devis))   result.numeroDevis   = str(data.numero_devis)!;
    if (str(data.marque))         result.entreprise    = MARQUE_LABEL[data.marque!] ?? str(data.marque)!;
    if (str(data.numero_appareil)) result.numeroAppareil = str(data.numero_appareil)!;
    if (str(data.date_devis))     result.dateDevis     = str(data.date_devis)!;
    if (str(data.objet))          result.objet         = str(data.objet)!;
    if (str(data.batiment))       result.batiment      = str(data.batiment)!;
    if (str(data.adresse))        result.adresse       = str(data.adresse)!;
    if (str(data.client_nom))     result.clientNom     = str(data.client_nom)!;
    if (num(data.montant_ht) != null) result.montantHt  = num(data.montant_ht)!;
    if (num(data.montant_tva) != null) result.montantTva = num(data.montant_tva)!;
    if (num(data.montant_ttc) != null) result.montantTtc = num(data.montant_ttc)!;
    result.tauxTva = num(data.taux_tva) ?? 2.10;
    result.ascenseurArret = data.ascenseur_arret === true;
    const validMotifs = ["vandalisme", "intemperies_oxydation", "mauvaise_utilisation", "vetuste"];
    if (str(data.motif) && validMotifs.includes(str(data.motif)!)) {
      result.motif = str(data.motif) as DevisGroupementRow["motif"];
    }

    return result;
  } catch (e) {
    console.warn("[devis-extractor] Extraction échouée :", (e as Error).message);
    return {};
  } finally {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const devisGroupementRouter = express.Router();

const devisUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
});

function nextId(arr: { id: number }[]): number {
  return Math.max(0, ...arr.map((x) => x.id), 0) + 1;
}

// ─── Appareils ────────────────────────────────────────────────────────────────

// GET /api/appareils — liste (filtrable par clientNom, enArret)
devisGroupementRouter.get("/appareils", (req: AuthedRequest, res) => {
  const { clientNom, enArret, search } = req.query as Record<string, string | undefined>;
  let list = [...appareils];
  if (clientNom) list = list.filter((a) => a.clientNom === clientNom);
  if (enArret === "true") list = list.filter((a) => a.enArret);
  if (enArret === "false") list = list.filter((a) => !a.enArret);
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(
      (a) =>
        a.numero.toLowerCase().includes(q) ||
        (a.label ?? "").toLowerCase().includes(q) ||
        a.clientNom.toLowerCase().includes(q) ||
        (a.siteNom ?? "").toLowerCase().includes(q)
    );
  }
  list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(list);
});

// GET /api/appareils/:id
devisGroupementRouter.get("/appareils/:id", (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const a = appareils.find((x) => x.id === id);
  if (!a) { res.status(404).json({ error: "Appareil introuvable" }); return; }
  res.json(a);
});

// POST /api/appareils
devisGroupementRouter.post("/appareils", requireRoles("ADMIN", "MANAGER", "CONSULTANT"), (req: AuthedRequest, res) => {
  const { numero, label, clientNom, siteNom, entreprise, enArret } = req.body as Record<string, string | boolean>;
  if (!numero || !clientNom) {
    res.status(400).json({ error: "numero et clientNom sont obligatoires" });
    return;
  }
  const row: AppareilRow = {
    id: nextId(appareils),
    numero: String(numero).trim(),
    label: label ? String(label).trim() : null,
    clientNom: String(clientNom).trim(),
    siteNom: siteNom ? String(siteNom).trim() : null,
    entreprise: entreprise ? String(entreprise).trim() : null,
    enArret: Boolean(enArret),
    createdAt: new Date().toISOString(),
  };
  appareils.push(row);
  schedulePersistStore();
  res.status(201).json(row);
});

// PUT /api/appareils/:id
devisGroupementRouter.put("/appareils/:id", requireRoles("ADMIN", "MANAGER", "CONSULTANT"), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const a = appareils.find((x) => x.id === id);
  if (!a) { res.status(404).json({ error: "Appareil introuvable" }); return; }
  const b = req.body as Partial<AppareilRow>;
  if (b.numero !== undefined) a.numero = String(b.numero).trim();
  if (b.label !== undefined) a.label = b.label ? String(b.label).trim() : null;
  if (b.clientNom !== undefined) a.clientNom = String(b.clientNom).trim();
  if (b.siteNom !== undefined) a.siteNom = b.siteNom ? String(b.siteNom).trim() : null;
  if (b.entreprise !== undefined) a.entreprise = b.entreprise ? String(b.entreprise).trim() : null;
  if (b.enArret !== undefined) a.enArret = Boolean(b.enArret);
  schedulePersistStore();
  res.json(a);
});

// DELETE /api/appareils/:id
devisGroupementRouter.delete("/appareils/:id", requireRoles("ADMIN", "MANAGER"), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const idx = appareils.findIndex((x) => x.id === id);
  if (idx === -1) { res.status(404).json({ error: "Appareil introuvable" }); return; }
  const linked = devisGroupement.some((d) => d.appareilId === id);
  if (linked && req.auth?.role !== "ADMIN") {
    res.status(409).json({ error: "Cet appareil est lié à des devis. Supprimez ou dissociez les devis d'abord." });
    return;
  }
  if (linked) {
    // ADMIN force la suppression : on dissocie les devis liés plutôt que de laisser un appareilId orphelin.
    for (const d of devisGroupement) {
      if (d.appareilId === id) d.appareilId = null;
    }
  }
  appareils.splice(idx, 1);
  schedulePersistStore();
  res.json({ ok: true });
});

// ─── Devis Groupement ─────────────────────────────────────────────────────────

// GET /api/devis-groupement
devisGroupementRouter.get("/devis-groupement", (req: AuthedRequest, res) => {
  const { clientNom, statut, annee, ascenseurArret, search } = req.query as Record<string, string | undefined>;
  let list = [...devisGroupement];
  if (clientNom) list = list.filter((d) => d.clientNom === clientNom);
  if (statut) list = list.filter((d) => d.statut === statut);
  if (ascenseurArret === "true") list = list.filter((d) => d.ascenseurArret);
  if (ascenseurArret === "false") list = list.filter((d) => !d.ascenseurArret);
  if (annee) {
    list = list.filter((d) => d.dateDevis && d.dateDevis.startsWith(annee));
  }
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(
      (d) =>
        d.numeroDevis.toLowerCase().includes(q) ||
        (d.clientNom ?? "").toLowerCase().includes(q) ||
        (d.numeroAppareil ?? "").toLowerCase().includes(q) ||
        (d.entreprise ?? "").toLowerCase().includes(q) ||
        (d.batiment ?? "").toLowerCase().includes(q) ||
        (d.objet ?? "").toLowerCase().includes(q)
    );
  }
  list.sort((a, b) => {
    // Appareils à l'arrêt en premier, puis par date décroissante
    if (a.ascenseurArret && !b.ascenseurArret) return -1;
    if (!a.ascenseurArret && b.ascenseurArret) return 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
  res.json(list);
});

// GET /api/devis-groupement/:id
devisGroupementRouter.get("/devis-groupement/:id", (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const d = devisGroupement.find((x) => x.id === id);
  if (!d) { res.status(404).json({ error: "Devis introuvable" }); return; }
  const msgs = negociationMessages.filter((m) => m.devisId === id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  res.json({ ...d, messages: msgs });
});

// POST /api/devis-groupement — création avec upload PDF optionnel
devisGroupementRouter.post(
  "/devis-groupement",
  devisUpload.single("file"),
  async (req: AuthedRequest, res) => {
    const body = req.body as Record<string, string>;
    const file = (req as express.Request & { file?: Express.Multer.File }).file;

    const {
      numeroDevis, clientNom, appareilId, numeroAppareil, entreprise,
      dateDevis, objet, montantHt, tauxTva, montantTva, montantTtc,
      ascenseurArret, batiment, adresse, conditionsPaiement, avisLvo, estimatifLvoHt,
      uploadedByContactId,
    } = body;

    if (!numeroDevis || !clientNom) {
      res.status(400).json({ error: "numeroDevis et clientNom sont obligatoires" });
      return;
    }

    let documentUrl: string | null = null;
    let documentNom: string | null = null;
    let documentSizeBytes: number | null = null;

    if (file) {
      const safeName = `${randomUUID()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const minioKey = `devis-groupement/${safeName}`;
      documentNom = file.originalname;
      documentSizeBytes = file.size;
      try {
        await getMinio().putObject(MINIO_BUCKETS.clientDocs, safeName, file.buffer, file.size, { "Content-Type": file.mimetype });
        documentUrl = minioKey;
      } catch (e) {
        const dir = path.resolve("uploads", "devis-groupement");
        fs.mkdirSync(dir, { recursive: true });
        const localPath = path.join(dir, safeName);
        fs.writeFileSync(localPath, file.buffer);
        documentUrl = localPath;
        console.warn("[devis-groupement] MinIO indisponible, fallback local :", (e as Error).message);
      }
    }

    const now = new Date().toISOString();
    const row: DevisGroupementRow = {
      id: nextId(devisGroupement),
      numeroDevis: numeroDevis.trim(),
      clientNom: clientNom.trim(),
      appareilId: appareilId ? Number(appareilId) : null,
      numeroAppareil: numeroAppareil?.trim() || null,
      entreprise: entreprise?.trim() || null,
      dateDevis: dateDevis || null,
      objet: objet?.trim() || null,
      montantHt: montantHt ? Number(montantHt) : null,
      tauxTva: tauxTva ? Number(tauxTva) : 2.10,
      montantTva: montantTva ? Number(montantTva) : null,
      montantTtc: montantTtc ? Number(montantTtc) : null,
      ascenseurArret: ascenseurArret === "true" || ascenseurArret === "1",
      avisLvo: avisLvo?.trim() || null,
      estimatifLvoHt: estimatifLvoHt ? Number(estimatifLvoHt) : null,
      montantNegocieHt: null,
      economieHt: null,
      statut: "EN_ATTENTE",
      documentUrl,
      documentNom,
      documentSizeBytes,
      signatureAdminUrl: null,
      signatureClientUrl: null,
      signatureClientDate: null,
      documentOverlayApplied: false,
      bonCommandeUrl: null,
      bonCommandeNom: null,
      bonCommandeUploadedAt: null,
      bonCommandeExtraction: null,
      pvFichiers: [],
      pvDate: null,
      pvCommentaire: null,
      pvUploadedAt: null,
      motif: null,
      motifRefus: null,
      conditionsPaiement: conditionsPaiement?.trim() || null,
      batiment: batiment?.trim() || null,
      adresse: adresse?.trim() || null,
      uploadedByContactId: uploadedByContactId ? Number(uploadedByContactId) : null,
      uploadedByAscensoristeId: null,
      createdAt: now,
      updatedAt: now,
    };

    devisGroupement.push(row);
    schedulePersistStore();
    res.status(201).json(row);
  }
);

// PUT /api/devis-groupement/:id — mise à jour champs
devisGroupementRouter.put("/devis-groupement/:id", requireRoles("ADMIN", "MANAGER", "CONSULTANT"), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const d = devisGroupement.find((x) => x.id === id);
  if (!d) { res.status(404).json({ error: "Devis introuvable" }); return; }
  const b = req.body as Partial<DevisGroupementRow>;
  const updatable: (keyof DevisGroupementRow)[] = [
    "numeroDevis", "clientNom", "appareilId", "numeroAppareil", "entreprise",
    "dateDevis", "objet", "montantHt", "tauxTva", "montantTva", "montantTtc",
    "ascenseurArret", "avisLvo", "estimatifLvoHt", "conditionsPaiement", "batiment", "adresse",
  ];
  for (const k of updatable) {
    if (k in b) (d as Record<string, unknown>)[k] = (b as Record<string, unknown>)[k];
  }
  d.updatedAt = new Date().toISOString();
  schedulePersistStore();
  res.json(d);
});

// PATCH /api/devis-groupement/:id/statut — changement statut
devisGroupementRouter.patch("/devis-groupement/:id/statut", requireRoles("ADMIN", "MANAGER", "CONSULTANT"), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const d = devisGroupement.find((x) => x.id === id);
  if (!d) { res.status(404).json({ error: "Devis introuvable" }); return; }

  const { statut, avisLvo, estimatifLvoHt, motifRefus, montantNegocieHt, motif } = req.body as Record<string, string>;
  const validStatuts: DevisGroupementStatut[] = [
    "EN_ATTENTE", "EN_NEGOCIATION", "VALIDE", "REFUSE", "SIGNE", "TERMINE",
  ];
  if (!validStatuts.includes(statut as DevisGroupementStatut)) {
    res.status(400).json({ error: `Statut invalide. Valeurs acceptées : ${validStatuts.join(", ")}` });
    return;
  }

  if (statut === "REFUSE" && !motifRefus?.trim()) {
    res.status(400).json({ error: "motifRefus est obligatoire lors d'un refus" });
    return;
  }

  d.statut = statut as DevisGroupementStatut;
  if (avisLvo !== undefined) d.avisLvo = avisLvo.trim() || null;
  if (estimatifLvoHt !== undefined) d.estimatifLvoHt = estimatifLvoHt ? Number(estimatifLvoHt) : null;
  if (motifRefus !== undefined) d.motifRefus = motifRefus.trim() || null;
  if (motif !== undefined) {
    const validMotifs = ["vandalisme", "intemperies_oxydation", "mauvaise_utilisation", "vetuste"];
    d.motif = (validMotifs.includes(motif) ? motif : null) as typeof d.motif;
  }
  if (montantNegocieHt !== undefined && montantNegocieHt) {
    d.montantNegocieHt = Number(montantNegocieHt);
    if (d.montantHt != null) {
      d.economieHt = Math.max(0, d.montantHt - d.montantNegocieHt);
    }
  }
  d.updatedAt = new Date().toISOString();
  schedulePersistStore();

  // Notification client si refus ou validation
  if ((statut === "REFUSE" || statut === "VALIDE" || statut === "SIGNE") && d.clientNom) {
    const notifMsg =
      statut === "REFUSE"
        ? `Votre devis ${d.numeroDevis} a été refusé${motifRefus ? ` : ${motifRefus}` : ""}.`
        : statut === "SIGNE"
        ? `Votre devis ${d.numeroDevis} a été signé et validé par LVO.`
        : `Votre devis ${d.numeroDevis} a été validé par LVO Ingénierie.`;
    clientNotifications.push({
      id: Math.max(0, ...clientNotifications.map((n) => n.id), 0) + 1,
      entreprise: d.clientNom,
      title: statut === "REFUSE" ? "Devis refusé" : statut === "SIGNE" ? "Devis signé" : "Devis validé",
      message: notifMsg,
      kind: "INFO",
      href: "/espace-client/devis",
      read: false,
      createdAt: new Date().toISOString(),
    });

    const ascensoristeEmail = getAscensoristeEmail(d.uploadedByAscensoristeId);
    if (ascensoristeEmail) {
      void sendMail({
        to: ascensoristeEmail,
        subject: `[LVO] Devis ${d.numeroDevis} — ${statut === "REFUSE" ? "refusé" : statut === "SIGNE" ? "signé" : "validé"}`,
        html: renderMailHtml(
          statut === "REFUSE" ? "Devis refusé" : statut === "SIGNE" ? "Devis signé" : "Devis validé",
          `<p>${notifMsg}</p><p>Client : <strong>${d.clientNom}</strong>${d.numeroAppareil ? ` — Appareil ${d.numeroAppareil}` : ""}</p>`
        ),
      });
    }
  }

  res.json(d);
});

// POST /api/devis-groupement/:id/signer — apposer signature admin (base64) + overlay PDF
devisGroupementRouter.post("/devis-groupement/:id/signer", requireRoles("ADMIN", "MANAGER"), async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const d = devisGroupement.find((x) => x.id === id);
  if (!d) { res.status(404).json({ error: "Devis introuvable" }); return; }
  if (d.statut !== "VALIDE") {
    res.status(400).json({ error: "Le devis doit être à l'état VALIDE avant signature" });
    return;
  }
  const { signataireName } = req.body as { signataireName?: string };

  const signedDate = new Date().toISOString();
  d.signatureAdminUrl = "lvo-stamp";
  d.statut = "SIGNE";
  d.updatedAt = signedDate;

  // Overlay sur le PDF si un document est attaché
  if (d.documentUrl) {
    try {
      let originalPdf: Buffer;
      const isLocal = path.isAbsolute(d.documentUrl) || d.documentUrl.startsWith("uploads");
      if (isLocal) {
        const filePath = path.isAbsolute(d.documentUrl) ? d.documentUrl : path.resolve(d.documentUrl);
        originalPdf = await fsPromises.readFile(filePath);
      } else {
        const key = d.documentUrl.replace(/^devis-groupement\//, "");
        const stream = await getMinio().getObject(MINIO_BUCKETS.clientDocs, key);
        const chunks: Buffer[] = [];
        await new Promise<void>((ok, ko) => { stream.on("data", (c: Buffer) => chunks.push(c)); stream.on("end", ok); stream.on("error", ko); });
        originalPdf = Buffer.concat(chunks);
      }
      const name = signataireName?.trim() || (req.auth ? req.auth.email : "LVO Ingénierie");
      const signedPdf = await overlaySignatureOnPdf(originalPdf, "", signedDate, name);
      const signedDir = path.resolve("uploads", "devis-groupement", "signed");
      fs.mkdirSync(signedDir, { recursive: true });
      const signedPath = path.join(signedDir, `signed-${id}-${Date.now()}.pdf`);
      await fsPromises.writeFile(signedPath, signedPdf);
      d.documentUrl = signedPath;
      d.documentNom = `${(d.documentNom ?? d.numeroDevis).replace(/\.pdf$/i, "")}-signe.pdf`;
      d.documentOverlayApplied = true;
    } catch (e) {
      console.warn("[signer-admin] Overlay PDF échoué (signature stockée quand même) :", (e as Error).message);
    }
  }

  schedulePersistStore();
  res.json(d);
});

// POST /api/devis-groupement/export-excel — export Excel détaillé avec graphiques natifs intégrés
type ExportDevisRow = {
  numeroDevis: string; client: string; prestataire: string; appareil: string; batiment: string;
  objet: string; montantHt: number; montantTtc: number; tauxTva: number; statut: string;
  motif: string; motifRefus: string; arret: string; dateDevis: string; deposeLe: string;
};
type ExportSynRow = { label: string; nombre: number; montantHt: number; color?: string; arret?: number };
type ExportPayload = {
  devis: ExportDevisRow[];
  statutSynthese: ExportSynRow[];
  clientSynthese: ExportSynRow[];
  prestataireSynthese: ExportSynRow[];
};

devisGroupementRouter.post("/devis-groupement/export-excel", async (req: AuthedRequest, res) => {
  try {
    const { devis: devisRows, statutSynthese, clientSynthese, prestataireSynthese } = req.body as ExportPayload;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "LVO Ingénierie";
    workbook.created = new Date();

    const logoBuffer = fs.readFileSync(path.resolve("assets", "logo-lvo.jpg"));
    const logoImageId = workbook.addImage({ buffer: logoBuffer as unknown as ExcelJS.Buffer, extension: "jpeg" });

    const genDate = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
    const HEADER_ROW = 4;

    // ── Feuille Devis (détail) ──────────────────────────────────────────────
    const wsDevis = workbook.addWorksheet("Devis", { properties: { tabColor: { argb: NAVY } } });
    const devisCols = [
      { key: "numeroDevis", width: 16, header: "N° devis" },
      { key: "client", width: 12, header: "Client" },
      { key: "prestataire", width: 18, header: "Prestataire" },
      { key: "appareil", width: 12, header: "Appareil" },
      { key: "batiment", width: 16, header: "Bâtiment" },
      { key: "objet", width: 32, header: "Objet" },
      { key: "montantHt", width: 14, header: "Montant HT" },
      { key: "montantTtc", width: 14, header: "Montant TTC" },
      { key: "tauxTva", width: 10, header: "Taux TVA" },
      { key: "statut", width: 16, header: "Statut" },
      { key: "motif", width: 22, header: "Motif" },
      { key: "motifRefus", width: 26, header: "Motif de refus" },
      { key: "arret", width: 16, header: "Appareil à l'arrêt" },
      { key: "dateDevis", width: 14, header: "Date devis" },
      { key: "deposeLe", width: 14, header: "Déposé le" },
    ];
    wsDevis.columns = devisCols.map((c) => ({ key: c.key, width: c.width }));
    addBrandBanner(wsDevis, logoImageId, "LVO Ingénierie — Suivi des devis groupement", `Généré le ${genDate} — ${devisRows?.length ?? 0} devis`, "O");
    wsDevis.getRow(HEADER_ROW).values = devisCols.map((c) => c.header);
    styleHeaderRow(wsDevis.getRow(HEADER_ROW), devisCols.length);
    for (const d of devisRows ?? []) {
      const r = wsDevis.addRow(d);
      r.getCell("montantHt").numFmt = "#,##0.00 €";
      r.getCell("montantTtc").numFmt = "#,##0.00 €";
    }
    const devisLastRow = HEADER_ROW + (devisRows?.length ?? 0);
    zebraStripe(wsDevis, HEADER_ROW + 1, devisLastRow, devisCols.length);
    wsDevis.autoFilter = { from: `A${HEADER_ROW}`, to: `O${devisLastRow}` };
    wsDevis.views = [{ state: "frozen", ySplit: HEADER_ROW }];

    // ── Feuille Synthèse - Statuts (+ camembert) ────────────────────────────
    const wsStatuts = workbook.addWorksheet("Synthèse - Statuts", { properties: { tabColor: { argb: ORANGE } } });
    const statutCols = [
      { key: "label", width: 18, header: "Statut" },
      { key: "nombre", width: 16, header: "Nombre de devis" },
      { key: "montantHt", width: 18, header: "Montant HT total" },
    ];
    wsStatuts.columns = statutCols.map((c) => ({ key: c.key, width: c.width }));
    addBrandBanner(wsStatuts, logoImageId, "LVO Ingénierie — Répartition par statut", `Généré le ${genDate}`, "C");
    wsStatuts.getRow(HEADER_ROW).values = statutCols.map((c) => c.header);
    styleHeaderRow(wsStatuts.getRow(HEADER_ROW), statutCols.length);
    for (const s of statutSynthese ?? []) {
      const r = wsStatuts.addRow(s);
      r.getCell("montantHt").numFmt = "#,##0.00 €";
    }
    zebraStripe(wsStatuts, HEADER_ROW + 1, HEADER_ROW + (statutSynthese?.length ?? 0), statutCols.length);
    const statutSlices: ChartSlice[] = (statutSynthese ?? []).map((s) => ({ label: s.label, value: s.nombre, color: s.color }));
    await addImageFromSvg(workbook, wsStatuts, pieChartSvg("Répartition des devis par statut", statutSlices), 4, HEADER_ROW - 1);

    // ── Feuille Synthèse - Clients (+ barres) ───────────────────────────────
    const wsClients = workbook.addWorksheet("Synthèse - Clients", { properties: { tabColor: { argb: ORANGE } } });
    const clientCols = [
      { key: "label", width: 14, header: "Client" },
      { key: "nombre", width: 16, header: "Nombre de devis" },
      { key: "montantHt", width: 18, header: "Montant HT total" },
      { key: "arret", width: 18, header: "Appareils à l'arrêt" },
    ];
    wsClients.columns = clientCols.map((c) => ({ key: c.key, width: c.width }));
    addBrandBanner(wsClients, logoImageId, "LVO Ingénierie — Analyse par client", `Généré le ${genDate}`, "D");
    wsClients.getRow(HEADER_ROW).values = clientCols.map((c) => c.header);
    styleHeaderRow(wsClients.getRow(HEADER_ROW), clientCols.length);
    for (const c of clientSynthese ?? []) {
      const r = wsClients.addRow(c);
      r.getCell("montantHt").numFmt = "#,##0.00 €";
    }
    zebraStripe(wsClients, HEADER_ROW + 1, HEADER_ROW + (clientSynthese?.length ?? 0), clientCols.length);
    const clientBars: ChartSlice[] = (clientSynthese ?? []).map((c) => ({ label: c.label, value: c.montantHt }));
    await addImageFromSvg(workbook, wsClients, barChartSvg("Montant HT par client", clientBars, "€"), 5, HEADER_ROW - 1);

    // ── Feuille Synthèse - Prestataires (+ barres) ──────────────────────────
    const wsPresta = workbook.addWorksheet("Synthèse - Prestataires", { properties: { tabColor: { argb: ORANGE } } });
    const prestaCols = [
      { key: "label", width: 20, header: "Prestataire" },
      { key: "nombre", width: 16, header: "Nombre de devis" },
      { key: "montantHt", width: 18, header: "Montant HT total" },
    ];
    wsPresta.columns = prestaCols.map((c) => ({ key: c.key, width: c.width }));
    addBrandBanner(wsPresta, logoImageId, "LVO Ingénierie — Analyse par prestataire", `Généré le ${genDate}`, "C");
    wsPresta.getRow(HEADER_ROW).values = prestaCols.map((c) => c.header);
    styleHeaderRow(wsPresta.getRow(HEADER_ROW), prestaCols.length);
    for (const p of prestataireSynthese ?? []) {
      const r = wsPresta.addRow(p);
      r.getCell("montantHt").numFmt = "#,##0.00 €";
    }
    zebraStripe(wsPresta, HEADER_ROW + 1, HEADER_ROW + (prestataireSynthese?.length ?? 0), prestaCols.length);
    const prestaBars: ChartSlice[] = (prestataireSynthese ?? []).map((p) => ({ label: p.label, value: p.montantHt }));
    await addImageFromSvg(workbook, wsPresta, barChartSvg("Montant HT par prestataire", prestaBars, "€"), 5, HEADER_ROW - 1);

    // ── Feuille Tableau de bord (synthèse visuelle complète) ────────────────
    const wsDash = workbook.addWorksheet("Tableau de bord", { properties: { tabColor: { argb: NAVY } } });
    wsDash.columns = Array.from({ length: 18 }, () => ({ width: 9 }));
    addBrandBanner(wsDash, logoImageId, "LVO Ingénierie — Tableau de bord Devis Groupement", `Généré le ${genDate} — ${devisRows?.length ?? 0} devis au total`, "L");
    await addImageFromSvg(workbook, wsDash, pieChartSvg("Répartition des devis par statut", statutSlices), 0, HEADER_ROW - 1);
    await addImageFromSvg(workbook, wsDash, barChartSvg("Montant HT par client", clientBars, "€"), 9, HEADER_ROW - 1);
    await addImageFromSvg(workbook, wsDash, barChartSvg("Montant HT par prestataire", prestaBars, "€"), 0, HEADER_ROW + 19);

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="devis-groupement-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (e) {
    console.error("[export-excel] Erreur génération :", e);
    res.status(500).json({ error: "Erreur lors de la génération du fichier Excel : " + (e as Error).message });
  }
});

// DELETE /api/devis-groupement/:id
devisGroupementRouter.delete("/devis-groupement/:id", requireRoles("ADMIN", "MANAGER"), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const idx = devisGroupement.findIndex((x) => x.id === id);
  if (idx === -1) { res.status(404).json({ error: "Devis introuvable" }); return; }
  devisGroupement.splice(idx, 1);
  const msgIdx = negociationMessages.filter((m) => m.devisId === id);
  for (const m of msgIdx) {
    const i = negociationMessages.indexOf(m);
    if (i !== -1) negociationMessages.splice(i, 1);
  }
  schedulePersistStore();
  res.json({ ok: true });
});

// GET /api/devis-groupement/:id/download — téléchargement du PDF (avec overlay signature si signé)
devisGroupementRouter.get("/devis-groupement/:id/download", async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const d = devisGroupement.find((x) => x.id === id);
  if (!d || !d.documentUrl) { res.status(404).json({ error: "Document introuvable" }); return; }

  try {
    let pdfBuffer: Buffer;
    const isLocal = path.isAbsolute(d.documentUrl) || d.documentUrl.startsWith("uploads");
    if (isLocal) {
      const filePath = path.isAbsolute(d.documentUrl) ? d.documentUrl : path.resolve(d.documentUrl);
      if (!fs.existsSync(filePath)) { res.status(404).json({ error: "Fichier local introuvable" }); return; }
      pdfBuffer = await fsPromises.readFile(filePath);
    } else {
      const key = d.documentUrl.replace(/^devis-groupement\//, "");
      const stream = await getMinio().getObject(MINIO_BUCKETS.clientDocs, key);
      const chunks: Buffer[] = [];
      await new Promise<void>((ok, ko) => { stream.on("data", (c: Buffer) => chunks.push(c)); stream.on("end", ok); stream.on("error", ko); });
      pdfBuffer = Buffer.concat(chunks);
    }

    // Si signé mais PDF pas encore overlayé (documentUrl pointe encore vers original), appliquer overlay maintenant
    const sigUrl = d.signatureClientUrl ?? d.signatureAdminUrl;
    const sigDate = d.signatureClientDate ?? (d.statut === "SIGNE" ? d.updatedAt : null);
    if (d.statut === "SIGNE" && sigUrl && sigDate && !d.documentOverlayApplied) {
      try {
        const overlayed = await overlaySignatureOnPdf(pdfBuffer, sigUrl, sigDate, "LVO Ingénierie");
        // Sauvegarder la version signée pour éviter de re-calculer
        const signedDir = path.resolve("uploads", "devis-groupement", "signed");
        fs.mkdirSync(signedDir, { recursive: true });
        const signedPath = path.join(signedDir, `signed-${id}.pdf`);
        await fsPromises.writeFile(signedPath, overlayed);
        d.documentUrl = signedPath;
        d.documentNom = `${(d.documentNom ?? d.numeroDevis).replace(/\.pdf$/i, "")}-signe.pdf`;
        d.documentOverlayApplied = true;
        schedulePersistStore();
        const filename = encodeURIComponent(d.documentNom);
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Type", "application/pdf");
        res.send(Buffer.from(overlayed));
        return;
      } catch (e) {
        console.warn("[download] Overlay signature échoué, envoi PDF original :", (e as Error).message);
      }
    }

    const filename = encodeURIComponent(d.documentNom ?? "devis.pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/pdf");
    res.send(pdfBuffer);
  } catch (e) {
    res.status(500).json({ error: "Erreur lecture PDF : " + (e as Error).message });
  }
});

// ─── Bon de commande (admin) ──────────────────────────────────────────────────

const bcAdminUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.resolve("uploads", "devis-groupement", "bon-commande");
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype === "application/pdf"),
});

devisGroupementRouter.post(
  "/devis-groupement/:id/bon-commande",
  requireRoles("ADMIN", "MANAGER", "CONSULTANT"),
  bcAdminUpload.single("file"),
  async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const d = devisGroupement.find((x) => x.id === id);
    if (!d) { res.status(404).json({ error: "Devis introuvable" }); return; }
    const file = req.file;
    if (!file) { res.status(400).json({ error: "Fichier PDF requis" }); return; }
    const now = new Date().toISOString();
    d.bonCommandeUrl = file.path;
    d.bonCommandeNom = file.originalname;
    d.bonCommandeUploadedAt = now;
    try {
      const buffer = await fsPromises.readFile(file.path);
      d.bonCommandeExtraction = await tryExtractBonCommande(buffer);
    } catch (e) {
      console.warn("[bon-commande-extractor] Lecture fichier échouée :", (e as Error).message);
    }
    d.updatedAt = now;
    schedulePersistStore();
    res.json({ ok: true, nom: file.originalname, uploadedAt: now, extraction: d.bonCommandeExtraction });
  }
);

devisGroupementRouter.get("/devis-groupement/:id/bon-commande/download", requireRoles("ADMIN", "MANAGER", "CONSULTANT"), async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const d = devisGroupement.find((x) => x.id === id);
  if (!d || !d.bonCommandeUrl) { res.status(404).json({ error: "Bon de commande introuvable" }); return; }
  try {
    const buf = await fsPromises.readFile(d.bonCommandeUrl);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(d.bonCommandeNom ?? "bon-commande.pdf")}"`);
    res.setHeader("Content-Type", "application/pdf");
    res.send(buf);
  } catch { res.status(404).json({ error: "Fichier introuvable sur le disque" }); }
});

// GET /api/devis-groupement/:id/pv/download?file=<nom-stocke> — PV déposé par l'ascensoriste (lecture admin)
devisGroupementRouter.get("/devis-groupement/:id/pv/download", requireRoles("ADMIN", "MANAGER", "CONSULTANT"), async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const d = devisGroupement.find((x) => x.id === id);
  if (!d) { res.status(404).json({ error: "Devis introuvable" }); return; }
  await downloadPvFile(d, req, res);
});

// DELETE /api/devis-groupement/:id/bon-commande — suppression du bon de commande
// Règle : un devis non validé (statut différent de VALIDE/SIGNE) peut être supprimé par ADMIN/MANAGER/CONSULTANT.
// Un devis déjà validé ou signé ne peut être supprimé que par un ADMIN.
devisGroupementRouter.delete(
  "/devis-groupement/:id/bon-commande",
  requireRoles("ADMIN", "MANAGER", "CONSULTANT"),
  async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const d = devisGroupement.find((x) => x.id === id);
    if (!d) { res.status(404).json({ error: "Devis introuvable" }); return; }
    if (!d.bonCommandeUrl) { res.status(404).json({ error: "Aucun bon de commande à supprimer" }); return; }

    const isValideOuSigne = d.statut === "VALIDE" || d.statut === "SIGNE";
    if (isValideOuSigne && req.auth?.role !== "ADMIN") {
      res.status(403).json({ error: "Seul un administrateur peut supprimer le bon de commande d'un devis validé ou signé" });
      return;
    }

    try { await fsPromises.unlink(d.bonCommandeUrl); } catch { /* fichier déjà absent, on continue */ }
    d.bonCommandeUrl = null;
    d.bonCommandeNom = null;
    d.bonCommandeUploadedAt = null;
    d.bonCommandeExtraction = null;
    d.updatedAt = new Date().toISOString();
    schedulePersistStore();
    res.json({ ok: true });
  }
);

// ─── Négociation ──────────────────────────────────────────────────────────────

// GET /api/devis-groupement/:id/negociation
devisGroupementRouter.get("/devis-groupement/:id/negociation", (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const d = devisGroupement.find((x) => x.id === id);
  if (!d) { res.status(404).json({ error: "Devis introuvable" }); return; }
  const msgs = negociationMessages
    .filter((m) => m.devisId === id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  res.json({ devis: d, messages: msgs });
});

// POST /api/devis-groupement/:id/negociation — ajouter un message
devisGroupementRouter.post("/devis-groupement/:id/negociation", (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const d = devisGroupement.find((x) => x.id === id);
  if (!d) { res.status(404).json({ error: "Devis introuvable" }); return; }
  if (d.statut !== "EN_NEGOCIATION") {
    res.status(400).json({ error: "Le devis n'est pas en négociation" });
    return;
  }
  const { message, prixPropose, auteurRole, auteurNom } = req.body as Record<string, string>;
  if (!message?.trim()) {
    res.status(400).json({ error: "message est requis" });
    return;
  }
  if (!["ADMIN", "CLIENT"].includes(auteurRole)) {
    res.status(400).json({ error: "auteurRole doit être ADMIN ou CLIENT" });
    return;
  }
  const msg: NegociationMessageRow = {
    id: nextId(negociationMessages),
    devisId: id,
    auteurRole: auteurRole as "ADMIN" | "CLIENT",
    auteurNom: auteurNom?.trim() || null,
    message: message.trim(),
    prixPropose: prixPropose ? Number(prixPropose) : null,
    createdAt: new Date().toISOString(),
  };
  negociationMessages.push(msg);
  d.updatedAt = new Date().toISOString();
  schedulePersistStore();

  // Notification à l'autre partie
  if (auteurRole === "ADMIN" && d.clientNom) {
    clientNotifications.push({
      id: Math.max(0, ...clientNotifications.map((n) => n.id), 0) + 1,
      entreprise: d.clientNom,
      title: "Message de négociation",
      message: `LVO Ingénierie a répondu sur le devis ${d.numeroDevis}.`,
      kind: "INFO",
      href: "/espace-client/devis",
      read: false,
      createdAt: new Date().toISOString(),
    });
  }

  res.status(201).json(msg);
});

// PATCH /api/devis-groupement/:id/negociation/cloturer — clôturer la négociation
devisGroupementRouter.patch(
  "/devis-groupement/:id/negociation/cloturer",
  requireRoles("ADMIN", "MANAGER"),
  (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const d = devisGroupement.find((x) => x.id === id);
    if (!d) { res.status(404).json({ error: "Devis introuvable" }); return; }
    if (d.statut !== "EN_NEGOCIATION") {
      res.status(400).json({ error: "Le devis n'est pas en négociation" });
      return;
    }
    const { decision, montantNegocieHt, motifRefus } = req.body as Record<string, string>;
    if (decision === "ACCEPTER") {
      if (!montantNegocieHt) {
        res.status(400).json({ error: "montantNegocieHt requis pour accepter" });
        return;
      }
      d.montantNegocieHt = Number(montantNegocieHt);
      if (d.montantHt != null) d.economieHt = Math.max(0, d.montantHt - d.montantNegocieHt);
      d.statut = "VALIDE";
    } else if (decision === "REFUSER") {
      d.statut = "REFUSE";
      d.motifRefus = motifRefus?.trim() || "Négociation refusée";
    } else {
      res.status(400).json({ error: "decision doit être ACCEPTER ou REFUSER" });
      return;
    }
    d.updatedAt = new Date().toISOString();
    schedulePersistStore();
    res.json(d);
  }
);

// Client routes for appareils and devis are registered directly in server/src/index.ts
// using clientAuthMiddleware (defined inside main()), following the existing pattern.
// See: registerClientDevisRoutes() exported below.

export function registerClientDevisRoutes(
  app: express.Express,
  clientAuthMiddleware: express.RequestHandler,
  devisUploadMiddleware: ReturnType<typeof multer>
): void {
  type ClientReq = express.Request & { clientContact?: { id: number; entreprise: string; nom: string; prenom: string } };

  // GET /api/client/appareils
  app.get("/api/client/appareils", clientAuthMiddleware, (req: ClientReq, res) => {
    const entreprise = req.clientContact!.entreprise;
    const list = appareils
      .filter((a) => a.clientNom === entreprise)
      .sort((a, b) => {
        if (a.enArret && !b.enArret) return -1;
        if (!a.enArret && b.enArret) return 1;
        return a.numero.localeCompare(b.numero);
      });
    res.json(list);
  });

  // GET /api/client/devis-groupement
  app.get("/api/client/devis-groupement", clientAuthMiddleware, (req: ClientReq, res) => {
    const entreprise = req.clientContact!.entreprise;
    const list = devisGroupement
      .filter((d) => d.clientNom === entreprise)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json(list);
  });

  // GET /api/client/devis-groupement/:id/negociation
  app.get("/api/client/devis-groupement/:id/negociation", clientAuthMiddleware, (req: ClientReq, res) => {
    const id = Number(req.params.id);
    const d = devisGroupement.find((x) => x.id === id);
    if (!d || d.clientNom !== req.clientContact!.entreprise) { res.status(404).json({ error: "Devis introuvable" }); return; }
    const msgs = negociationMessages
      .filter((m) => m.devisId === id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    res.json({ devis: d, messages: msgs });
  });

  // Le dépôt initial du devis est réservé à l'ascensoriste (voir registerAscensoristeDevisRoutes).
  // Le client ne peut que consulter, négocier, signer et déposer le bon de commande.

  // POST /api/client/devis-groupement/:id/negociation — message client
  app.post("/api/client/devis-groupement/:id/negociation", clientAuthMiddleware, (req: ClientReq, res) => {
    const id = Number(req.params.id);
    const contact = req.clientContact!;
    const d = devisGroupement.find((x) => x.id === id && x.clientNom === contact.entreprise);
    if (!d) { res.status(404).json({ error: "Devis introuvable" }); return; }
    if (d.statut !== "EN_NEGOCIATION") { res.status(400).json({ error: "Ce devis n'est pas en négociation" }); return; }
    const { message, prixPropose } = req.body as Record<string, string>;
    if (!message?.trim()) { res.status(400).json({ error: "message requis" }); return; }
    const msg: NegociationMessageRow = {
      id: nextId(negociationMessages),
      devisId: id,
      auteurRole: "CLIENT",
      auteurNom: `${contact.prenom} ${contact.nom}`.trim(),
      message: message.trim(),
      prixPropose: prixPropose ? Number(prixPropose) : null,
      createdAt: new Date().toISOString(),
    };
    negociationMessages.push(msg);
    d.updatedAt = new Date().toISOString();
    schedulePersistStore();
    res.status(201).json(msg);
  });

  // GET /api/client/devis-groupement/:id/download
  app.get("/api/client/devis-groupement/:id/download", clientAuthMiddleware, async (req: ClientReq, res) => {
    const id = Number(req.params.id);
    const contact = req.clientContact!;
    const d = devisGroupement.find((x) => x.id === id && x.clientNom === contact.entreprise);
    if (!d || !d.documentUrl) { res.status(404).json({ error: "Document introuvable" }); return; }

    const isLocal = path.isAbsolute(d.documentUrl) || d.documentUrl.startsWith("uploads");
    try {
      let pdfBuffer: Buffer;
      if (isLocal) {
        const filePath = path.isAbsolute(d.documentUrl) ? d.documentUrl : path.resolve(d.documentUrl);
        if (!fs.existsSync(filePath)) { res.status(404).json({ error: "Fichier introuvable" }); return; }
        pdfBuffer = await fsPromises.readFile(filePath);
      } else {
        const key = d.documentUrl.replace(/^devis-groupement\//, "");
        const stream = await getMinio().getObject(MINIO_BUCKETS.clientDocs, key);
        const chunks: Buffer[] = [];
        await new Promise<void>((ok, ko) => { stream.on("data", (c: Buffer) => chunks.push(c)); stream.on("end", ok); stream.on("error", ko); });
        pdfBuffer = Buffer.concat(chunks);
      }

      // Si signé mais overlay pas encore appliqué, l'appliquer maintenant
      const sigUrl = d.signatureClientUrl ?? d.signatureAdminUrl;
      const sigDate = d.signatureClientDate ?? (d.statut === "SIGNE" ? d.updatedAt : null);
      if (d.statut === "SIGNE" && sigUrl && sigDate && !d.documentOverlayApplied) {
        try {
          const overlayed = await overlaySignatureOnPdf(pdfBuffer, sigUrl, sigDate, `${contact.prenom} ${contact.nom}`.trim());
          const signedDir = path.resolve("uploads", "devis-groupement", "signed");
          fs.mkdirSync(signedDir, { recursive: true });
          const signedPath = path.join(signedDir, `signed-${id}.pdf`);
          await fsPromises.writeFile(signedPath, overlayed);
          d.documentUrl = signedPath;
          d.documentNom = `${(d.documentNom ?? d.numeroDevis).replace(/\.pdf$/i, "")}-signe.pdf`;
          d.documentOverlayApplied = true;
          schedulePersistStore();
          res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(d.documentNom)}"`);
          res.setHeader("Content-Type", "application/pdf");
          res.send(Buffer.from(overlayed));
          return;
        } catch (e) {
          console.warn("[client-download] Overlay signature échoué :", (e as Error).message);
        }
      }
      const filename = encodeURIComponent(d.documentNom ?? "devis.pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", "application/pdf");
      res.send(pdfBuffer);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // POST /api/client/devis-groupement/:id/signer
  app.post("/api/client/devis-groupement/:id/signer", clientAuthMiddleware, async (req: ClientReq, res) => {
    const id = Number(req.params.id);
    const contact = req.clientContact!;
    const d = devisGroupement.find((x) => x.id === id && x.clientNom === contact.entreprise);
    if (!d) { res.status(404).json({ error: "Devis introuvable" }); return; }
    if (d.statut !== "VALIDE") { res.status(400).json({ error: "Le devis doit être à l'état VALIDE avant signature" }); return; }
    if (!d.documentUrl) { res.status(400).json({ error: "Aucun document PDF associé à ce devis" }); return; }

    try {
      // Lire le PDF original
      const isLocal = path.isAbsolute(d.documentUrl) || d.documentUrl.startsWith("uploads");
      let originalPdf: Buffer;
      if (isLocal) {
        const filePath = path.isAbsolute(d.documentUrl) ? d.documentUrl : path.resolve(d.documentUrl);
        originalPdf = await fsPromises.readFile(filePath);
      } else {
        const key = d.documentUrl.replace(/^devis-groupement\//, "");
        const stream = await getMinio().getObject(MINIO_BUCKETS.clientDocs, key);
        const chunks: Buffer[] = [];
        await new Promise<void>((ok, ko) => { stream.on("data", (c: Buffer) => chunks.push(c)); stream.on("end", ok); stream.on("error", ko); });
        originalPdf = Buffer.concat(chunks);
      }

      const signataireName = `${contact.prenom} ${contact.nom}`.trim();
      const signedDate = new Date().toISOString();
      const signedPdf = await overlaySignatureOnPdf(originalPdf, "", signedDate, signataireName);

      // Sauvegarder le PDF signé (écrase le fichier local ou crée un nouveau fichier)
      const signedDir = path.resolve("uploads", "devis-groupement", "signed");
      fs.mkdirSync(signedDir, { recursive: true });
      const signedName = `signed-${id}-${Date.now()}.pdf`;
      const signedPath = path.join(signedDir, signedName);
      await fsPromises.writeFile(signedPath, signedPdf);

      // Mettre à jour le devis
      d.documentUrl = signedPath;
      d.documentNom = `${d.documentNom?.replace(/\.pdf$/i, "") ?? d.numeroDevis}-signe.pdf`;
      d.signatureClientUrl = "lvo-stamp";
      d.signatureClientDate = signedDate;
      d.documentOverlayApplied = true;
      d.statut = "SIGNE";
      d.updatedAt = signedDate;

      // Notification client
      clientNotifications.push({
        id: Math.max(0, ...clientNotifications.map((n) => n.id), 0) + 1,
        entreprise: contact.entreprise,
        title: "Devis signé",
        message: `Votre signature a bien été apposée sur le devis ${d.numeroDevis}. Le PDF signé est disponible au téléchargement.`,
        kind: "SUCCESS" as "INFO",
        href: "/espace-client/devis",
        read: false,
        createdAt: signedDate,
      });

      schedulePersistStore();
      res.json({ ok: true, devis: d });
    } catch (e) {
      console.error("[signer] Erreur overlay PDF :", e);
      res.status(500).json({ error: "Erreur lors de la génération du PDF signé : " + (e as Error).message });
    }
  });

  // POST /api/client/devis-groupement/:id/bon-commande — upload bon de commande
  app.post(
    "/api/client/devis-groupement/:id/bon-commande",
    clientAuthMiddleware,
    devisUploadMiddleware.single("file"),
    async (req: ClientReq, res) => {
      const id = Number(req.params.id);
      const contact = req.clientContact!;
      const d = devisGroupement.find((x) => x.id === id && x.clientNom === contact.entreprise);
      if (!d) { res.status(404).json({ error: "Devis introuvable" }); return; }
      if (d.statut !== "VALIDE" && d.statut !== "SIGNE") {
        res.status(400).json({ error: "Le bon de commande ne peut être déposé que sur un devis validé ou signé" });
        return;
      }
      const file = req.file;
      if (!file) { res.status(400).json({ error: "Fichier PDF requis" }); return; }
      if (file.mimetype !== "application/pdf") { res.status(400).json({ error: "Seuls les fichiers PDF sont acceptés" }); return; }

      // Sauvegarde locale
      const bcDir = path.resolve("uploads", "devis-groupement", "bon-commande");
      fs.mkdirSync(bcDir, { recursive: true });
      const safeName = `${id}-${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const bcPath = path.join(bcDir, safeName);
      await fsPromises.writeFile(bcPath, file.buffer);

      const now = new Date().toISOString();
      d.bonCommandeUrl = bcPath;
      d.bonCommandeNom = file.originalname;
      d.bonCommandeUploadedAt = now;
      d.bonCommandeExtraction = await tryExtractBonCommande(file.buffer);
      d.updatedAt = now;

      clientNotifications.push({
        id: Math.max(0, ...clientNotifications.map((n) => n.id), 0) + 1,
        entreprise: contact.entreprise,
        title: "Bon de commande déposé",
        message: `Votre bon de commande pour le devis ${d.numeroDevis} a été transmis à LVO Ingénierie.`,
        kind: "SUCCESS" as "INFO",
        href: "/espace-client/devis",
        read: false,
        createdAt: now,
      });

      schedulePersistStore();

      const ascensoristeEmail = getAscensoristeEmail(d.uploadedByAscensoristeId);
      if (ascensoristeEmail) {
        void sendMail({
          to: ascensoristeEmail,
          subject: `[LVO] Bon de commande déposé — devis ${d.numeroDevis}`,
          html: renderMailHtml(
            "Bon de commande déposé",
            `<p>Le client <strong>${contact.entreprise}</strong> a déposé le bon de commande pour le devis <strong>${d.numeroDevis}</strong>${d.numeroAppareil ? ` (appareil ${d.numeroAppareil})` : ""}.</p>
             <p>Vous pouvez désormais préparer l'intervention et déposer le PV depuis votre espace ascensoriste.</p>`
          ),
        });
      }

      res.status(201).json({ ok: true, nom: file.originalname, uploadedAt: now, extraction: d.bonCommandeExtraction });
    }
  );

  // GET /api/client/devis-groupement/:id/bon-commande/download
  app.get("/api/client/devis-groupement/:id/bon-commande/download", clientAuthMiddleware, async (req: ClientReq, res) => {
    const id = Number(req.params.id);
    const contact = req.clientContact!;
    const d = devisGroupement.find((x) => x.id === id && x.clientNom === contact.entreprise);
    if (!d || !d.bonCommandeUrl) { res.status(404).json({ error: "Bon de commande introuvable" }); return; }
    try {
      const buf = await fsPromises.readFile(d.bonCommandeUrl);
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(d.bonCommandeNom ?? "bon-commande.pdf")}"`);
      res.setHeader("Content-Type", "application/pdf");
      res.send(buf);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // DELETE /api/client/devis-groupement/:id/bon-commande — le client ne peut retirer son bon
  // de commande que tant que le devis n'est pas encore validé/signé par LVO.
  app.delete("/api/client/devis-groupement/:id/bon-commande", clientAuthMiddleware, async (req: ClientReq, res) => {
    const id = Number(req.params.id);
    const contact = req.clientContact!;
    const d = devisGroupement.find((x) => x.id === id && x.clientNom === contact.entreprise);
    if (!d || !d.bonCommandeUrl) { res.status(404).json({ error: "Bon de commande introuvable" }); return; }
    if (d.statut === "VALIDE" || d.statut === "SIGNE") {
      res.status(403).json({ error: "Ce devis est déjà validé : seul LVO Ingénierie peut retirer le bon de commande" });
      return;
    }
    try { await fsPromises.unlink(d.bonCommandeUrl); } catch { /* fichier déjà absent */ }
    d.bonCommandeUrl = null;
    d.bonCommandeNom = null;
    d.bonCommandeUploadedAt = null;
    d.bonCommandeExtraction = null;
    d.updatedAt = new Date().toISOString();
    schedulePersistStore();
    res.json({ ok: true });
  });
}

// ─── Routes espace ascensoriste ────────────────────────────────────────────
// L'ascensoriste dépose le devis pour un de ses appareils ; le client final
// reste responsable de la signature et du dépôt du bon de commande.

export function registerAscensoristeDevisRoutes(
  app: express.Express,
  ascensoristeAuthMiddleware: express.RequestHandler,
  devisUploadMiddleware: ReturnType<typeof multer>
): void {
  type AscReq = express.Request & { ascensoriste?: { id: number; entreprise: string; nom: string; prenom: string } };

  // GET /api/ascensoriste/appareils — appareils dont l'ascensoriste a la charge
  app.get("/api/ascensoriste/appareils", ascensoristeAuthMiddleware, (req: AscReq, res) => {
    const entreprise = req.ascensoriste!.entreprise;
    const list = appareils
      .filter((a) => a.entreprise === entreprise)
      .sort((a, b) => {
        if (a.enArret && !b.enArret) return -1;
        if (!a.enArret && b.enArret) return 1;
        return a.numero.localeCompare(b.numero);
      });
    res.json(list);
  });

  // GET /api/ascensoriste/devis-groupement — devis déposés par cet ascensoriste
  app.get("/api/ascensoriste/devis-groupement", ascensoristeAuthMiddleware, (req: AscReq, res) => {
    const ascensoristeId = req.ascensoriste!.id;
    const list = devisGroupement
      .filter((d) => d.uploadedByAscensoristeId === ascensoristeId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json(list);
  });

  // POST /api/ascensoriste/devis-groupement — upload PDF pour un appareil donné
  app.post(
    "/api/ascensoriste/devis-groupement",
    ascensoristeAuthMiddleware,
    devisUploadMiddleware.single("file"),
    async (req: AscReq, res) => {
      const file = (req as express.Request & { file?: Express.Multer.File }).file;
      if (!file) { res.status(400).json({ error: "Fichier PDF requis" }); return; }
      const ascensoriste = req.ascensoriste!;

      try {
        const safeName = `${randomUUID()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        let documentUrl: string = `devis-groupement/${safeName}`;
        try {
          await getMinio().putObject(MINIO_BUCKETS.clientDocs, safeName, file.buffer, file.size, { "Content-Type": file.mimetype });
        } catch (e) {
          const dir = path.resolve("uploads", "devis-groupement");
          fs.mkdirSync(dir, { recursive: true });
          documentUrl = path.join(dir, safeName);
          fs.writeFileSync(documentUrl, file.buffer);
          console.warn("[devis-groupement] MinIO fallback local :", (e as Error).message);
        }

        const extracted = await tryExtractDevis(file.buffer);

        // Si le numéro d'appareil extrait du PDF correspond à un appareil connu de
        // l'ascensoriste, on le rattache (utile pour le suivi des arrêts), sans le rendre obligatoire.
        const appareilTrouve = extracted.numeroAppareil
          ? appareils.find((a) => a.numero === extracted.numeroAppareil && a.entreprise === ascensoriste.entreprise)
          : undefined;

        const now = new Date().toISOString();
        const row: DevisGroupementRow = {
          id: nextId(devisGroupement),
          numeroDevis: extracted.numeroDevis ?? `DRAFT-${Date.now()}`,
          clientNom: appareilTrouve?.clientNom ?? extracted.clientNom ?? "Non renseigné",
          appareilId: appareilTrouve?.id ?? null,
          numeroAppareil: extracted.numeroAppareil ?? null,
          entreprise: ascensoriste.entreprise,
          dateDevis: extracted.dateDevis ?? null,
          objet: extracted.objet ?? null,
          montantHt: extracted.montantHt ?? null,
          tauxTva: extracted.tauxTva ?? 2.10,
          montantTva: extracted.montantTva ?? null,
          montantTtc: extracted.montantTtc ?? null,
          ascenseurArret: appareilTrouve?.enArret ?? extracted.ascenseurArret ?? false,
          avisLvo: null,
          estimatifLvoHt: null,
          montantNegocieHt: null,
          economieHt: null,
          statut: "EN_ATTENTE",
          documentUrl,
          documentNom: file.originalname,
          documentSizeBytes: file.size,
          signatureAdminUrl: null,
          signatureClientUrl: null,
          signatureClientDate: null,
          documentOverlayApplied: false,
          bonCommandeUrl: null,
          bonCommandeNom: null,
          bonCommandeUploadedAt: null,
          bonCommandeExtraction: null,
          pvFichiers: [],
          pvDate: null,
          pvCommentaire: null,
          pvUploadedAt: null,
          motif: null,
          motifRefus: null,
          conditionsPaiement: null,
          batiment: extracted.batiment ?? null,
          adresse: extracted.adresse ?? null,
          uploadedByContactId: null,
          uploadedByAscensoristeId: ascensoriste.id,
          createdAt: now,
          updatedAt: now,
        };
        devisGroupement.push(row);
        schedulePersistStore();

        void sendMail({
          to: getAdminEmails(),
          subject: `[LVO] Nouveau devis déposé — ${ascensoriste.entreprise}`,
          html: renderMailHtml(
            "Nouveau devis déposé",
            `<p><strong>${ascensoriste.entreprise}</strong> a déposé le devis <strong>${row.numeroDevis}</strong>${row.adresse ? ` pour l'adresse <strong>${row.adresse}</strong>` : ""}${row.clientNom !== "Non renseigné" ? ` (client ${row.clientNom})` : ""}.</p>
             <p>Montant HT estimé : ${row.montantHt != null ? `${row.montantHt.toLocaleString("fr-FR")} €` : "non renseigné"}.</p>`
          ),
        });

        res.status(201).json(row);
      } catch (e) {
        console.error("[ascensoriste-devis] Dépôt échoué :", e);
        res.status(500).json({ error: "Erreur lors du dépôt du devis : " + (e as Error).message });
      }
    }
  );

  // GET /api/ascensoriste/devis-groupement/:id/download
  app.get("/api/ascensoriste/devis-groupement/:id/download", ascensoristeAuthMiddleware, async (req: AscReq, res) => {
    const id = Number(req.params.id);
    const ascensoriste = req.ascensoriste!;
    const d = devisGroupement.find((x) => x.id === id && x.uploadedByAscensoristeId === ascensoriste.id);
    if (!d || !d.documentUrl) { res.status(404).json({ error: "Document introuvable" }); return; }

    try {
      const isLocal = path.isAbsolute(d.documentUrl) || d.documentUrl.startsWith("uploads");
      let pdfBuffer: Buffer;
      if (isLocal) {
        const filePath = path.isAbsolute(d.documentUrl) ? d.documentUrl : path.resolve(d.documentUrl);
        if (!fs.existsSync(filePath)) { res.status(404).json({ error: "Fichier introuvable" }); return; }
        pdfBuffer = await fsPromises.readFile(filePath);
      } else {
        const key = d.documentUrl.replace(/^devis-groupement\//, "");
        const stream = await getMinio().getObject(MINIO_BUCKETS.clientDocs, key);
        const chunks: Buffer[] = [];
        await new Promise<void>((ok, ko) => { stream.on("data", (c: Buffer) => chunks.push(c)); stream.on("end", ok); stream.on("error", ko); });
        pdfBuffer = Buffer.concat(chunks);
      }
      const filename = encodeURIComponent(d.documentNom ?? "devis.pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", "application/pdf");
      res.send(pdfBuffer);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // POST /api/ascensoriste/devis-groupement/:id/redeposer — nouvelle version du devis (ex. après refus)
  app.post(
    "/api/ascensoriste/devis-groupement/:id/redeposer",
    ascensoristeAuthMiddleware,
    devisUploadMiddleware.single("file"),
    async (req: AscReq, res) => {
      const id = Number(req.params.id);
      const ascensoriste = req.ascensoriste!;
      const d = devisGroupement.find((x) => x.id === id && x.uploadedByAscensoristeId === ascensoriste.id);
      if (!d) { res.status(404).json({ error: "Devis introuvable" }); return; }
      if (d.statut !== "REFUSE") { res.status(400).json({ error: "Seul un devis refusé peut être redéposé" }); return; }
      const file = (req as express.Request & { file?: Express.Multer.File }).file;
      if (!file) { res.status(400).json({ error: "Fichier PDF requis" }); return; }

      try {
        const safeName = `${randomUUID()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        let documentUrl: string = `devis-groupement/${safeName}`;
        try {
          await getMinio().putObject(MINIO_BUCKETS.clientDocs, safeName, file.buffer, file.size, { "Content-Type": file.mimetype });
        } catch (e) {
          const dir = path.resolve("uploads", "devis-groupement");
          fs.mkdirSync(dir, { recursive: true });
          documentUrl = path.join(dir, safeName);
          fs.writeFileSync(documentUrl, file.buffer);
          console.warn("[devis-groupement] MinIO fallback local :", (e as Error).message);
        }

        const extracted = await tryExtractDevis(file.buffer);
        const now = new Date().toISOString();
        d.documentUrl = documentUrl;
        d.documentNom = file.originalname;
        d.documentSizeBytes = file.size;
        d.documentOverlayApplied = false;
        if (extracted.montantHt != null) d.montantHt = extracted.montantHt;
        if (extracted.montantTva != null) d.montantTva = extracted.montantTva;
        if (extracted.montantTtc != null) d.montantTtc = extracted.montantTtc;
        if (extracted.dateDevis) d.dateDevis = extracted.dateDevis;
        if (extracted.objet) d.objet = extracted.objet;
        d.statut = "EN_ATTENTE";
        d.motifRefus = null;
        d.avisLvo = null;
        d.updatedAt = now;
        schedulePersistStore();
        res.json(d);
      } catch (e) {
        console.error("[ascensoriste-devis] Redépôt échoué :", e);
        res.status(500).json({ error: "Erreur lors du redépôt du devis : " + (e as Error).message });
      }
    }
  );

  // POST /api/ascensoriste/devis-groupement/:id/pv — dépôt du PV (fichiers + date + commentaire)
  app.post(
    "/api/ascensoriste/devis-groupement/:id/pv",
    ascensoristeAuthMiddleware,
    devisUploadMiddleware.array("files", 10),
    async (req: AscReq, res) => {
      const id = Number(req.params.id);
      const ascensoriste = req.ascensoriste!;
      const d = devisGroupement.find((x) => x.id === id && x.uploadedByAscensoristeId === ascensoriste.id);
      if (!d) { res.status(404).json({ error: "Devis introuvable" }); return; }
      if (!d.bonCommandeUrl) { res.status(400).json({ error: "Le PV ne peut être déposé qu'après réception du bon de commande" }); return; }

      const files = (req as express.Request & { files?: Express.Multer.File[] }).files ?? [];
      if (files.length === 0) { res.status(400).json({ error: "Au moins un fichier est requis" }); return; }

      try {
        const { date, commentaire } = req.body as Record<string, string>;
        const nouveauxFichiers: PvFichierRow[] = [];
        for (const file of files) {
          const safeName = `${randomUUID()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
          let url = `devis-groupement/pv/${safeName}`;
          try {
            await getMinio().putObject(MINIO_BUCKETS.clientDocs, `pv/${safeName}`, file.buffer, file.size, { "Content-Type": file.mimetype });
          } catch (e) {
            const dir = path.resolve("uploads", "devis-groupement", "pv");
            fs.mkdirSync(dir, { recursive: true });
            url = path.join(dir, safeName);
            fs.writeFileSync(url, file.buffer);
            console.warn("[devis-groupement] PV — MinIO fallback local :", (e as Error).message);
          }
          nouveauxFichiers.push({ nom: file.originalname, url, sizeBytes: file.size, contentType: file.mimetype });
        }

        const now = new Date().toISOString();
        d.pvFichiers = [...d.pvFichiers, ...nouveauxFichiers];
        if (date) d.pvDate = date;
        if (commentaire !== undefined) d.pvCommentaire = commentaire.trim() || null;
        d.pvUploadedAt = now;
        d.statut = "TERMINE";
        d.updatedAt = now;
        schedulePersistStore();

        if (d.clientNom) {
          clientNotifications.push({
            id: Math.max(0, ...clientNotifications.map((n) => n.id), 0) + 1,
            entreprise: d.clientNom,
            title: "Devis terminé",
            message: `Le procès-verbal du devis ${d.numeroDevis} a été déposé : l'intervention est terminée.`,
            kind: "SUCCESS" as "INFO",
            href: "/espace-client/devis",
            read: false,
            createdAt: now,
          });
        }

        res.status(201).json(d);
      } catch (e) {
        console.error("[ascensoriste-devis] Dépôt PV échoué :", e);
        res.status(500).json({ error: "Erreur lors du dépôt du PV : " + (e as Error).message });
      }
    }
  );

  // GET /api/ascensoriste/devis-groupement/:id/pv/download?file=<nom-stocke>
  app.get("/api/ascensoriste/devis-groupement/:id/pv/download", ascensoristeAuthMiddleware, async (req: AscReq, res) => {
    const id = Number(req.params.id);
    const ascensoriste = req.ascensoriste!;
    const d = devisGroupement.find((x) => x.id === id && x.uploadedByAscensoristeId === ascensoriste.id);
    if (!d) { res.status(404).json({ error: "Devis introuvable" }); return; }
    await downloadPvFile(d, req, res);
  });
}

async function downloadPvFile(d: DevisGroupementRow, req: express.Request, res: express.Response): Promise<void> {
  const fileUrl = String((req.query as Record<string, string | undefined>).file ?? "");
  const pv = d.pvFichiers.find((f) => f.url === fileUrl);
  if (!pv) { res.status(404).json({ error: "Fichier PV introuvable" }); return; }
  try {
    const isLocal = path.isAbsolute(pv.url) || pv.url.startsWith("uploads");
    let buf: Buffer;
    if (isLocal) {
      buf = await fsPromises.readFile(pv.url);
    } else {
      const key = pv.url.replace(/^devis-groupement\//, "");
      const stream = await getMinio().getObject(MINIO_BUCKETS.clientDocs, key);
      const chunks: Buffer[] = [];
      await new Promise<void>((ok, ko) => { stream.on("data", (c: Buffer) => chunks.push(c)); stream.on("end", ok); stream.on("error", ko); });
      buf = Buffer.concat(chunks);
    }
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(pv.nom)}"`);
    res.setHeader("Content-Type", pv.contentType || "application/octet-stream");
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
}
