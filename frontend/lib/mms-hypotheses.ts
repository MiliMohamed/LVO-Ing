import { getMmsApiBaseUrl } from "@/lib/mms-api";

export type HypothesesMarcheClient = {
  client_site: string;
  adresse_site: string;
  prestataire_defaut?: string;
  seuil_maintenance_jours: number;
  seuil_pannes_an: number;
  seuil_immo_h: number;
  seuil_delai_h: number;
  seuil_desincarc_min: number;
  seuil_parachute_mois: number;
  seuil_cables_mois: number;
  tarif_jour: number;
  tarif_panne: number;
  tarif_heure_immo: number;
  tarif_heure_delai: number;
  prorata_immo_trimestriel: boolean;
  prorata_pannes_trimestriel: boolean;
  commentaire_marche?: string;
};

export type HypothesesMarcheCatalogue = Record<string, HypothesesMarcheClient>;

export type MmsChartDataset = {
  label: string;
  data: number[];
};

export type MmsChartSpec = {
  type: "bar" | "doughnut" | "line";
  titre: string;
  labels: string[];
  datasets: MmsChartDataset[];
  stacked?: boolean;
};

/** Valeurs par défaut si l'API MMS n'est pas à jour (route /hypotheses-marche absente). */
export const HYPOTHESES_MARCHE_DEFAUT: HypothesesMarcheCatalogue = {
  CADJEE: {
    client_site: "CADJEE",
    adresse_site: "Centre d'Affaires CADJEE",
    prestataire_defaut: "OTIS",
    seuil_maintenance_jours: 42,
    seuil_pannes_an: 2,
    seuil_immo_h: 48,
    seuil_delai_h: 2,
    seuil_desincarc_min: 45,
    seuil_parachute_mois: 12,
    seuil_cables_mois: 6,
    tarif_jour: 50,
    tarif_panne: 150,
    tarif_heure_immo: 50,
    tarif_heure_delai: 50,
    prorata_immo_trimestriel: false,
    prorata_pannes_trimestriel: false,
    commentaire_marche: "Marché OTIS SCI — hypothèses par défaut (redémarrez npm run mms:api pour synchroniser le serveur).",
  },
  SIDR: {
    client_site: "SIDR",
    adresse_site: "Multisites La Réunion",
    prestataire_defaut: "OTIS",
    seuil_maintenance_jours: 42,
    seuil_pannes_an: 2,
    seuil_immo_h: 48,
    seuil_delai_h: 2,
    seuil_desincarc_min: 45,
    seuil_parachute_mois: 12,
    seuil_cables_mois: 6,
    tarif_jour: 50,
    tarif_panne: 200,
    tarif_heure_immo: 25,
    tarif_heure_delai: 30,
    prorata_immo_trimestriel: false,
    prorata_pannes_trimestriel: false,
    commentaire_marche: "",
  },
  SODIAC: {
    client_site: "SODIAC",
    adresse_site: "Parc ascenseurs SODIAC",
    prestataire_defaut: "OTIS",
    seuil_maintenance_jours: 42,
    seuil_pannes_an: 2,
    seuil_immo_h: 48,
    seuil_delai_h: 2,
    seuil_desincarc_min: 45,
    seuil_parachute_mois: 12,
    seuil_cables_mois: 6,
    tarif_jour: 50,
    tarif_panne: 200,
    tarif_heure_immo: 25,
    tarif_heure_delai: 30,
    prorata_immo_trimestriel: false,
    prorata_pannes_trimestriel: false,
    commentaire_marche: "",
  },
  SEMADER: {
    client_site: "SEMADER",
    adresse_site: "Parc ascenseurs SEMADER",
    prestataire_defaut: "OTIS",
    seuil_maintenance_jours: 42,
    seuil_pannes_an: 2,
    seuil_immo_h: 48,
    seuil_delai_h: 2,
    seuil_desincarc_min: 45,
    seuil_parachute_mois: 12,
    seuil_cables_mois: 6,
    tarif_jour: 50,
    tarif_panne: 200,
    tarif_heure_immo: 25,
    tarif_heure_delai: 30,
    prorata_immo_trimestriel: false,
    prorata_pannes_trimestriel: false,
    commentaire_marche: "",
  },
  CDC: {
    client_site: "CDC",
    adresse_site: "Parc ascenseurs CDC",
    prestataire_defaut: "OTIS",
    seuil_maintenance_jours: 42,
    seuil_pannes_an: 2,
    seuil_immo_h: 48,
    seuil_delai_h: 2,
    seuil_desincarc_min: 45,
    seuil_parachute_mois: 12,
    seuil_cables_mois: 6,
    tarif_jour: 50,
    tarif_panne: 200,
    tarif_heure_immo: 25,
    tarif_heure_delai: 30,
    prorata_immo_trimestriel: false,
    prorata_pannes_trimestriel: false,
    commentaire_marche: "",
  },
};

