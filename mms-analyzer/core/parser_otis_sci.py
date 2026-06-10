# -*- coding: utf-8 -*-
"""
Parseur format OTIS SCI (3 feuilles) — ex. Q1 SCI CADJEE.xls
Distinct du format annexe 5 (4 feuilles Historique / Maintenance / Parachute / Câbles).
"""

from __future__ import annotations

import io
from typing import Optional

import pandas as pd

from config import parametres as cfg
from core.parser import (
    _feuille_correspondante,
    _lire_feuille_brute_bytes,
    _normaliser_texte,
    _ouvrir_classeur,
    _vers_bytes,
    normaliser_libelle,
)

# Feuilles OTIS SCI
_FEUILLE_DEMANDES = ("demandes d'intervention", "demande d'intervention")
_FEUILLE_MAINT = ("operation de maintenance", "opération de maintenance")
_FEUILLE_ARRET = ("appareil a l'arret", "appareil à l'arrêt", "appareil a l arret")


def est_format_otis_sci(sheet_names: list[str]) -> bool:
    """
    Détecte le format OTIS SCI (3 feuilles typiques).
    Ne pas confondre avec l'annexe 5 (feuilles « Historique … »).
    """
    if not sheet_names:
        return False
    norm = [_normaliser_texte(n) for n in sheet_names]
    has_demandes = any(any(m in s for m in _FEUILLE_DEMANDES) for s in norm)
    has_maint = any(any(m in s for m in _FEUILLE_MAINT) for s in norm)
    has_arret = any(any(m in s for m in _FEUILLE_ARRET) for s in norm)
    has_historique = any("historique" in s for s in norm)
    # Classique : Demandes + (maintenance ou arrêt)
    if has_demandes and (has_maint or has_arret):
        return True
    # Feuille Demandes seule, sans onglets Historique annexe 5
    if has_demandes and not has_historique:
        return True
    return False


def _colonne(df: pd.DataFrame, *mots_cles: str, exclure: tuple[str, ...] = ()) -> Optional[str]:
    """Retrouve une colonne dont le libellé normalisé contient tous les mots-clés."""
    for col in df.columns:
        n = _normaliser_texte(col)
        if any(ex in n for ex in exclure):
            continue
        if all(m in n for m in mots_cles):
            return col
    return None


def _serie_datetime(serie: pd.Series) -> pd.Series:
    return pd.to_datetime(serie, errors="coerce", dayfirst=True)


def _serie_numerique(serie: pd.Series) -> pd.Series:
    return pd.to_numeric(serie, errors="coerce")


def deriver_type_panne_otis(description_client: object) -> str:
    """OTIS ne fournit pas le type de panne — dérivation depuis la description client."""
    c = normaliser_libelle(description_client)
    if not c:
        return "panne technique"
    if "passager" in c and ("bloque" in c or "bloqué" in c or "bloquee" in c):
        return "désincarcération"
    if "reparation temporaire" in c or "réparation temporaire" in c:
        return "réparation temporaire"
    if any(
        x in c
        for x in (
            "appareil en panne",
            "bruit",
            "dysfonctionnement",
            "porte",
            "panne",
            "defaut",
            "défaut",
        )
    ):
        return "panne technique"
    return "panne technique"


def _client_adresse(params: Optional[dict]) -> tuple[str, str]:
    client = (params or {}).get("client_site", cfg.CLIENT_SITE_CADJEE)
    adresse = (params or {}).get("adresse_site", cfg.ADRESSE_SITE_CADJEE)
    return str(client), str(adresse)


