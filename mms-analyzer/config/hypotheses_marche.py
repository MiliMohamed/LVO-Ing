# -*- coding: utf-8 -*-
"""
Hypothèses marché par client (seuils, tarifs, site).
Persistées dans config/hypotheses_marche.json — modifiables via l'API / CRM.
"""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

from config import parametres as cfg

FICHIER_JSON = Path(__file__).resolve().parent / "hypotheses_marche.json"

CHAMPS_HYPOTHESES = (
    "client_site",
    "adresse_site",
    "prestataire_defaut",
    "seuil_maintenance_jours",
    "seuil_pannes_an",
    "seuil_immo_h",
    "seuil_delai_h",
    "seuil_desincarc_min",
    "seuil_parachute_mois",
    "seuil_cables_mois",
    "tarif_jour",
    "tarif_panne",
    "tarif_heure_immo",
    "tarif_heure_delai",
    "prorata_immo_trimestriel",
    "prorata_pannes_trimestriel",
    "commentaire_marche",
)


def _modele_client(nom: str, adresse: str = "", **extra: Any) -> dict[str, Any]:
    """Modèle d'hypothèses pour un bailleur / site."""
    base = {
        "client_site": nom,
        "adresse_site": adresse or f"Parc ascenseurs {nom}",
        "prestataire_defaut": "OTIS",
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
        "prorata_immo_trimestriel": False,
        "prorata_pannes_trimestriel": False,
        "commentaire_marche": "",
    }
    base.update(extra)
    return base


def hypotheses_par_defaut() -> dict[str, dict[str, Any]]:
    """Catalogue initial — un profil par client du groupement + CADJEE."""
    return {
        "CADJEE": _modele_client(
            cfg.CLIENT_SITE_CADJEE,
            cfg.ADRESSE_SITE_CADJEE,
            commentaire_marche="Marché OTIS SCI — 50 €/h délai, 150 €/panne, 50 €/h immo, 50 €/jour maintenance.",
        ),
        "SIDR": _modele_client("SIDR", "Multisites La Réunion"),
        "SODIAC": _modele_client("SODIAC"),
        "SEMADER": _modele_client("SEMADER"),
        "CDC": _modele_client("CDC"),
        "GHER": _modele_client("GHER", "Groupement GHER"),
        "SHLMR": _modele_client("SHLMR"),
    }


def _valeur_json_safe(val: Any) -> Any:
    """Convertit numpy / pandas en types natifs pour FastAPI."""
    if val is None:
        return None
    type_nom = type(val).__name__
    if type_nom in ("bool_", "bool8"):
        return bool(val)
    if type_nom.startswith("int"):
        return int(val)
    if type_nom.startswith("float"):
        return float(val)
    if isinstance(val, dict):
        return {str(k): _valeur_json_safe(v) for k, v in val.items()}
    if isinstance(val, (list, tuple)):
        return [_valeur_json_safe(v) for v in val]
    return val


def hypotheses_json_safe(catalogue: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {cle: _valeur_json_safe(profil) for cle, profil in catalogue.items()}


def charger_hypotheses() -> dict[str, dict[str, Any]]:
    if FICHIER_JSON.exists():
        try:
            data = json.loads(FICHIER_JSON.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return _fusionner_avec_defaut(data)
        except (json.JSONDecodeError, OSError):
            pass
    return deepcopy(hypotheses_par_defaut())


def _fusionner_avec_defaut(stocke: dict[str, Any]) -> dict[str, dict[str, Any]]:
    defaut = hypotheses_par_defaut()
    for client, profil in stocke.items():
        cle = str(client).strip().upper()
        if cle not in defaut:
            defaut[cle] = _modele_client(cle)
        if isinstance(profil, dict):
            defaut[cle].update(profil)
    return defaut


def enregistrer_hypotheses(data: dict[str, dict[str, Any]]) -> None:
    propre: dict[str, dict[str, Any]] = {}
    for client, profil in data.items():
        cle = str(client).strip().upper()
        if not isinstance(profil, dict):
            continue
        propre[cle] = {k: profil[k] for k in CHAMPS_HYPOTHESES if k in profil}
        if "commentaire_marche" in profil:
            propre[cle]["commentaire_marche"] = str(profil["commentaire_marche"])
    FICHIER_JSON.write_text(
        json.dumps(propre, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def appliquer_hypotheses_client(params: dict[str, Any], client: str | None) -> dict[str, Any]:
    """
    Fusionne les hypothèses du client dans les paramètres d'analyse.
    client : code bailleur (CADJEE, SIDR…) ou None / Tous.
    """
    if not client or str(client).strip().upper() in ("", "TOUS"):
        return params
    cle = str(client).strip().upper()
    catalogue = charger_hypotheses()
    profil = catalogue.get(cle)
    if not profil:
        return params

    out = {**params}
    mapping = {
        "seuil_maintenance_jours": "seuil_maintenance_jours",
        "seuil_pannes_an": "seuil_pannes_an",
        "seuil_immo_h": "seuil_immo_h",
        "seuil_delai_h": "seuil_delai_h",
        "seuil_desincarc_min": "seuil_desincarc_min",
        "seuil_parachute_mois": "seuil_parachute_mois",
        "seuil_cables_mois": "seuil_cables_mois",
        "tarif_jour": "tarif_jour",
        "tarif_panne": "tarif_panne",
        "tarif_heure_immo": "tarif_heure_immo",
        "tarif_heure_delai": "tarif_heure_delai",
        "prorata_immo_trimestriel": "prorata_immo_trimestriel",
        "prorata_pannes_trimestriel": "prorata_pannes_trimestriel",
    }
    for src, dst in mapping.items():
        if src in profil:
            out[dst] = profil[src]
    if profil.get("client_site"):
        out["client_site"] = profil["client_site"]
    if profil.get("adresse_site"):
        out["adresse_site"] = profil["adresse_site"]
    if profil.get("prestataire_defaut") and not params.get("prestataire"):
        out["prestataire"] = profil["prestataire_defaut"]
    out["hypotheses_client"] = cle
    out["commentaire_marche"] = profil.get("commentaire_marche", "")
    return out
