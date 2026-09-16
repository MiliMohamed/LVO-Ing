/**
 * Formats de référencement LVO (Phase 1 / R4).
 * La génération atomique et les compteurs restent côté API ; ce module valide
 * les chaînes saisies ou affichées et garantit la cohérence avec le type de mission.
 */

/** Types sélectionnables pour une nouvelle offre/commande. ADC/MCM/MCN ont été retirés de la
 * sélection (jamais réellement outillés) mais restent reconnus en lecture pour les anciennes
 * offres — cf. `LEGACY_MISSION_TYPES` plus bas, utilisé par la validation de référence. */
export const LVO_MISSION_TYPES = ["A", "CTQ", "MOE", "ET", "MM", "MS"] as const;

export type LvoMissionType = (typeof LVO_MISSION_TYPES)[number];

/** Types historiques non sélectionnables mais dont d'anciennes offres/commandes peuvent encore
 * porter la référence (ex. LVO-MCN-2026-004) — gardés uniquement pour que le format de ces
 * références reste reconnu comme valide, jamais proposés à la création. */
const LEGACY_MISSION_TYPES = ["ADC", "MCM", "MCN"] as const;

/** Ordre alternance regex : préfixes les plus longs d'abord pour éviter qu'« A » absorbe « ADC »/« CTQ ». */
const TYPE_REGEX = ([...LEGACY_MISSION_TYPES, ...LVO_MISSION_TYPES] as string[])
  .filter((t) => t !== "A")
  .sort((a, b) => b.length - a.length)
  .concat("A")
  .join("|");

const RE_OFFRE = new RegExp(`^LVO-(${TYPE_REGEX})-(\\d{2})(\\d{3})(?:-([A-Z]))?$`, "i");
const RE_COMMANDE = new RegExp(`^(\\d{4})-LVO-(${TYPE_REGEX})-(\\d{3})$`, "i");
const RE_FACTURE = /^LVO-F(\d{4})-(\d{3})$/i;

function normalizeMissionType(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isKnownMissionType(t: string): t is LvoMissionType {
  const u = normalizeMissionType(t);
  return (LVO_MISSION_TYPES as readonly string[]).includes(u);
}

/** Comme `isKnownMissionType`, mais accepte aussi les anciens types retirés de la sélection
 * (ADC/MCM/MCN) — utilisé pour valider le format d'une référence existante sans la rejeter. */
function isKnownOrLegacyMissionType(t: string): boolean {
  const u = normalizeMissionType(t);
  return (LVO_MISSION_TYPES as readonly string[]).includes(u) || (LEGACY_MISSION_TYPES as readonly string[]).includes(u);
}

/** Premier type connu selon l’ordre LVO (cohérence avec le préfixe du n° commande). */
export function primaryMissionFromSelection(selected: string[]): string {
  const set = new Set(selected.map((s) => normalizeMissionType(s)).filter(Boolean));
  for (const t of LVO_MISSION_TYPES) {
    if (set.has(t)) return t;
  }
  return normalizeMissionType(selected[0] ?? "") || "MS";
}

/** null = valide ; sinon message d'erreur court. */
export function validateOffreReference(numeroOffre: string, typeMission: string): string | null {
  const ref = numeroOffre.trim();
  if (!ref) return "N° offre obligatoire.";
  const m = ref.match(RE_OFFRE);
  if (!m) {
    return "Format attendu : LVO-TYPE-YYnnn ou LVO-TYPE-YYnnn-R (ex. LVO-MOE-26009).";
  }
  const typeInRef = m[1].toUpperCase();
  const declared = normalizeMissionType(typeMission);
  if (!isKnownOrLegacyMissionType(declared)) return "Type de mission inconnu.";
  if (typeInRef !== declared) {
    return `Le type dans la référence (${typeInRef}) doit correspondre au type de mission (${declared}).`;
  }
  return null;
}

export function validateCommandeReference(numeroCommande: string, typeMission: string): string | null {
  const ref = numeroCommande.trim();
  if (!ref) return "N° commande obligatoire.";
  const m = ref.match(RE_COMMANDE);
  if (!m) {
    return "Format attendu : YYYY-LVO-TYPE-nnn (ex. 2026-LVO-MOE-006).";
  }
  const typeInRef = m[2].toUpperCase();
  const declared = normalizeMissionType(typeMission);
  if (!isKnownOrLegacyMissionType(declared)) return "Type de mission inconnu.";
  if (typeInRef !== declared) {
    return `Le type dans la référence (${typeInRef}) doit correspondre au type de mission (${declared}).`;
  }
  return null;
}

export function validateFactureReference(numeroFacture: string): string | null {
  const ref = numeroFacture.trim();
  if (!ref) return "N° facture obligatoire.";
  if (!RE_FACTURE.test(ref)) {
    return "Format attendu : LVO-FYYYY-nnn (ex. LVO-F2026-001).";
  }
  return null;
}

export function referenceHints(): { offre: string; commande: string; facture: string } {
  return {
    offre: "LVO-{TYPE}-YYnnn ou LVO-{TYPE}-YYnnn-R (révision), ex. LVO-MOE-26009",
    commande: "YYYY-LVO-TYPE-nnn, ex. 2026-LVO-MOE-006",
    facture: "LVO-FYYYY-nnn, ex. LVO-F2026-001",
  };
}
