/**
 * Extrait de server/src/routes/devis-groupement.ts (tryExtractBonCommande + ses dépendances
 * étroites) — la fonctionnalité "devis groupement" reste entièrement dans l'ancien projet,
 * mais crm.ts en a besoin pour extraire les bons de commande déposés côté CRM.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { BonCommandeExtractionRow } from "../store.js";

const execFileAsync = promisify(execFile);

function findExtractorScript(scriptName = "bon_commande_extractor.py"): string | null {
  const candidates = [
    path.resolve(process.cwd(), "..", "..", "mms-analyzer", scriptName),
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
