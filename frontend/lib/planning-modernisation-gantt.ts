/**
 * Planning Gantt générique (multi-lots, lignes d’ouvrage variables).
 * Compatible avec l’ancien JSON (armoires + lane ENTREPRISE/AMR/…).
 */

export type PlanningLot = {
  id: string;
  /** Nom affiché (ex. « Lot principal », « Sous-traitant X »). */
  libelle: string;
  /** Couleur des barres (#RRGGBB). */
  couleur: string;
};

export type GanttBar = {
  id: string;
  /** Référence à `PlanningLot.id`. */
  lotId: string;
  libelle: string;
  /** Semaine 0 = lundi de la semaine contenant `dateDebutISO`. */
  debutSemaine: number;
  dureeSemaines: number;
};

export type PlanningGanttDoc = {
  /** Identifiant stable du projet (fichier / onglet Excel). */
  projetId: string;
  /** Nom affiché du projet / chantier. */
  projetNom: string;
  /** Référence libre (site, commande, code interne). */
  projetRef?: string;
  /** Nombre de mois visibles sur la frise (minimum couvert par la grille). */
  horizonMois: number;
  titre: string;
  sousTitre: string;
  /** Lignes d’ouvrage / équipements / zones — libellés libres, séparés côté UI par virgules. */
  elements: string[];
  lots: PlanningLot[];
  dateDebutISO: string;
  bars: GanttBar[];
};

/** @deprecated alias historique */
export type PlanningModernisationDoc = PlanningGanttDoc;

export const STORAGE_KEY_PLANNING_GANTT = "crm-planning-gantt-generic-v2";

/** Liste des projets ayant un planning enregistré (navigateur). */
export const PLANNING_PROJECTS_INDEX_KEY = "crm-planning-projects-index-v1";

export const PLANNING_LAST_PROJECT_KEY = "crm-planning-last-project-id";

export type PlanningProjectMeta = {
  id: string;
  nom: string;
  updatedAt: string;
};

export function planningDocStorageKey(projetId: string): string {
  return `crm-planning-doc-${projetId}`;
}

