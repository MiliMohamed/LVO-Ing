# -*- coding: utf-8 -*-
"""Pipeline d'analyse MMS — utilisé par l'API HTTP et Streamlit."""

from __future__ import annotations

import json
import logging
from datetime import date
from pathlib import Path
from typing import Any, Optional

import pandas as pd

from config import parametres as cfg
from config.clients_config import appliquer_config_client
from config.hypotheses_marche import appliquer_hypotheses_client, charger_hypotheses
from core import calculs, export_excel, export_pdf, export_word, parser
from core.charts_data import construire_graphiques
from core.figures import generer_figures
from core.parc import couples_client_prestataire, prestataires_pour_client
from core.prestataire_detect import (
    appliquer_detection_aux_params,
    detecter_metadonnees,
    detecter_depuis_nom_fichier,
    verifier_coherence_prestataire,
)

logger = logging.getLogger(__name__)

OUTPUTS_ROOT = Path(__file__).resolve().parent.parent / "outputs"


def params_par_defaut() -> dict[str, Any]:
    """Paramètres par défaut sérialisables JSON."""
    return {
        "prestataire": "OTIS",
        "trimestre": "T1",
        "annee": date.today().year,
        "date_cr": date.today().strftime("%d/%m/%Y"),
        "commentaire": "",
        "seuil_maintenance_jours": cfg.SEUIL_ECART_MAINTENANCE_JOURS,
        "seuil_pannes_an": cfg.SEUIL_PANNES_PAR_AN_APPAREIL,
        "seuil_immo_h": float(cfg.SEUIL_IMMOBILISATION_HEURES_AN),
        "seuil_delai_h": float(cfg.SEUIL_DELAI_INTERVENTION_HEURES),
        "seuil_desincarc_min": cfg.SEUIL_DESINCARCERATION_MINUTES,
        "seuil_parachute_mois": cfg.SEUIL_PARACHUTE_MOIS,
        "seuil_cables_mois": cfg.SEUIL_CABLES_MOIS,
        "tarif_jour": float(cfg.TARIF_PENALITE_JOUR_MAINTENANCE),
        "tarif_panne": float(cfg.TARIF_PENALITE_PANNE),
        "tarif_heure_immo": float(cfg.TARIF_PENALITE_HEURE_IMMOBILISATION),
        "tarif_heure_delai": float(cfg.TARIF_PENALITE_HEURE_DELAI),
        "table_classement": dict(cfg.TABLE_CLASSEMENT_PANNES_DEFAUT),
        "filtre_client": "Tous",
        "filtre_prestataire": "Tous",
        "filtre_adresse": "Tous",
        "prorata_immo_trimestriel": False,
        "prorata_pannes_trimestriel": False,
        "cumuler_trimestres_precedents": False,
        "hypotheses_client": None,
        "enregistrer_sorties": False,
        "integrer_graphiques": True,
    }


def liste_hypotheses_marche() -> dict[str, dict]:
    """Profils hypothèses par client pour l'interface CRM (JSON-safe)."""
    from config.hypotheses_marche import hypotheses_json_safe

    return hypotheses_json_safe(charger_hypotheses())


def fusionner_params(custom: Optional[dict[str, Any]]) -> dict[str, Any]:
    p = params_par_defaut()
    if custom:
        p.update(custom)
        if "table_classement" in custom and isinstance(custom["table_classement"], dict):
            p["table_classement"] = custom["table_classement"]
    return p


