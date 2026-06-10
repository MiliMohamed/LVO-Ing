"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { MaintenanceMmsCharts } from "@/components/crm/MaintenanceMmsCharts";
import { MaintenanceMmsBatchPanel } from "@/components/crm/MaintenanceMmsBatchPanel";
import { MaintenanceMmsHypothesesPanel } from "@/components/crm/MaintenanceMmsHypothesesPanel";
import {
  analyzeMmsFiles,
  downloadBase64File,
  fetchParcCouples,
  getMmsApiBaseUrl,
  loadDernieresVisites,
  saveDernieresVisites,
  stockKeyVisites,
  type MmsAnalyzeResponse,
  type MmsDetectionMetadata,
  type MmsParams,
  type MmsParcCouplesResponse,
} from "@/lib/mms-api";

const DEFAULT_PARAMS: MmsParams = {
  prestataire: "OTIS",
  trimestre: "T1",
  annee: new Date().getFullYear(),
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
  filtre_client: "Tous",
  filtre_prestataire: "Tous",
  filtre_adresse: "Tous",
  prorata_immo_trimestriel: false,
  prorata_pannes_trimestriel: false,
  dernieres_visites: {},
  client_manuel: false,
  prestataire_manuel: false,
};

export function MaintenanceMmsClient() {
  const [params, setParams] = useState<MmsParams>(DEFAULT_PARAMS);
  const [parcFile, setParcFile] = useState<File | null>(null);
  const [dernieresVisitesFile, setDernieresVisitesFile] = useState<File | null>(null);
  const [cumulPannesFile, setCumulPannesFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MmsAnalyzeResponse | null>(null);
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const lastBrutRef = useRef<File | null>(null);
  const [parcMeta, setParcMeta] = useState<MmsParcCouplesResponse | null>(null);
  const [detection, setDetection] = useState<MmsDetectionMetadata | null>(null);

  useEffect(() => {
    fetch(`${getMmsApiBaseUrl()}/health`)
      .then((r) => setApiOk(r.ok))
      .catch(() => setApiOk(false));
  }, []);

  useEffect(() => {
    const key = stockKeyVisites(params);
    const saved = loadDernieresVisites(key);
    if (Object.keys(saved).length > 0) {
      setParams((prev) => ({ ...prev, dernieres_visites: { ...saved, ...prev.dernieres_visites } }));
    }
  }, [params.hypotheses_client, params.prestataire, params.trimestre, params.annee]);

  const appliquerDetection = useCallback((meta: MmsDetectionMetadata, p: MmsParams): MmsParams => {
    const sug = meta.params_suggestes ?? {};
    const next: MmsParams = { ...p };
    if (!p.client_manuel) {
      const plusieurs =
        (meta.clients_disponibles?.length ?? 0) > 1 && !meta.client;
      if (plusieurs) {
        next.filtre_client = "Tous";
        next.hypotheses_client =
          sug.hypotheses_client ?? meta.clients_disponibles?.[0] ?? p.hypotheses_client;
      } else if (sug.filtre_client && sug.filtre_client !== "Tous") {
        next.filtre_client = sug.filtre_client;
        next.hypotheses_client = sug.hypotheses_client ?? sug.filtre_client;
      } else if (meta.client) {
        next.filtre_client = meta.client;
        next.hypotheses_client = meta.client;
      }
    }
    if (!p.prestataire_manuel) {
      const prest = sug.prestataire ?? meta.prestataire;
      if (prest && prest !== "PRESTATAIRES") {
        next.prestataire = prest;
        const fp = sug.filtre_prestataire ?? prest;
        if (fp && fp !== "Tous" && fp !== "PRESTATAIRES") {
          next.filtre_prestataire = fp;
        }
      }
    }
    if (meta.trimestre) next.trimestre = meta.trimestre;
    if (meta.annee) next.annee = Number(meta.annee);
    return next;
  }, []);

  const lancerAnalyse = useCallback(
    async (
      fichierBrut: File,
      parc: File | null,
      dernieres: File | null,
      cumul: File | null,
      p: MmsParams,
    ) => {
      setLoading(true);
      setError(null);
      try {
        const data = await analyzeMmsFiles(fichierBrut, parc, p, dernieres, cumul);
        setResult(data);
        if (data.detection_auto) {
          setDetection(data.detection_auto);
          setParams((prev) => appliquerDetection(data.detection_auto!, prev));
        }
      } catch (e) {
        setResult(null);
        setError(e instanceof Error ? e.message : "Erreur d'analyse");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const onBrutSelected = (file: File | undefined) => {
    if (!file) return;
    lastBrutRef.current = file;
    setDetection(null);
    void lancerAnalyse(file, parcFile, dernieresVisitesFile, cumulPannesFile, params);
  };

  const onParcSelected = (file: File | undefined) => {
    const f = file ?? null;
    setParcFile(f);
    setParcMeta(null);
    if (f) {
      void fetchParcCouples(f)
        .then((meta) => {
          setParcMeta(meta);
          if (meta.clients.length === 1 && !params.client_manuel) {
            patch({
              filtre_client: meta.clients[0],
              hypotheses_client: meta.clients[0],
            });
          }
        })
        .catch(() => setParcMeta(null));
    }
    if (lastBrutRef.current) void lancerAnalyse(lastBrutRef.current, f, dernieresVisitesFile, cumulPannesFile, params);
  };

  const onDernieresVisitesSelected = (file: File | undefined) => {
    const f = file ?? null;
    setDernieresVisitesFile(f);
    if (lastBrutRef.current) void lancerAnalyse(lastBrutRef.current, parcFile, f, cumulPannesFile, params);
  };

  const onCumulPannesSelected = (file: File | undefined) => {
    const f = file ?? null;
    setCumulPannesFile(f);
    patch({ cumuler_trimestres_precedents: Boolean(f) });
    if (lastBrutRef.current) void lancerAnalyse(lastBrutRef.current, parcFile, dernieresVisitesFile, f, params);
  };

  const relancer = () => {
    if (lastBrutRef.current) void lancerAnalyse(lastBrutRef.current, parcFile, dernieresVisitesFile, cumulPannesFile, params);
  };

  const relancerAfterPatch = (part: Partial<MmsParams>) => {
    if (!lastBrutRef.current) return;
    void lancerAnalyse(lastBrutRef.current, parcFile, dernieresVisitesFile, cumulPannesFile, {
      ...params,
      ...part,
    });
  };

  const patch = (part: Partial<MmsParams>) => {
    setParams((prev) => {
      const next = { ...prev, ...part };
      if (part.dernieres_visites) {
        saveDernieresVisites(stockKeyVisites(next), part.dernieres_visites);
      }
      return next;
    });
  };

  const reappliquerDetection = () => {
    const p = { ...params, client_manuel: false, prestataire_manuel: false };
    setParams(p);
    if (lastBrutRef.current) {
      void lancerAnalyse(lastBrutRef.current, parcFile, dernieresVisitesFile, cumulPannesFile, p);
    }
  };

  return (
    <>
      <header className="pg-hdr mb-4">
        <h1>Analyse maintenance ascenseurs (MMS)</h1>
        <p>
          Déposez le fichier brut prestataire (4 feuilles Excel, <strong>.xls ou .xlsx</strong>) : les anciens
          fichiers .xls sont convertis automatiquement (SheetJS) avant analyse. Téléchargez le Tableau MMS et le
          compte-rendu Word.
        </p>
      </header>

      {apiOk === false ? (
        <div className="crm-alert crm-alert--warn">
          <strong>Service MMS non démarré.</strong> Lancez{" "}
          <code className="rounded bg-white px-1">npm run mms:api</code> à la racine du projet.
        </div>
      ) : null}

      <MaintenanceMmsHypothesesPanel
        params={params}
        onParamsChange={patch}
        detection={detection}
        canReappliquerDetection={Boolean(lastBrutRef.current)}
        onReappliquerDetection={reappliquerDetection}
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <div className="fcard">
          <div className="fcard-hdr">
            <h2>Fichiers</h2>
          </div>
          <div className="fcard-body space-y-4">
            <label className="crm-field block">
              <span className="crm-label">
                Données brutes prestataire <span className="text-red-600">*</span>
              </span>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="crm-input"
                disabled={loading}
                onChange={(e) => onBrutSelected(e.target.files?.[0])}
              />
            </label>
            <label className="crm-field block">
              <span className="crm-label">Liste du parc (optionnel — colonnes Identité Client, Marque)</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="crm-input"
                disabled={loading}
                onChange={(e) => onParcSelected(e.target.files?.[0])}
              />
              {parcMeta ? (
                <p className="mt-1 text-xs text-neutral-600">
                  {parcMeta.nb_appareils} appareils — {parcMeta.couples.length} couple(s) client × prestataire
                </p>
              ) : null}
            </label>
            <label className="crm-field block">
              <span className="crm-label">Dernières visites T-1 par appareil (optionnel)</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="crm-input"
                disabled={loading}
                onChange={(e) => onDernieresVisitesSelected(e.target.files?.[0])}
              />
              <span className="mt-1 block text-xs text-neutral-500">
                Colonnes : Ascenseur, Date dernière visite — doit être antérieure à la 1<sup>re</sup> visite T1.
              </span>
            </label>
            <label className="crm-field block">
              <span className="crm-label">Cumul pannes T1–T3 (T4 uniquement, optionnel)</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="crm-input"
                disabled={loading}
                onChange={(e) => onCumulPannesSelected(e.target.files?.[0])}
              />
              <span className="mt-1 block text-xs text-neutral-500">
                Colonnes : Ascenseur, Nb pannes retenues cumul — active le bilan annuel au T4.
              </span>
            </label>
            {loading ? (
              <p className="text-sm font-medium text-[var(--orange)]">
                Lecture du classeur (.xls → .xlsx si besoin) et analyse…
              </p>
            ) : lastBrutRef.current ? (
              <p className="text-xs text-neutral-600">Dernier fichier : {lastBrutRef.current.name}</p>
            ) : null}
          </div>
        </div>

        <div className="fcard">
          <div className="fcard-hdr">
            <h2>Paramètres</h2>
          </div>
          <div className="fcard-body space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="crm-field">
                <span className="crm-label">Prestataire (saisie libre)</span>
                <input
                  className="crm-input"
                  value={params.prestataire ?? ""}
                  onChange={(e) =>
                    patch({ prestataire: e.target.value, prestataire_manuel: true })
                  }
                />
              </label>
              <label className="crm-field">
                <span className="crm-label">Trimestre</span>
                <select
                  className="crm-select"
                  value={params.trimestre ?? "T1"}
                  onChange={(e) => patch({ trimestre: e.target.value })}
                >
                  {["T1", "T2", "T3", "T4"].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="crm-field">
                <span className="crm-label">Année</span>
                <input
                  type="number"
                  className="crm-input"
                  value={params.annee ?? new Date().getFullYear()}
                  onChange={(e) => patch({ annee: Number(e.target.value) })}
                />
              </label>
              <label className="crm-field">
                <span className="crm-label">Client (donneur d&apos;ordre)</span>
                <select
                  className="crm-select"
                  value={params.filtre_client ?? "Tous"}
                  onChange={(e) => {
                    const v = e.target.value;
                    const hyp = v === "Tous" ? undefined : v;
                    const prests =
                      parcMeta && v !== "Tous"
                        ? parcMeta.couples.filter((c) => c.client === v).map((c) => c.prestataire)
                        : [];
                    const part = {
                      filtre_client: v,
                      hypotheses_client: hyp,
                      client_manuel: true,
                      filtre_prestataire:
                        prests.length === 1 && !params.prestataire_manuel ? prests[0] : params.filtre_prestataire,
                    };
                    patch(part);
                    relancerAfterPatch(part);
                  }}
                >
                  <option value="Tous">Tous — choisir manuellement</option>
                  {[
                    ...new Set([
                      ...(detection?.clients_disponibles ?? []),
                      ...(parcMeta?.clients ?? []),
                      ...(result?.clients ?? []),
                      ...(detection?.client ? [detection.client] : []),
                    ]),
                  ]
                    .filter(Boolean)
                    .map((c) => (
                      <option key={c} value={c}>
                        {c}
                        {c === detection?.client && !params.client_manuel ? " (auto)" : ""}
                      </option>
                    ))}
                </select>
              </label>
              <label className="crm-field">
                <span className="crm-label">Prestataire</span>
                <select
                  className="crm-select"
                  value={params.filtre_prestataire ?? "Tous"}
                  onChange={(e) => {
                    const v = e.target.value;
                    const part = {
                      filtre_prestataire: v,
                      prestataire: v === "Tous" ? params.prestataire : v,
                      prestataire_manuel: true,
                    };
                    patch(part);
                    relancerAfterPatch(part);
                  }}
                >
                  <option value="Tous">Tous</option>
                  {(
                    result?.prestataires_pour_client?.length
                      ? result.prestataires_pour_client
                      : parcMeta?.couples
                          .filter((c) => params.filtre_client === "Tous" || c.client === params.filtre_client)
                          .map((c) => c.prestataire) ?? []
                  )
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <div className="space-y-2 border-t border-neutral-200 pt-3 text-xs">
              <p className="font-semibold text-[var(--navy)]">Seuils annuels (application)</p>
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={params.prorata_immo_trimestriel ?? false}
                  onChange={(e) => patch({ prorata_immo_trimestriel: e.target.checked })}
                />
                <span>
                  Appliquer le prorata trimestriel immobilisation (12 h/Q). Décoché : pénalité immo au T4
                  seulement (48 h/an).
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={params.prorata_pannes_trimestriel ?? false}
                  onChange={(e) => patch({ prorata_pannes_trimestriel: e.target.checked })}
                />
                <span>
                  Appliquer le prorata trimestriel pannes (seuil ÷ 4). Décoché : indicateur en T1–T3, pénalité
                  au T4 (2/an).
                </span>
              </label>
            </div>
            {result?.indicateurs?.libelle_mode_pannes ? (
              <div className="space-y-1 rounded border border-[var(--navy)]/20 bg-[#f0f4f8] px-3 py-2 text-xs text-[var(--navy)]">
                <p className="font-semibold">Application des seuils contractuels</p>
                <p>{result.indicateurs.libelle_mode_pannes}</p>
                {result.indicateurs.libelle_mode_immobilisation ? (
                  <p>{result.indicateurs.libelle_mode_immobilisation}</p>
                ) : null}
              </div>
            ) : null}
            {result?.indicateurs?.mode_pannes ? (
              <div className="space-y-1 rounded bg-neutral-100 px-2 py-2 text-xs text-neutral-700">
                <p>
                  Pannes : <strong>{result.indicateurs.mode_pannes}</strong>
                  {result.indicateurs.mode_immobilisation ? (
                    <>
                      {" "}
                      | immo : <strong>{result.indicateurs.mode_immobilisation}</strong>
                    </>
                  ) : null}
                </p>
                {result.indicateurs.mention_pannes ? (
                  <p className="text-neutral-600">{result.indicateurs.mention_pannes}</p>
                ) : null}
                {result.indicateurs.appareils_voyant_pannes?.length ? (
                  <p className="text-red-800">
                    Voyant seuil annuel (≥ 2 pannes sur le trimestre) :{" "}
                    {result.indicateurs.appareils_voyant_pannes
                      .filter((a) => a.voyant_seuil_trimestre)
                      .map((a) => `${a.ascenseur} (${a.nb_pannes_trimestre})`)
                      .join(", ")}
                  </p>
                ) : null}
              </div>
            ) : null}
            {result?.avertissements_delta?.length ? (
              <ul className="list-inside list-disc rounded border border-amber-200 bg-amber-50 px-2 py-2 text-xs text-amber-900">
                {result.avertissements_delta.map((msg) => (
                  <li key={msg}>{msg}</li>
                ))}
              </ul>
            ) : null}
            {result?.ascenseurs?.length ? (
              <div className="space-y-2 border-t border-neutral-200 pt-3">
                <p className="text-xs font-semibold text-[var(--navy)]">
                  Dernière visite maintenance T-1 (par appareil)
                </p>
                <div className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
                  {result.ascenseurs.map((asc) => (
                    <label key={asc} className="crm-field block text-xs">
                      <span className="crm-label">{asc}</span>
                      <input
                        type="date"
                        className="crm-input"
                        value={params.dernieres_visites?.[asc] ?? ""}
                        onChange={(e) => {
                          const next = {
                            ...params.dernieres_visites,
                            [asc]: e.target.value,
                          };
                          saveDernieresVisites(stockKeyVisites(params), next);
                          patch({ dernieres_visites: next });
                        }}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="cbtn cbtn-orange cbtn-sm"
                disabled={loading || !lastBrutRef.current}
                onClick={relancer}
              >
                Relancer l&apos;analyse
              </button>
            </div>
          </div>
        </div>
      </div>

      <MaintenanceMmsBatchPanel parcFile={parcFile} params={params} disabled={loading} />

      {error ? <p className="crm-alert crm-alert--error">{error}</p> : null}

      {result?.alerte_prestataire ? (
        <div className="crm-alert crm-alert--warn">{result.alerte_prestataire}</div>
      ) : null}

      {result ? (
        <div className="space-y-4">
          {result.indicateurs.libelle_mode_pannes ? (
            <div className="fnote">
              <p className="mb-1 text-sm font-bold text-[var(--navy)]">Modes d&apos;application des seuils</p>
              <p className="text-sm text-[var(--g800)]">{result.indicateurs.libelle_mode_pannes}</p>
              {result.indicateurs.libelle_mode_immobilisation ? (
                <p className="text-sm text-[var(--g800)]">{result.indicateurs.libelle_mode_immobilisation}</p>
              ) : null}
            </div>
          ) : null}
          <div className="kpi-grid">
            <div className="kpi kp-navy">
              <div className="kpi-label">Interventions</div>
              <div className="kpi-val">{result.indicateurs.nb_interventions}</div>
            </div>
            <div className="kpi kp-navy">
              <div className="kpi-label">Pannes retenues</div>
              <div className="kpi-val">{result.indicateurs.nb_pannes_retenues}</div>
            </div>
            <div className="kpi kp-navy">
              <div className="kpi-label">Visites maint.</div>
              <div className="kpi-val">{result.indicateurs.nb_visites_maintenance}</div>
            </div>
            <div className="kpi kp-steel">
              <div className="kpi-label">Appareils</div>
              <div className="kpi-val">{result.indicateurs.nb_appareils}</div>
            </div>
            <div className="kpi kp-orange">
              <div className="kpi-label">Pénalité totale</div>
              <div className="kpi-val ov">
                {result.indicateurs.penalite_totale.toLocaleString("fr-FR")} €
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="cbtn cbtn-orange"
              onClick={() =>
                downloadBase64File(
                  result.fichiers.excel_base64,
                  result.fichiers.excel_nom,
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
              }
            >
              Télécharger Tableau MMS (Excel)
            </button>
            <button
              type="button"
              className="cbtn cbtn-ghost"
              onClick={() =>
                downloadBase64File(
                  result.fichiers.word_base64,
                  result.fichiers.word_nom,
                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                )
              }
            >
              Télécharger compte-rendu (Word)
            </button>
            {result.fichiers.pdf_base64 ? (
              <button
                type="button"
                className="cbtn cbtn-ghost"
                onClick={() =>
                  downloadBase64File(
                    result.fichiers.pdf_base64!,
                    result.fichiers.pdf_nom ?? result.fichiers.word_nom.replace(".docx", ".pdf"),
                    "application/pdf",
                  )
                }
              >
                Télécharger PDF
              </button>
            ) : result.fichiers.pdf_erreur ? (
              <span className="self-center text-xs text-amber-800">{result.fichiers.pdf_erreur}</span>
            ) : null}
          </div>

          {result.graphiques ? (
            <MaintenanceMmsCharts
              graphiques={result.graphiques}
              tableaux={result.tableaux_apercu}
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
}