export function newPlanningProjetId(): string {
  return `proj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function readPlanningProjectList(): PlanningProjectMeta[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PLANNING_PROJECTS_INDEX_KEY);
    if (!raw?.trim()) return [];
    const j = JSON.parse(raw) as unknown;
    if (!Array.isArray(j)) return [];
    return j
      .map((x) => {
        const o = x as Record<string, unknown>;
        const id = typeof o.id === "string" ? o.id.trim() : "";
        const nom = typeof o.nom === "string" ? o.nom.trim() : "";
        const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString();
        if (!id) return null;
        return { id, nom: nom || "Sans nom", updatedAt };
      })
      .filter((x): x is PlanningProjectMeta => x != null)
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  } catch {
    return [];
  }
}

export function upsertPlanningProjectMeta(meta: PlanningProjectMeta): void {
  if (typeof window === "undefined") return;
  const list = readPlanningProjectList().filter((p) => p.id !== meta.id);
  list.push(meta);
  list.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  localStorage.setItem(PLANNING_PROJECTS_INDEX_KEY, JSON.stringify(list));
}

export function removePlanningProjectFromIndex(projetId: string): void {
  if (typeof window === "undefined") return;
  const list = readPlanningProjectList().filter((p) => p.id !== projetId);
  localStorage.setItem(PLANNING_PROJECTS_INDEX_KEY, JSON.stringify(list));
  try {
    localStorage.removeItem(planningDocStorageKey(projetId));
  } catch {
    /* ignore */
  }
}

export const DEFAULT_ELEMENTS = ["Équipement 1", "Équipement 2", "Équipement 3"];

const LEGACY_LANE_TO_LOT: Record<string, string> = {
  ENTREPRISE: "lot-1",
  AMR: "lot-2",
  OLEOLIFT: "lot-3",
  OTIS: "lot-4",
};

export function defaultGenericLots(): PlanningLot[] {
  return [
    { id: "lot-1", libelle: "Lot principal", couleur: "#1a365d" },
    { id: "lot-2", libelle: "Lot 2 (coordination / ST)", couleur: "#6b7280" },
    { id: "lot-3", libelle: "Lot 3", couleur: "#ea580c" },
    { id: "lot-4", libelle: "Lot 4", couleur: "#172554" },
  ];
}

export function lotCouleur(doc: PlanningGanttDoc, lotId: string): string {
  return doc.lots.find((l) => l.id === lotId)?.couleur ?? "#64748b";
}

export function lotLibelle(doc: PlanningGanttDoc, lotId: string): string {
  return doc.lots.find((l) => l.id === lotId)?.libelle ?? lotId;
}

export function buildGenericTemplateBars(elements: string[], lots: PlanningLot[]): GanttBar[] {
  const els = elements.length > 0 ? elements : DEFAULT_ELEMENTS;
  const L = lots.length > 0 ? lots : defaultGenericLots();
  const primary = L[0]!;
  const prepWeeks = Math.max(6, 6 + els.length * 2);
  const mk = (id: string, lotId: string, libelle: string, ds: number, d: number): GanttBar => ({
    id,
    lotId,
    libelle,
    debutSemaine: ds,
    dureeSemaines: Math.max(1, d),
  });
  const bars: GanttBar[] = [];
  bars.push(mk("t-prep", primary.id, "Préparation & approvisionnement", 0, Math.min(20, prepWeeks)));
  const startReal = Math.min(8, prepWeeks - 4);
  els.forEach((el, i) => {
    bars.push(mk(`t-${primary.id}-e${i}`, primary.id, `Réalisation — ${el}`, startReal + i * 2, 2));
  });
  const tEnd = startReal + els.length * 2 + 2;
  bars.push(mk("t-ctrl", primary.id, "Contrôle / essais", tEnd, 2));
  bars.push(mk("t-close", primary.id, "Clôture chantier", tEnd + 2, 2));

  for (let li = 1; li < L.length; li++) {
    const lot = L[li]!;
    bars.push(mk(`t-${lot.id}-rel`, lot.id, "Relevé / lancement lot", 1 + li, 2));
    els.forEach((el, i) => {
      bars.push(mk(`t-${lot.id}-e${i}`, lot.id, `Intervention — ${el}`, 8 + i * 2 + li, 2));
    });
  }
  return bars;
}

export function defaultPlanningDoc(): PlanningGanttDoc {
  const elements = [...DEFAULT_ELEMENTS];
  const lots = defaultGenericLots();
  return {
    projetId: newPlanningProjetId(),
    projetNom: "Nouveau projet",
    projetRef: "",
    horizonMois: 24,
    titre: "Planning chantier — vue Gantt (modèle générique)",
    sousTitre: `Lignes suivies : ${elements.join(" · ")}`,
    dateDebutISO: new Date().toISOString().slice(0, 10),
    elements,
    lots,
    bars: buildGenericTemplateBars(elements, lots),
  };
}

function parseLots(raw: unknown): PlanningLot[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: PlanningLot[] = [];
  for (let i = 0; i < raw.length; i++) {
    const o = raw[i] as Record<string, unknown>;
    const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : `lot-${i}`;
    const libelle = typeof o.libelle === "string" && o.libelle.trim() ? o.libelle.trim() : `Lot ${i + 1}`;
    const couleur =
      typeof o.couleur === "string" && /^#[0-9A-Fa-f]{6}$/.test(o.couleur) ? o.couleur : defaultGenericLots()[i % 4]!.couleur;
    out.push({ id, libelle, couleur });
  }
  return out;
}

export function parsePlanningDoc(raw: string | null | undefined): PlanningGanttDoc {
  if (!raw?.trim()) return defaultPlanningDoc();
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    const titre =
      typeof j.titre === "string" ? j.titre : "Planning chantier — vue Gantt (modèle générique)";
    const sousTitre = typeof j.sousTitre === "string" ? j.sousTitre : "";

    let projetId = "proj-default";
    if (typeof j.projetId === "string" && j.projetId.trim()) projetId = j.projetId.trim();
    else if (typeof j.projet_id === "string" && String(j.projet_id).trim()) projetId = String(j.projet_id).trim();
    const projetNom =
      typeof j.projetNom === "string" && j.projetNom.trim()
        ? j.projetNom.trim()
        : typeof j.projet_nom === "string" && String(j.projet_nom).trim()
          ? String(j.projet_nom).trim()
          : titre.slice(0, 120);
    const projetRef =
      typeof j.projetRef === "string" ? j.projetRef : typeof j.projet_ref === "string" ? String(j.projet_ref) : "";
    const hm = Number(j.horizonMois ?? j.horizon_mois);
    const horizonMois = Number.isFinite(hm) ? Math.min(60, Math.max(6, Math.round(hm))) : 24;

    const elementsRaw = j.elements ?? j.armoires;
    const elements = Array.isArray(elementsRaw)
      ? (elementsRaw as unknown[]).map((x) => String(x).trim()).filter(Boolean)
      : [...DEFAULT_ELEMENTS];

    const dateDebutISO =
      typeof j.dateDebutISO === "string" && /^\d{4}-\d{2}-\d{2}$/.test(j.dateDebutISO)
        ? j.dateDebutISO
        : new Date().toISOString().slice(0, 10);

    let lots = parseLots(j.lots);
    if (!lots) lots = defaultGenericLots();

    const barsRaw = Array.isArray(j.bars) ? j.bars : [];
    const bars: GanttBar[] = barsRaw.map((b, idx) => {
      const o = b as Record<string, unknown>;
      let lotId = typeof o.lotId === "string" && o.lotId.trim() ? o.lotId.trim() : "";
      if (!lotId) {
        const lane = typeof o.lane === "string" ? o.lane : "";
        lotId = LEGACY_LANE_TO_LOT[lane] ?? lots[0]!.id;
      }
      if (!lots.some((l) => l.id === lotId)) lotId = lots[0]!.id;

      return {
        id: typeof o.id === "string" ? o.id : `bar-${idx}`,
        lotId,
        libelle: typeof o.libelle === "string" ? o.libelle : "Tâche",
        debutSemaine: Number.isFinite(Number(o.debutSemaine)) ? Math.max(0, Math.round(Number(o.debutSemaine))) : 0,
        dureeSemaines: Number.isFinite(Number(o.dureeSemaines)) ? Math.max(1, Math.round(Number(o.dureeSemaines))) : 1,
      };
    });

    if (bars.length === 0) {
      return {
        projetId,
        projetNom,
        projetRef,
        horizonMois,
        titre,
        sousTitre,
        elements,
        lots,
        dateDebutISO,
        bars: buildGenericTemplateBars(elements, lots),
      };
    }
    return { projetId, projetNom, projetRef, horizonMois, titre, sousTitre, elements, lots, dateDebutISO, bars };
  } catch {
    return defaultPlanningDoc();
  }
}

export function stringifyPlanningDoc(doc: PlanningGanttDoc): string {
  return JSON.stringify(doc, null, 2);
}

/** Lundi de la semaine contenant la date locale `iso` (YYYY-MM-DD). */
export function mondayOfIsoWeek(iso: string): Date {
  const d = new Date(`${iso}T12:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addWeeksMonday(anchorMonday: Date, weekOffset: number): Date {
  const d = new Date(anchorMonday);
  d.setDate(d.getDate() + weekOffset * 7);
  return d;
}

export function weekRange(doc: PlanningGanttDoc): { min: number; max: number } {
  let min = 0;
  let max = 1;
  for (const b of doc.bars) {
    min = Math.min(min, b.debutSemaine);
    max = Math.max(max, b.debutSemaine + b.dureeSemaines);
  }
  return { min: Math.max(0, min), max: max + 1 };
}

export type MonthSpan = { label: string; weeks: number };

/** Une ligne « années » (fusion des semaines par année civile). */
export function yearSpansFromWeeks(anchorMonday: Date, weekCount: number): MonthSpan[] {
  const spans: MonthSpan[] = [];
  for (let w = 0; w < weekCount; w++) {
    const d = addWeeksMonday(anchorMonday, w);
    const label = String(d.getFullYear());
    const last = spans.at(-1);
    if (last && last.label === label) last.weeks += 1;
    else spans.push({ label, weeks: 1 });
  }
  return spans;
}

/** Ligne « mois » : nom complet du mois (tous les mois couverts par la frise). */
export function monthNameSpansFromWeeks(anchorMonday: Date, weekCount: number): MonthSpan[] {
  const spans: { ym: string; label: string; weeks: number }[] = [];
  for (let w = 0; w < weekCount; w++) {
    const d = addWeeksMonday(anchorMonday, w);
    const ym = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
    const rawLabel = d.toLocaleDateString("fr-FR", { month: "long" });
    const label = rawLabel ? rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1) : "";
    const last = spans.at(-1);
    if (last && last.ym === ym) last.weeks += 1;
    else spans.push({ ym, label, weeks: 1 });
  }
  return spans.map(({ label, weeks }) => ({ label, weeks }));
}

