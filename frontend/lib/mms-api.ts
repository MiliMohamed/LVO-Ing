import { normaliserClasseurExcel } from "@/lib/excel-normalize";
import type { MmsChartSpec } from "@/lib/mms-hypotheses";

/** URL de l'API Python MMS (FastAPI). */
function cheminSourceFichier(file: File): string {
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  return rel?.trim() || file.name;
}

export function getMmsApiBaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_MMS_API_URL?.trim();
  if (v) return v.replace(/\/$/, "");
  // Navigateur : appel direct (évite 405 si le proxy Next /mms-api n'est pas actif).
  if (typeof window !== "undefined") return "http://127.0.0.1:8765";
  // SSR / scripts : proxy Next en dev.
  return "/mms-api";
}

function messageErreurMms(status: number, text: string): string {
  try {
    const j = JSON.parse(text) as { detail?: string | { msg?: string }[] };
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail) && j.detail[0]?.msg) return j.detail[0].msg;
  } catch {
    /* corps brut */
  }
  if (status === 405) {
    return "Méthode HTTP refusée — vérifiez que npm run mms:api tourne sur le port 8765.";
  }
  return text || `Erreur MMS (${status})`;
}

export type MmsParams = {
  prestataire?: string;
  trimestre?: string;
  annee?: number;
  date_cr?: string;
  commentaire?: string;
  seuil_maintenance_jours?: number;
  seuil_pannes_an?: number;
  seuil_immo_h?: number;
  seuil_delai_h?: number;
  seuil_desincarc_min?: number;
  seuil_parachute_mois?: number;
  seuil_cables_mois?: number;
  tarif_jour?: number;
  tarif_panne?: number;
  tarif_heure_immo?: number;
  tarif_heure_delai?: number;
  table_classement?: Record<string, string>;
  filtre_client?: string;
  filtre_prestataire?: string;
  filtre_adresse?: string;
  enregistrer_sorties?: boolean;
  /** Décoché par défaut : immo 48 h/an appliquée au T4 uniquement */
  prorata_immo_trimestriel?: boolean;
  /** Décoché par défaut : pannes 2/an — indicateur seul en T1–T3 sans historique */
  prorata_pannes_trimestriel?: boolean;
  cumuler_trimestres_precedents?: boolean;
  /** Ascenseur → date ISO dernière visite T-1 (ex. T4 2025) */
  dernieres_visites?: Record<string, string>;
  cumul_pannes_par_appareil?: Record<string, number>;
  /** Profil hypothèses marché appliqué (CADJEE, SIDR, …) */
  hypotheses_client?: string;
  /** true = ne pas écraser le client lors d'une nouvelle détection auto */
  client_manuel?: boolean;
  prestataire_manuel?: boolean;
  /** Chemin relatif (webkitRelativePath) pour détection OTIS depuis dossier */
  chemin_source?: string;
  /** Intègre les graphiques PNG dans l'onglet Excel (défaut true) */
  integrer_graphiques?: boolean;
};

export type MmsDetectionMetadata = {
  client?: string | null;
  prestataire?: string | null;
  trimestre?: string | null;
  annee?: string | number | null;
  source_client?: string | null;
  source_prestataire?: string | null;
  libelle_source_client?: string;
  clients_disponibles?: string[];
  params_suggestes?: Partial<MmsParams>;
  format_source?: string | null;
};

export type MmsAnalyzeResponse = {
  ok: boolean;
  format_source?: string;
  indicateurs: {
    nb_interventions: number;
    nb_pannes_retenues: number;
    nb_visites_maintenance: number;
    nb_appareils: number;
    penalite_totale: number;
    tranches_delai: Record<string, number>;
    format_source?: string;
    mode_pannes?: string;
    mode_immobilisation?: string;
    libelle_mode_pannes?: string;
    libelle_mode_immobilisation?: string;
    nb_appareils_seuil_annuel_atteint?: number;
    mention_pannes?: string;
    appareils_voyant_pannes?: Array<{
      ascenseur: string;
      nb_pannes_trimestre: number;
      voyant_seuil_trimestre?: boolean;
    }>;
  };
  avertissements_delta?: string[];
  penalites: Record<string, unknown>;
  seuils_prorata?: Record<string, unknown>;
  fichiers: {
    excel_nom: string;
    word_nom: string;
    pdf_nom?: string;
    excel_base64: string;
    word_base64: string;
    pdf_base64?: string;
    pdf_erreur?: string;
  };
  clients: string[];
  adresses: string[];
  ascenseurs?: string[];
  alerte_prestataire?: string | null;
  couples_parc?: Array<{ client: string; prestataire: string; nb_appareils: number }>;
  prestataires_pour_client?: string[];
  avertissement?: string;
  hypotheses_client_applique?: string;
  detection_auto?: MmsDetectionMetadata;
  graphiques?: Record<string, MmsChartSpec>;
  tableaux_apercu?: {
    historique?: Record<string, unknown>[];
    synthese?: Record<string, unknown>[];
    maintenance?: Record<string, unknown>[];
    penalites_detail?: Record<string, unknown>;
  };
};