def _charger_demandes_intervention(
    data: bytes,
    nom_feuille: str,
    moteur: str,
    client: str,
    adresse: str,
) -> pd.DataFrame:
    brut = pd.read_excel(
        io.BytesIO(data),
        sheet_name=nom_feuille,
        header=0,
        engine=moteur,
    )
    if brut.empty:
        return pd.DataFrame()

    col_asc = _colonne(brut, "numero", "appareil") or _colonne(brut, "numéro", "appareil")
    col_appel = _colonne(
        brut, "date", "heure", "appel", exclure=("fin", "arrivee", "arrivée", "transmission")
    )
    col_fin = _colonne(brut, "date", "heure", "fin", "intervention")
    col_arrivee = _colonne(brut, "arrivee", "site") or _colonne(brut, "arrivée", "site")
    col_cause = _colonne(brut, "description", "client", exclure=("origine", "appel"))
    col_diag = _colonne(brut, "diagnostique", "technicien")
    col_action = _colonne(brut, "description", "intervention")
    col_tech = _colonne(brut, "nom", "technicien", exclure=("diagnostique", "description"))
    col_appelant = _colonne(brut, "nom", "appelant")
    col_delai = _colonne(brut, "delai", "intervention", "minutes") or _colonne(
        brut, "délai", "intervention", "minutes"
    )
    col_hors = _colonne(brut, "duree", "hors", "service", "minutes") or _colonne(
        brut, "durée", "hors", "service", "minutes"
    )

    out = pd.DataFrame()
    if col_asc:
        out["ascenseur"] = brut[col_asc].astype(str).str.strip()
    if col_appel:
        out["datetime_appel"] = _serie_datetime(brut[col_appel])
    if col_arrivee:
        out["datetime_arrivee"] = _serie_datetime(brut[col_arrivee])
    if col_fin:
        out["datetime_fin"] = _serie_datetime(brut[col_fin])
    if col_cause:
        out["cause_panne"] = brut[col_cause]
    if col_diag:
        out["materiel"] = brut[col_diag]
    if col_action:
        out["description_intervention"] = brut[col_action]
    if col_tech:
        out["nom_technicien"] = brut[col_tech]
    if col_appelant:
        out["nom_appelant"] = brut[col_appelant]
    if col_delai:
        out["delai_intervention_min"] = _serie_numerique(brut[col_delai])
    if col_hors:
        out["duree_hors_service_min"] = _serie_numerique(brut[col_hors])

    out["client"] = client
    out["adresse"] = adresse
    if "cause_panne" in out.columns:
        out["type_panne"] = out["cause_panne"].map(deriver_type_panne_otis)
        out["personne_bloquee"] = out["type_panne"].map(
            lambda t: str(t).lower() in ("désincarcération", "desincarceration")
        )
    else:
        out["type_panne"] = "panne technique"
        out["personne_bloquee"] = False
    out["format_source"] = "otis_sci"

    # Lignes sans numéro d'appareil
    if "ascenseur" in out.columns:
        out = out[out["ascenseur"].notna() & (out["ascenseur"] != "") & (out["ascenseur"] != "nan")]
    return out.reset_index(drop=True)