/** @deprecated Préférer `monthNameSpansFromWeeks` + `yearSpansFromWeeks` pour un en-tête type Excel. */
export function monthSpansFromWeeks(anchorMonday: Date, weekCount: number): MonthSpan[] {
  return monthNameSpansFromWeeks(anchorMonday, weekCount);
}

/** Ajuste l’ISO date en conservant le jour autant que possible (mois / année modifiés). */
export function isoWithYearMonth(iso: string, year: number, month1to12: number): string {
  const m = Math.min(12, Math.max(1, month1to12));
  const y = Math.min(2100, Math.max(1990, year));
  const parts = iso.trim().split("-").map((x) => Number(x));
  const dayWant = Number.isFinite(parts[2]) ? parts[2]! : 1;
  const dim = new Date(y, m, 0).getDate();
  const day = Math.min(Math.max(1, dayWant), dim);
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function sortedBars(doc: PlanningGanttDoc): GanttBar[] {
  const order = new Map(doc.lots.map((l, i) => [l.id, i]));
  return [...doc.bars].sort((a, b) => {
    const la = order.get(a.lotId) ?? 99;
    const lb = order.get(b.lotId) ?? 99;
    if (la !== lb) return la - lb;
    if (a.debutSemaine !== b.debutSemaine) return a.debutSemaine - b.debutSemaine;
    return a.libelle.localeCompare(b.libelle);
  });
}