export type FetchHypothesesResult = {
  catalogue: HypothesesMarcheCatalogue;
  depuisApi: boolean;
  avertissement?: string;
};

export async function fetchHypothesesMarche(): Promise<FetchHypothesesResult> {
  const local = chargerHypothesesLocal();
  try {
    const res = await fetch(`${getMmsApiBaseUrl()}/hypotheses-marche`);
    if (res.ok) {
      const catalogue = (await res.json()) as HypothesesMarcheCatalogue;
      sauvegarderHypothesesLocal(catalogue);
      return { catalogue, depuisApi: true };
    }
    if (res.status === 404) {
      return {
        catalogue: local ?? structuredClone(HYPOTHESES_MARCHE_DEFAUT),
        depuisApi: false,
        avertissement:
          "API MMS à redémarrer : Ctrl+C sur npm run mms:api puis relancez. Valeurs locales utilisées.",
      };
    }
    const text = await res.text();
    throw new Error(text || `Erreur ${res.status}`);
  } catch (e) {
    if (e instanceof TypeError && String(e.message).includes("fetch")) {
      return {
        catalogue: structuredClone(HYPOTHESES_MARCHE_DEFAUT),
        depuisApi: false,
        avertissement: "Service MMS injoignable — lancez npm run mms:api",
      };
    }
    throw e instanceof Error ? e : new Error("Impossible de charger les hypothèses marché");
  }
}

const STORAGE_KEY = "lvo-mms-hypotheses-marche";

export function sauvegarderHypothesesLocal(catalogue: HypothesesMarcheCatalogue): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(catalogue));
  }
}

export function chargerHypothesesLocal(): HypothesesMarcheCatalogue | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as HypothesesMarcheCatalogue;
  } catch {
    return null;
  }
}

export async function saveHypothesesMarche(catalogue: HypothesesMarcheCatalogue): Promise<HypothesesMarcheCatalogue> {
  sauvegarderHypothesesLocal(catalogue);
  const res = await fetch(`${getMmsApiBaseUrl()}/hypotheses-marche`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(catalogue),
  });
  if (res.status === 404) {
    return catalogue;
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "Enregistrement des hypothèses échoué");
  }
  const j = (await res.json()) as { hypotheses: HypothesesMarcheCatalogue };
  return j.hypotheses;
}

/** Copie les champs hypothèses vers les paramètres d'analyse MMS. */
export function hypothesesVersParams(
  h: HypothesesMarcheClient,
  clientCle: string,
): Record<string, unknown> {
  return {
    hypotheses_client: clientCle,
    prestataire: h.prestataire_defaut ?? "OTIS",
    seuil_maintenance_jours: h.seuil_maintenance_jours,
    seuil_pannes_an: h.seuil_pannes_an,
    seuil_immo_h: h.seuil_immo_h,
    seuil_delai_h: h.seuil_delai_h,
    seuil_desincarc_min: h.seuil_desincarc_min,
    seuil_parachute_mois: h.seuil_parachute_mois,
    seuil_cables_mois: h.seuil_cables_mois,
    tarif_jour: h.tarif_jour,
    tarif_panne: h.tarif_panne,
    tarif_heure_immo: h.tarif_heure_immo,
    tarif_heure_delai: h.tarif_heure_delai,
    prorata_immo_trimestriel: h.prorata_immo_trimestriel,
    prorata_pannes_trimestriel: h.prorata_pannes_trimestriel,
    commentaire: h.commentaire_marche ?? "",
  };
}