def _charger_maintenance_otis(
    data: bytes,
    nom_feuille: str,
    moteur: str,
    client: str,
    adresse: str,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    brut = pd.read_excel(
        io.BytesIO(data),
        sheet_name=nom_feuille,
        header=0,
        engine=moteur,
    )
    if brut.empty:
        return pd.DataFrame(), pd.DataFrame()

    col_asc = _colonne(brut, "numero", "appareil") or _colonne(brut, "numéro", "appareil")
    col_arrivee = _colonne(brut, "date", "heure", "arrivee") or _colonne(brut, "date", "heure", "arrivée")
    col_fin = _colonne(brut, "date", "fin", "intervention")
    col_type = _colonne(brut, "description", "operation", "maintenance") or _colonne(
        brut, "description", "opération", "maintenance"
    )
    col_tech = _colonne(brut, "nom", "technicien", exclure=("diagnostique", "description"))
    col_proc = _colonne(brut, "procedure", "maintenance") or _colonne(brut, "procédure", "maintenance")

    out = pd.DataFrame()
    if col_asc:
        out["ascenseur"] = brut[col_asc].astype(str).str.strip()
    if col_arrivee:
        out["datetime_debut"] = _serie_datetime(brut[col_arrivee])
    if col_fin:
        out["datetime_fin"] = _serie_datetime(brut[col_fin])
    if col_type:
        out["type_maintenance"] = brut[col_type]
    if col_tech:
        out["nom_technicien"] = brut[col_tech]
    if col_proc:
        out["materiel_change"] = brut[col_proc]

    out["client"] = client
    out["adresse"] = adresse

    if "ascenseur" in out.columns:
        out = out[out["ascenseur"].notna() & (out["ascenseur"] != "") & (out["ascenseur"] != "nan")]

    lignes = out.reset_index(drop=True)

    # Dédoublonnage visites : une visite = (appareil, date/heure d'arrivée)
    visites = lignes
    if "datetime_debut" in visites.columns and "ascenseur" in visites.columns:
        visites = visites.sort_values(["ascenseur", "datetime_debut"])
        visites = visites.drop_duplicates(subset=["ascenseur", "datetime_debut"], keep="first")

    return visites.reset_index(drop=True), lignes


def _charger_arrets(
    data: bytes,
    nom_feuille: str,
    moteur: str,
    client: str,
    adresse: str,
) -> pd.DataFrame:
    brut = pd.read_excel(
        io.BytesIO(data),
        sheet_name=nom_feuille,
        header=0,
        engine=moteur,
    )
    if brut.empty:
        return pd.DataFrame()

    col_asc = _colonne(brut, "appareil") or brut.columns[0]
    col_debut = _colonne(brut, "mise", "arret") or _colonne(brut, "mise", "arrêt")
    col_fin = _colonne(brut, "remise", "service")
    col_motif = _colonne(brut, "motif")

    out = pd.DataFrame()
    out["ascenseur"] = brut[col_asc].astype(str).str.split("/").str[0].str.strip()
    if col_debut:
        out["datetime_debut_arret"] = _serie_datetime(brut[col_debut])
    if col_fin:
        out["datetime_fin_arret"] = _serie_datetime(brut[col_fin])
    if col_motif:
        out["motif_arret"] = brut[col_motif]
    out["client"] = client
    out["adresse"] = adresse
    return out.reset_index(drop=True)


def charger_fichier_otis_sci(
    source,
    filename: Optional[str] = None,
    params: Optional[dict] = None,
) -> dict[str, pd.DataFrame]:
    """Charge les 3 feuilles OTIS SCI → interventions, maintenance, arrets."""
    data = _vers_bytes(source)
    xl, moteur = _ouvrir_classeur(data, filename)
    noms = xl.sheet_names
    client, adresse = _client_adresse(params)

    feuille_di = _feuille_correspondante(noms, _FEUILLE_DEMANDES)
    feuille_m = _feuille_correspondante(noms, _FEUILLE_MAINT)
    feuille_a = _feuille_correspondante(noms, _FEUILLE_ARRET)

    interventions = pd.DataFrame()
    maintenance = pd.DataFrame()
    arrets = pd.DataFrame()

    if feuille_di:
        interventions = _charger_demandes_intervention(data, feuille_di, moteur, client, adresse)
    maintenance_lignes = pd.DataFrame()
    if feuille_m:
        maintenance, maintenance_lignes = _charger_maintenance_otis(
            data, feuille_m, moteur, client, adresse
        )
    if feuille_a:
        arrets = _charger_arrets(data, feuille_a, moteur, client, adresse)

    if interventions.empty and maintenance.empty:
        feuilles = ", ".join(noms)
        raise ValueError(
            f"Format OTIS SCI détecté mais feuilles illisibles. Feuilles : {feuilles}"
        )

    return {
        "interventions": interventions,
        "maintenance": maintenance,
        "maintenance_lignes": maintenance_lignes,
        "parachute": pd.DataFrame(),
        "cables": pd.DataFrame(),
        "arrets": arrets,
        "format": "otis_sci",
    }
