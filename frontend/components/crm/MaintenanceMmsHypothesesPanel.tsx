"use client";

import { useCallback, useEffect, useState } from "react";

import {
  fetchHypothesesMarche,
  hypothesesVersParams,
  saveHypothesesMarche,
  type HypothesesMarcheCatalogue,
  type HypothesesMarcheClient,
} from "@/lib/mms-hypotheses";
import type { MmsDetectionMetadata, MmsParams } from "@/lib/mms-api";

const CLIENTS_DEFAUT = ["CADJEE", "SIDR", "SODIAC", "SEMADER", "CDC"];

type Props = {
  params: MmsParams;
  onParamsChange: (p: Partial<MmsParams>) => void;
  detection?: MmsDetectionMetadata | null;
  onReappliquerDetection?: () => void;
  canReappliquerDetection?: boolean;
};

function champNum(
  label: string,
  value: number,
  onChange: (v: number) => void,
  step = 1,
) {
  return (
    <label className="crm-field block text-xs">
      <span className="crm-label">{label}</span>
      <input
        type="number"
        className="crm-input"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function MaintenanceMmsHypothesesPanel({
  params,
  onParamsChange,
  detection,
  onReappliquerDetection,
  canReappliquerDetection = false,
}: Props) {
  const [catalogue, setCatalogue] = useState<HypothesesMarcheCatalogue | null>(null);
  const [clientSel, setClientSel] = useState("CADJEE");
  const [profil, setProfil] = useState<HypothesesMarcheClient | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ouvert, setOuvert] = useState(false);

  const charger = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const { catalogue: cat, avertissement } = await fetchHypothesesMarche();
      setCatalogue(cat);
      const cle = clientSel in cat ? clientSel : Object.keys(cat)[0] ?? "CADJEE";
      setClientSel(cle);
      setProfil({ ...cat[cle] });
      if (avertissement) setMsg(avertissement);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erreur chargement");
    } finally {
      setLoading(false);
    }
  }, [clientSel]);

  useEffect(() => {
    void charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chargement initial uniquement
  }, []);

  useEffect(() => {
    if (catalogue && clientSel && catalogue[clientSel]) {
      setProfil({ ...catalogue[clientSel] });
    }
  }, [clientSel, catalogue]);

  useEffect(() => {
    const c = params.hypotheses_client ?? detection?.client;
    if (c && catalogue?.[c]) setClientSel(c);
  }, [params.hypotheses_client, detection?.client, catalogue]);

  useEffect(() => {
    if (detection?.client || detection?.prestataire) setOuvert(true);
  }, [detection]);

  const patchProfil = (part: Partial<HypothesesMarcheClient>) => {
    if (!profil) return;
    setProfil({ ...profil, ...part });
  };

  const enregistrer = async () => {
    if (!catalogue || !profil) return;
    setMsg(null);
    try {
      const next = { ...catalogue, [clientSel]: profil };
      const saved = await saveHypothesesMarche(next);
      setCatalogue(saved);
      setMsg(`Hypothèses ${clientSel} enregistrées (fichier serveur ou sauvegarde navigateur).`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erreur");
    }
  };

  const appliquerAuxParams = () => {
    if (!profil) return;
    onParamsChange(hypothesesVersParams(profil, clientSel) as Partial<MmsParams>);
    setMsg(`Paramètres d'analyse chargés depuis ${clientSel}.`);
  };

  const clients = catalogue ? Object.keys(catalogue).sort() : CLIENTS_DEFAUT;
  const clientActif = params.hypotheses_client ?? detection?.client;
  const resumeProfil = clientActif
    ? `${clientActif}${detection?.client && !params.client_manuel ? " (détecté)" : ""} — cliquer pour modifier`
    : "Cliquer pour détection et modification du profil";

  return (
    <div className="fcard mb-4">
      <div className="fcard-hdr">
        <button
          type="button"
          className="fcard-hdr-toggle"
          aria-expanded={ouvert}
          aria-controls="mms-profil-panel"
          aria-label={
            ouvert
              ? "Replier le profil client et les hypothèses marché"
              : "Déplier pour voir la détection et modifier le profil client"
          }
          onClick={() => setOuvert((v) => !v)}
        >
          <div>
            <h2>Profil client &amp; hypothèses marché</h2>
            <p className="fcard-hdr-sub">
              {ouvert
                ? "Détection automatique, seuils et tarifs contractuels"
                : resumeProfil}
            </p>
          </div>
          <span className={`fcard-hdr-chevron${ouvert ? " fcard-hdr-chevron--open" : ""}`} aria-hidden>
            ▸
          </span>
        </button>
      </div>
      {ouvert ? (
      <div id="mms-profil-panel" className="fcard-body space-y-3">
        {detection?.client || detection?.prestataire ? (
          <div className="crm-alert crm-alert--detect text-xs">
            <p className="font-semibold">Détection automatique</p>
            {detection.client ? (
              <p>
                Client : <strong>{detection.client}</strong>
                {detection.libelle_source_client ? ` (${detection.libelle_source_client})` : null}
                {params.client_manuel ? " — modifié manuellement" : null}
              </p>
            ) : null}
            {detection.prestataire ? (
              <p>
                Prestataire : <strong>{detection.prestataire}</strong>
                {params.prestataire_manuel ? " — modifié manuellement" : null}
              </p>
            ) : null}
            {(detection.clients_disponibles?.length ?? 0) > 1 ? (
              <p className="text-amber-900">
                Plusieurs clients dans le fichier — choisissez le profil ci-dessous.
              </p>
            ) : null}
            {canReappliquerDetection && onReappliquerDetection ? (
              <button
                type="button"
                className="cbtn cbtn-ghost cbtn-sm mt-2"
                onClick={onReappliquerDetection}
              >
                Réappliquer la détection auto
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="fcard-section-hdr">
          <h3>Modifier le profil marché</h3>
          <p className="crm-hint">
            Seuils et tarifs contractuels — enregistrez puis chargez dans les paramètres d&apos;analyse.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="crm-field min-w-[140px]">
            <span className="crm-label">Client</span>
            <select
              className="crm-select"
              value={clientSel}
              onChange={(e) => setClientSel(e.target.value)}
            >
              {clients.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="cbtn cbtn-ghost cbtn-sm" disabled={loading} onClick={() => void charger()}>
            Actualiser
          </button>
          <button type="button" className="cbtn cbtn-orange cbtn-sm" disabled={!profil} onClick={appliquerAuxParams}>
            Charger dans les paramètres
          </button>
          <button type="button" className="cbtn cbtn-ghost cbtn-sm" disabled={!profil} onClick={() => void enregistrer()}>
            Enregistrer ce client
          </button>
        </div>

        {profil ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="crm-field block text-xs sm:col-span-2">
              <span className="crm-label">Adresse / site</span>
              <input
                className="crm-input"
                value={profil.adresse_site}
                onChange={(e) => patchProfil({ adresse_site: e.target.value })}
              />
            </label>
            <label className="crm-field block text-xs">
              <span className="crm-label">Prestataire par défaut</span>
              <input
                className="crm-input"
                value={profil.prestataire_defaut ?? ""}
                onChange={(e) => patchProfil({ prestataire_defaut: e.target.value })}
              />
            </label>
            {champNum("Écart max. visites (j)", profil.seuil_maintenance_jours, (v) =>
              patchProfil({ seuil_maintenance_jours: v }),
            )}
            {champNum("Pannes max. / an / app.", profil.seuil_pannes_an, (v) =>
              patchProfil({ seuil_pannes_an: v }),
            )}
            {champNum("Immo max. (h/an)", profil.seuil_immo_h, (v) => patchProfil({ seuil_immo_h: v }))}
            {champNum("Délai max. (h)", profil.seuil_delai_h, (v) => patchProfil({ seuil_delai_h: v }), 0.5)}
            {champNum("€ / jour maint.", profil.tarif_jour, (v) => patchProfil({ tarif_jour: v }), 0.01)}
            {champNum("€ / panne", profil.tarif_panne, (v) => patchProfil({ tarif_panne: v }), 0.01)}
            {champNum("€ / h immo", profil.tarif_heure_immo, (v) => patchProfil({ tarif_heure_immo: v }), 0.01)}
            {champNum("€ / h délai", profil.tarif_heure_delai, (v) => patchProfil({ tarif_heure_delai: v }), 0.01)}
            <label className="flex items-center gap-2 text-xs sm:col-span-2">
              <input
                type="checkbox"
                checked={profil.prorata_immo_trimestriel}
                onChange={(e) => patchProfil({ prorata_immo_trimestriel: e.target.checked })}
              />
              Prorata trim. immobilisation
            </label>
            <label className="flex items-center gap-2 text-xs sm:col-span-2">
              <input
                type="checkbox"
                checked={profil.prorata_pannes_trimestriel}
                onChange={(e) => patchProfil({ prorata_pannes_trimestriel: e.target.checked })}
              />
              Prorata trim. pannes
            </label>
            <label className="crm-field block text-xs sm:col-span-2 lg:col-span-4">
              <span className="crm-label">Commentaire marché</span>
              <textarea
                className="crm-input min-h-[60px]"
                value={profil.commentaire_marche ?? ""}
                onChange={(e) => patchProfil({ commentaire_marche: e.target.value })}
              />
            </label>
          </div>
        ) : null}

        <p className="text-xs text-neutral-500">
          Client appliqué à l&apos;analyse :{" "}
          <strong>{params.hypotheses_client ?? "—"}</strong>
        </p>
        {msg ? <p className="text-xs text-[var(--orange)]">{msg}</p> : null}
      </div>
      ) : null}
    </div>
  );
}
