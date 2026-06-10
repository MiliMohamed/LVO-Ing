/**
 * Échéancier d'exécution (offre) — jalons avec dates et écarts en semaines
 * pour recalcul depuis la première date (logique type feuille « Modernisation »).
 */

export type EcheancierExecutionRow = {
  libelle: string;
  datePrevue: string;
  /** Décalage en semaines après le jalon précédent lors d'un « Recalculer ». */
  ecartSemaines?: number;
};

const DEFAULT_GENERIC: EcheancierExecutionRow[] = [
  { libelle: "Lancement mission", ecartSemaines: 0, datePrevue: "" },
  { libelle: "Livraison / clôture", ecartSemaines: 8, datePrevue: "" },
];

/** Jalons proches de la feuille « Modernisation » (synthèse LE CHOPIN) : OS → fabrication → travaux → réserves → réception. */
const TEMPLATE_MCM: EcheancierExecutionRow[] = [
  { libelle: "Envoi des OS", ecartSemaines: 0, datePrevue: "" },
  { libelle: "Relevé de mise en fabrication", ecartSemaines: 2, datePrevue: "" },
  { libelle: "Mise en fabrication et approvisionnement", ecartSemaines: 6, datePrevue: "" },
  { libelle: "Travaux — remplacement armoires / exécution", ecartSemaines: 14, datePrevue: "" },
  { libelle: "Levée des réserves", ecartSemaines: 2, datePrevue: "" },
  { libelle: "Réception définitive", ecartSemaines: 2, datePrevue: "" },
];

const TEMPLATE_MOE: EcheancierExecutionRow[] = [
  { libelle: "Lancement / OS", ecartSemaines: 0, datePrevue: "" },
  { libelle: "DCE / consultation", ecartSemaines: 4, datePrevue: "" },
  { libelle: "Exécution & suivi chantier", ecartSemaines: 12, datePrevue: "" },
  { libelle: "Réception & DOE", ecartSemaines: 4, datePrevue: "" },
];

const TEMPLATE_MCN: EcheancierExecutionRow[] = [
  { libelle: "Lancement mission neuf", ecartSemaines: 0, datePrevue: "" },
  { libelle: "APS / APD validés", ecartSemaines: 6, datePrevue: "" },
  { libelle: "PRO / DCE", ecartSemaines: 8, datePrevue: "" },
  { libelle: "Travaux & réception", ecartSemaines: 16, datePrevue: "" },
];

const TEMPLATE_MS_MM: EcheancierExecutionRow[] = [
  { libelle: "Démarrage", ecartSemaines: 0, datePrevue: "" },
  { libelle: "Visites / rapport intermédiaire", ecartSemaines: 4, datePrevue: "" },
  { libelle: "Restitution finale", ecartSemaines: 4, datePrevue: "" },
];

export function templateForMissionType(typeMission: string): EcheancierExecutionRow[] {
  const t = typeMission.trim().toUpperCase();
  if (t === "MCM") return TEMPLATE_MCM.map((r) => ({ ...r }));
  if (t === "MOE" || t === "ET") return TEMPLATE_MOE.map((r) => ({ ...r }));
  if (t === "MCN") return TEMPLATE_MCN.map((r) => ({ ...r }));
  if (t === "MS" || t === "MM") return TEMPLATE_MS_MM.map((r) => ({ ...r }));
  return DEFAULT_GENERIC.map((r) => ({ ...r }));
}

export function parseExecutionRows(raw: string): EcheancierExecutionRow[] {
  const t = raw.trim();
  if (!t) return DEFAULT_GENERIC.map((r) => ({ ...r }));
  try {
    const v = JSON.parse(t) as unknown;
    if (!Array.isArray(v) || v.length === 0) return DEFAULT_GENERIC.map((r) => ({ ...r }));
    return v.map((x) => {
      const o = x as Record<string, unknown>;
      const libelle = String(o.libelle ?? "").trim() || "Jalon";
      const datePrevue = String(o.datePrevue ?? "").slice(0, 10);
      const ec =
        typeof o.ecartSemaines === "number" && Number.isFinite(o.ecartSemaines)
          ? Math.max(0, Math.round(o.ecartSemaines))
          : undefined;
      return { libelle, datePrevue, ecartSemaines: ec };
    });
  } catch {
    return DEFAULT_GENERIC.map((r) => ({ ...r }));
  }
}

export function rowsToJson(rows: EcheancierExecutionRow[]): string {
  return JSON.stringify(rows, null, 0);
}

function addWeeks(isoDate: string, weeks: number): string {
  const base = isoDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(base)) return "";
  const d = new Date(`${base}T12:00:00`);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

/**
 * Recalcule les dates à partir de la première ligne : utilise `ecartSemaines`
 * entre jalons successifs (0 = même date que le départ pour la ligne 0).
 */
export function propagateFromFirst(rows: EcheancierExecutionRow[]): EcheancierExecutionRow[] {
  if (rows.length === 0) return rows;
  const first = rows[0].datePrevue.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(first)) return rows;

  const out = rows.map((r) => ({ ...r }));
  let prev = first;
  out[0] = { ...out[0], datePrevue: first };

  for (let i = 1; i < out.length; i++) {
    const gap = typeof out[i].ecartSemaines === "number" ? out[i].ecartSemaines! : 2;
    prev = addWeeks(prev, gap);
    out[i] = { ...out[i], datePrevue: prev };
  }
  return out;
}