export async function detectMmsMetadata(
  fichierBrut: File,
  fichierParc: File | null,
  params: MmsParams,
): Promise<MmsDetectionMetadata> {
  const brut = await normaliserClasseurExcel(fichierBrut);
  const parc = fichierParc ? await normaliserClasseurExcel(fichierParc) : null;
  const form = new FormData();
  form.append("fichier_brut", brut);
  if (parc) form.append("fichier_parc", parc);
  form.append("params_json", JSON.stringify(params));

  const res = await fetch(`${getMmsApiBaseUrl()}/detect-metadata`, {
    method: "POST",
    body: form,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(messageErreurMms(res.status, text));
  return JSON.parse(text) as MmsDetectionMetadata;
}

export async function analyzeMmsFiles(
  fichierBrut: File,
  fichierParc: File | null,
  params: MmsParams,
  fichierDernieresVisites: File | null = null,
  fichierCumulPannes: File | null = null,
): Promise<MmsAnalyzeResponse> {
  const brut = await normaliserClasseurExcel(fichierBrut);
  const parc = fichierParc ? await normaliserClasseurExcel(fichierParc) : null;
  const dernieres = fichierDernieresVisites
    ? await normaliserClasseurExcel(fichierDernieresVisites)
    : null;
  const cumul = fichierCumulPannes ? await normaliserClasseurExcel(fichierCumulPannes) : null;

  const form = new FormData();
  form.append("fichier_brut", brut);
  if (parc) form.append("fichier_parc", parc);
  if (dernieres) form.append("fichier_dernieres_visites", dernieres);
  if (cumul) form.append("fichier_cumul_pannes", cumul);
  form.append(
    "params_json",
    JSON.stringify({
      integrer_graphiques: true,
      ...params,
      chemin_source: cheminSourceFichier(fichierBrut),
    }),
  );

  const res = await fetch(`${getMmsApiBaseUrl()}/analyze`, {
    method: "POST",
    body: form,
  });

  const text = await res.text();
  if (!res.ok) throw new Error(messageErreurMms(res.status, text));

  return JSON.parse(text) as MmsAnalyzeResponse;
}

export type MmsParcCouplesResponse = {
  couples: Array<{ client: string; prestataire: string; nb_appareils: number }>;
  clients: string[];
  nb_appareils: number;
};

export async function fetchParcCouples(fichierParc: File): Promise<MmsParcCouplesResponse> {
  const parc = await normaliserClasseurExcel(fichierParc);
  const form = new FormData();
  form.append("fichier_parc", parc);
  const res = await fetch(`${getMmsApiBaseUrl()}/parc/couples`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<MmsParcCouplesResponse>;
}

const STORAGE_KEY_VISITES = "lvo-mms-dernieres-visites";

export function loadDernieresVisites(stockKey: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_VISITES}:${stockKey}`);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function saveDernieresVisites(stockKey: string, data: Record<string, string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${STORAGE_KEY_VISITES}:${stockKey}`, JSON.stringify(data));
}

export function stockKeyVisites(params: MmsParams): string {
  return `${params.hypotheses_client ?? params.filtre_client ?? "ALL"}_${params.prestataire ?? "ALL"}_${params.trimestre ?? "T1"}_${params.annee ?? ""}`;
}

export type MmsBatchJournalEntry = {
  fichier: string;
  statut: "ok" | "erreur" | "skipped" | "running";
  message?: string;
  client?: string;
  prestataire?: string;
  penalite_totale?: number;
  pdf_disponible?: boolean;
  pdf_erreur?: string;
};

export type MmsBatchStreamEvent = {
  type: string;
  index?: number;
  total?: number;
  fichier?: string;
  statut?: string;
  entry?: MmsBatchJournalEntry;
  message?: string;
  client?: string;
  prestataire?: string;
  penalite_totale?: number;
};

export type MmsBatchResult = {
  ok: boolean;
  journal: MmsBatchJournalEntry[];
  rapports: Array<{
    client: string;
    prestataire: string;
    penalite_totale: number;
    fichiers: MmsAnalyzeResponse["fichiers"];
  }>;
  consolide: Array<Record<string, unknown>>;
  nb_ok: number;
  nb_erreur: number;
  nb_skipped?: number;
  gher_consolide?: {
    word_nom: string;
    word_base64: string;
    pdf_nom?: string;
    pdf_base64?: string;
    pdf_erreur?: string;
  };
};

export async function analyzeBatchStream(
  fichiersBruts: File[],
  fichierParc: File | null,
  params: MmsParams,
  onEvent?: (event: MmsBatchStreamEvent) => void,
): Promise<MmsBatchResult> {
  const form = new FormData();
  for (const f of fichiersBruts) {
    const normalized = await normaliserClasseurExcel(f);
    form.append("fichiers_bruts", normalized, f.name);
  }
  if (fichierParc) {
    const parc = await normaliserClasseurExcel(fichierParc);
    form.append("fichier_parc", parc);
  }
  form.append("params_json", JSON.stringify(params));

  const res = await fetch(`${getMmsApiBaseUrl()}/analyze-batch-stream`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());

  const reader = res.body?.getReader();
  if (!reader) throw new Error("Flux de réponse indisponible");

  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: MmsBatchResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as MmsBatchStreamEvent & { type: string };
      onEvent?.(event);
      if (event.type === "result") {
        finalResult = event as unknown as MmsBatchResult;
      }
    }
  }

  if (!finalResult) throw new Error("Lot terminé sans résultat final");
  return finalResult;
}

export function downloadBase64File(base64: string, filename: string, mime: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