def detecter_fichier_metadata(
    contenu_brut: bytes,
    nom_fichier_brut: Optional[str] = None,
    contenu_parc: Optional[bytes] = None,
    nom_fichier_parc: Optional[str] = None,
    params_custom: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """
    Détection rapide client / prestataire / trimestre (sans calcul des pénalités).
    Appelée dès le dépôt du fichier dans le CRM.
    """
    params = fusionner_params(params_custom)
    chemin = (params_custom or {}).get("chemin_source") or nom_fichier_brut
    pre = detecter_depuis_nom_fichier(nom_fichier_brut, chemin_parent=chemin)
    params = appliquer_detection_aux_params(
        params,
        {
            "client": pre.get("client"),
            "prestataire": pre.get("prestataire"),
            "trimestre": pre.get("trimestre"),
            "annee": pre.get("annee"),
            "source_client": "nom_fichier" if pre.get("client") else None,
            "source_prestataire": "nom_fichier" if pre.get("prestataire") else None,
        },
    )
    client_hyp = params.get("hypotheses_client")
    params = appliquer_config_client(params, str(client_hyp) if client_hyp else None)

    donnees: dict = {}
    format_source: Optional[str] = None
    if contenu_brut and len(contenu_brut) >= 64:
        donnees = parser.charger_fichier_prestataire(contenu_brut, nom_fichier_brut, params)
        format_source = donnees.pop("format", None)

    parc = pd.DataFrame()
    if contenu_parc and len(contenu_parc) >= 64:
        parc = parser.charger_liste_parc(contenu_parc, nom_fichier_parc)

    detection = detecter_metadonnees(
        nom_fichier_brut,
        donnees,
        parc,
        params.get("prestataire"),
        chemin_parent=chemin,
    )
    params_finaux = appliquer_detection_aux_params(params, detection)

    libelles_source = {
        "nom_fichier": "nom du fichier",
        "donnees": "données prestataire",
        "parc": "fichier parc",
        "donnees_plusieurs": "plusieurs clients dans le fichier",
    }

    return {
        "client": detection.get("client"),
        "prestataire": detection.get("prestataire"),
        "trimestre": detection.get("trimestre") or params_finaux.get("trimestre"),
        "annee": detection.get("annee") or params_finaux.get("annee"),
        "source_client": detection.get("source_client"),
        "source_prestataire": detection.get("source_prestataire"),
        "libelle_source_client": libelles_source.get(str(detection.get("source_client")), ""),
        "clients_disponibles": detection.get("clients_fichier") or [],
        "params_suggestes": {
            "filtre_client": params_finaux.get("filtre_client"),
            "hypotheses_client": params_finaux.get("hypotheses_client"),
            "prestataire": params_finaux.get("prestataire"),
            "filtre_prestataire": params_finaux.get("filtre_prestataire"),
            "trimestre": params_finaux.get("trimestre"),
            "annee": params_finaux.get("annee"),
        },
        "format_source": format_source,
    }


def analyser_parc(contenu_parc: bytes, nom_fichier: Optional[str] = None) -> dict[str, Any]:
    """Retourne couples client×prestataire et listes pour les sélecteurs UI."""
    parc = parser.charger_liste_parc(contenu_parc, nom_fichier)
    couples = couples_client_prestataire(parc)
    clients = sorted({c["client"] for c in couples})
    return {
        "couples": couples,
        "clients": clients,
        "nb_appareils": len(parc),
    }


def executer_analyse(
    contenu_brut: bytes,
    contenu_parc: Optional[bytes] = None,
    params_custom: Optional[dict[str, Any]] = None,
    nom_fichier_brut: Optional[str] = None,
    nom_fichier_parc: Optional[str] = None,
    contenu_dernieres_visites: Optional[bytes] = None,
    nom_fichier_dernieres_visites: Optional[str] = None,
    contenu_cumul_pannes: Optional[bytes] = None,
    nom_fichier_cumul_pannes: Optional[str] = None,
    contenu_historique_interventions: Optional[bytes] = None,
    nom_fichier_historique: Optional[str] = None,
) -> dict[str, Any]:
    """
    Lance l'analyse complète.
    Retourne excel/word en bytes, indicateurs et aperçu tabulaire (JSON-safe).
    """
    params = fusionner_params(params_custom)
    if not contenu_brut or len(contenu_brut) < 64:
        raise ValueError("Fichier brut vide ou invalide.")

    chemin = str(params.get("chemin_source") or nom_fichier_brut or "")
    pre_meta = detecter_depuis_nom_fichier(nom_fichier_brut, chemin_parent=chemin)
    params = appliquer_detection_aux_params(
        params,
        {
            "client": pre_meta.get("client"),
            "prestataire": pre_meta.get("prestataire"),
            "trimestre": pre_meta.get("trimestre"),
            "annee": pre_meta.get("annee"),
            "source_client": "nom_fichier" if pre_meta.get("client") else None,
            "source_prestataire": "nom_fichier" if pre_meta.get("prestataire") else None,
        },
    )

    client_hyp = params.get("hypotheses_client")
    if not client_hyp and params.get("filtre_client") not in (None, "", "Tous"):
        client_hyp = params.get("filtre_client")
    params = appliquer_config_client(params, str(client_hyp) if client_hyp else None)

    params.setdefault("client_site", cfg.CLIENT_SITE_CADJEE)
    params.setdefault("adresse_site", cfg.ADRESSE_SITE_CADJEE)

    if contenu_dernieres_visites and len(contenu_dernieres_visites) >= 32:
        fichier_visites = parser.charger_dernieres_visites(
            contenu_dernieres_visites, nom_fichier_dernieres_visites
        )
        params["dernieres_visites"] = {**params.get("dernieres_visites", {}), **fichier_visites}

    if contenu_cumul_pannes and len(contenu_cumul_pannes) >= 32:
        cumul = parser.charger_cumul_pannes(contenu_cumul_pannes, nom_fichier_cumul_pannes)
        params["cumul_pannes_par_appareil"] = {
            **params.get("cumul_pannes_par_appareil", {}),
            **cumul,
        }
        params["cumuler_trimestres_precedents"] = True

    if contenu_historique_interventions and len(contenu_historique_interventions) >= 64:
        hist = parser.charger_fichier_prestataire(
            contenu_historique_interventions, nom_fichier_historique, params
        )
        hist.pop("format", None)
        inter_hist = hist.get("interventions", pd.DataFrame())
        if not inter_hist.empty:
            params["interventions_historique"] = inter_hist
            params["historique_12_mois_force"] = True

    donnees = parser.charger_fichier_prestataire(contenu_brut, nom_fichier_brut, params)
    format_source = donnees.pop("format", "annexe5")
    parc = pd.DataFrame()
    alerte_prestataire: Optional[str] = None
    if contenu_parc and len(contenu_parc) >= 64:
        parc = parser.charger_liste_parc(contenu_parc, nom_fichier_parc)

    detection = detecter_metadonnees(
        nom_fichier_brut,
        donnees,
        parc,
        params.get("prestataire"),
        chemin_parent=chemin,
    )
    params = appliquer_detection_aux_params(params, detection)
    client_hyp = params.get("hypotheses_client")
    if client_hyp:
        params = appliquer_config_client(params, str(client_hyp))
    if detection.get("client"):
        params["client_site"] = detection["client"]
        for cle in ("interventions", "maintenance", "maintenance_lignes"):
            df = donnees.get(cle)
            if isinstance(df, pd.DataFrame) and not df.empty:
                donnees[cle] = df.copy()
                donnees[cle]["client"] = detection["client"]
        if not parc.empty and "marque" in parc.columns:
            marques = parc["marque"].dropna().astype(str).unique()
            if len(marques) == 1:
                alerte_prestataire = verifier_coherence_prestataire(
                    params.get("prestataire"), marques[0]
                )

    filtre_client = None if params.get("filtre_client") in (None, "Tous") else str(params["filtre_client"])
    filtre_prest = (
        None
        if params.get("filtre_prestataire") in (None, "", "Tous")
        else str(params["filtre_prestataire"])
    )

    donnees_filtrees = calculs.filtrer_perimetre(
        donnees,
        filtre_client,
        None if params.get("filtre_adresse") in (None, "Tous") else str(params["filtre_adresse"]),
    )

    if filtre_prest and not parc.empty and "marque" in parc.columns:
        from core.prestataire_detect import _normaliser_prestataire

        asc_prest = set(
            parc[
                parc["marque"].astype(str).apply(lambda x: _normaliser_prestataire(x)) == filtre_prest
            ]["ascenseur"]
            .astype(str)
            .str.strip()
            .str.upper()
        )
        for cle, df in list(donnees_filtrees.items()):
            if isinstance(df, pd.DataFrame) and not df.empty and "ascenseur" in df.columns:
                donnees_filtrees[cle] = df[
                    df["ascenseur"].astype(str).str.strip().str.upper().isin(asc_prest)
                ].reset_index(drop=True)

    resultats = calculs.construire_resultats(donnees_filtrees, parc, params)
    pen = resultats["penalites"]
    interventions = resultats["interventions"]

    pen_detail = pen.get("detail", {})
    seuil_pannes_export = float(
        pen_detail.get(
            "seuil_pannes_effectif",
            calculs.seuil_prorata_trimestre(
                float(params.get("seuil_pannes_an", cfg.SEUIL_PANNES_PAR_AN_APPAREIL)),
                str(params.get("trimestre", "T1")),
            ),
        )
    )

    figure_paths: dict[str, str] = {}
    integrer_graphiques = params.get("integrer_graphiques", True)
    if params.get("enregistrer_sorties"):
        base_fig = OUTPUTS_ROOT
    else:
        import tempfile

        base_fig = Path(tempfile.mkdtemp(prefix="lvo_mms_fig_"))
    if integrer_graphiques:
        try:
            figure_paths = generer_figures(resultats, params, pen, base_fig)
        except Exception as exc:
            logger.warning("Génération des graphiques échouée : %s", exc, exc_info=True)
            figure_paths = {}

    excel_bytes = export_excel.generer_tableau_mms(
        resultats, params, seuil_pannes_an=seuil_pannes_export, figure_paths=figure_paths or None
    )
    word_bytes = export_word.generer_compte_rendu(resultats, params, figure_paths=figure_paths or None)
    pdf_bytes, pdf_erreur = export_pdf.convertir_docx_en_pdf(word_bytes)
    viz = construire_graphiques(resultats, pen)

    nb_pannes = 0
    if not interventions.empty and "panne_retenue" in interventions.columns:
        nb_pannes = int(interventions["panne_retenue"].sum())

    tranches: dict[str, int] = {}
    if not interventions.empty and "tranche_delai" in interventions.columns:
        tranches = {str(k): int(v) for k, v in interventions["tranche_delai"].value_counts().items()}

    prestataire = str(params.get("prestataire", "prestataire"))
    trimestre = str(params.get("trimestre", "T1"))
    annee = int(params.get("annee", date.today().year))
    excel_nom = f"LVO_Tableau_MMS_{params.get('filtre_client', 'CLIENT')}_{prestataire}_{trimestre}_{annee}.xlsx"
    word_nom = export_word.nom_fichier_cr(params)

    couples_parc = couples_client_prestataire(parc) if not parc.empty else []
    prestataires_client: list[str] = []
    if filtre_client and not parc.empty:
        prestataires_client = prestataires_pour_client(parc, filtre_client)

    return {
        "ok": True,
        "format_source": format_source,
        "alerte_prestataire": alerte_prestataire,
        "detection_auto": detection,
        "meta_fichier": pre_meta,
        "indicateurs": {
            "nb_interventions": len(interventions),
            "nb_pannes_retenues": nb_pannes,
            "nb_visites_maintenance": len(resultats.get("maintenance", [])),
            "nb_appareils": len(resultats.get("synthese_appareils", [])),
            "penalite_totale": pen.get("penalite_totale", 0),
            "tranches_delai": tranches,
            "format_source": format_source,
            "mode_pannes": pen_detail.get("mode_pannes"),
            "mode_immobilisation": pen_detail.get("mode_immobilisation"),
            "libelle_mode_pannes": pen_detail.get("libelle_mode_pannes"),
            "libelle_mode_immobilisation": pen_detail.get("libelle_mode_immobilisation"),
            "nb_appareils_seuil_annuel_atteint": pen_detail.get("nb_appareils_seuil_annuel_atteint", 0),
            "mention_pannes": pen_detail.get("mention_pannes", ""),
            "appareils_voyant_pannes": pen_detail.get("appareils_voyant_pannes", []),
        },
        "avertissements_delta": resultats.get("avertissements_delta", []),
        "penalites": pen,
        "seuils_prorata": pen_detail,
        "fichiers": {
            "excel_nom": excel_nom.replace(" ", "_"),
            "word_nom": word_nom,
            "pdf_nom": word_nom.replace(".docx", ".pdf"),
            "excel": excel_bytes,
            "word": word_bytes,
            "pdf": pdf_bytes,
            "pdf_erreur": pdf_erreur,
        },
        "clients": _liste_valeurs(interventions, "client"),
        "adresses": _liste_valeurs(interventions, "adresse"),
        "ascenseurs": _liste_valeurs(interventions, "ascenseur"),
        "hypotheses_client_applique": client_hyp,
        "graphiques": viz.get("graphiques", {}),
        "tableaux_apercu": viz.get("tableaux", {}),
        "couples_parc": couples_parc,
        "prestataires_pour_client": prestataires_client,
        "figures_paths": figure_paths,
    }


def _liste_valeurs(df: pd.DataFrame, col: str) -> list[str]:
    if df.empty or col not in df.columns:
        return []
    return sorted(df[col].dropna().astype(str).unique().tolist())
