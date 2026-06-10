/**
 * Algorithme de scoring rapprochement Quonto ↔ facture (plan Phase 3 §B).
 * Réutilisable côté API ; exposé ici pour prévisualisation ou tests manuels.
 */

export type ScoreInput = {
  /** Montant facture attendu (TTC de préférence pour comparaison virement) */
  montantFactureTtc: number;
  /** Montant transaction bancaire */
  montantTransaction: number;
  /** Libellé / référence opération Quonto */
  libelle: string;
  /** Numéro facture LVO si connu */
  numeroFacture?: string | null;
  /** Nom client facture */
  clientNom?: string | null;
  /** IBAN client (optionnel) */
  clientIban?: string | null;
  /** Libellé contient cet IBAN fragment */
  libelleContientIban?: boolean;
  /** Date opération */
  dateOperation: Date;
  /** Date facture */
  dateFacture: Date;
  /** Date échéance facture */
  dateEcheance: Date | null;
};

const RE_FACTURE_LIBELLE = /LVO-F\d{4}-\d{3,}/i;

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + c);
    }
  }
  return dp[m][n];
}

function normalizeLibelle(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/**
 * Score 0–100. Seuils plan : ≥90 auto, 60–89 à valider, <60 file.
 */
export function scoreQuontoMatch(input: ScoreInput): number {
  let score = 0;
  const { montantFactureTtc, montantTransaction, libelle, numeroFacture, clientNom, dateOperation, dateFacture, dateEcheance } =
    input;

  if (montantFactureTtc > 0 && montantTransaction > 0) {
    const diff = Math.abs(montantFactureTtc - montantTransaction);
    if (diff < 0.01) score += 40;
    else {
      const ratio = diff / montantFactureTtc;
      if (ratio <= 0.005) score += 20;
    }
  }

  const lib = libelle;
  let factureInLibelle = false;
  if (numeroFacture?.trim()) {
    const escaped = numeroFacture.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(escaped, "i").test(lib)) factureInLibelle = true;
  }
  if (RE_FACTURE_LIBELLE.test(lib)) factureInLibelle = true;
  if (factureInLibelle) score += 30;

  if (clientNom?.trim()) {
    const parts = normalizeLibelle(lib).split(/\W+/).filter(Boolean);
    const target = normalizeLibelle(clientNom);
    const ok = parts.some((p) => p.length >= 3 && levenshtein(p, target) < 3);
    if (ok) score += 15;
  }

  if (input.libelleContientIban) score += 10;

  const finFenetre = dateEcheance ? new Date(dateEcheance) : null;
  if (finFenetre) {
    finFenetre.setDate(finFenetre.getDate() + 30);
    if (dateOperation >= dateFacture && dateOperation <= finFenetre) score += 5;
  }

  return Math.min(100, score);
}
