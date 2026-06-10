# -*- coding: utf-8 -*-
"""Détection automatique du prestataire et du trimestre depuis le nom de fichier."""

from __future__ import annotations

import re
from typing import Any, Optional

import pandas as pd

ALIAS_PRESTATAIRES = {
    "RIVIERE-SCHINDLER": "SCHINDLER",
    "RIVIERE SCHINDLER": "SCHINDLER",
    "TK ELEVATOR": "THYSSEN",
    "TK": "THYSSEN",
    "THYSSENKRUPP": "THYSSEN",
}

PRESTATAIRES_CONNUS = (
    "OTIS",
    "SCHINDLER",
    "CEGELEC",
    "KONE",
    "THYSSEN",
    "ORONA",
)

# Mots extraits à tort depuis « Données Prestataires - rendu Trimestriel »
_PRESTATAIRES_INVALIDES = frozenset(
    {
        "PRESTATAIRES",
        "PRESTATAIRE",
        "DONNEES",
        "DONNEE",
        "RENDU",
        "TRIMESTRIEL",
        "TRIMESTRE",
        "TRIMESTRIELLE",
        "FICHIER",
        "EXPORT",
    }
)

CLIENTS_CONNUS = (
    "SEMADER",
    "SIDR",
    "SODIAC",
    "GHER",
    "CADJEE",
    "SHLMR",
    "CDC",
)

ALIAS_CLIENTS = {
    "RIVIERE SCHINDLER": "SIDR",
    "GROUPEMENT GHER": "GHER",
    "GROUPE GHER": "GHER",
}


def _normaliser_client(nom: str) -> str:
    n = nom.strip().upper().replace("_", " ").replace("-", " ")
    n = re.sub(r"\s+", " ", n)
    for alias, cible in ALIAS_CLIENTS.items():
        if alias in n or n == alias.replace(" ", ""):
            return cible
    for c in CLIENTS_CONNUS:
        if c == n or c in n.split():
            return c
    return n.strip().upper()


def _normaliser_prestataire(nom: str) -> str:
    n = nom.strip().upper().replace("_", " ").replace("-", " ")
    n = re.sub(r"\s+", " ", n)
    for alias, cible in ALIAS_PRESTATAIRES.items():
        if alias.replace("-", " ") in n or n == alias:
            return cible
    for p in PRESTATAIRES_CONNUS:
        if p in n:
            return p
    return nom.strip().upper()


def _prestataire_valide(nom: Optional[str]) -> Optional[str]:
    if not nom:
        return None
    p = _normaliser_prestataire(str(nom))
    if p in _PRESTATAIRES_INVALIDES or len(p) < 3:
        return None
    return p


def detecter_depuis_nom_fichier(
    filename: Optional[str],
    chemin_parent: Optional[str] = None,
) -> dict[str, Optional[str]]:
    """
    Extrait prestataire, client, trimestre, année depuis le nom de fichier.
    Ex. Donnees_CEGELEC_T1-2026_-_GHER.xlsx
    """
    out: dict[str, Optional[str]] = {
        "prestataire": None,
        "client": None,
        "trimestre": None,
        "annee": None,
    }
    if not filename:
        return out

    nom = filename.upper().replace("É", "E")

    m = re.search(r"\bT([1-4])\b", nom)
    if m:
        out["trimestre"] = f"T{m.group(1)}"
    if not out["trimestre"]:
        m = re.search(r"\bQ([1-4])\b", nom)
        if m:
            out["trimestre"] = f"T{m.group(1)}"

    m = re.search(r"(20\d{2})", nom)
    if m:
        out["annee"] = m.group(1)

    for p in PRESTATAIRES_CONNUS:
        if p in nom:
            out["prestataire"] = p
            break
    if not out["prestataire"]:
        m = re.search(r"DONNEES[_\s-]+([A-Z0-9]+)", nom)
        if m:
            out["prestataire"] = _prestataire_valide(m.group(1))

    if not out["prestataire"] and chemin_parent:
        chemin_u = chemin_parent.upper().replace("É", "E")
        for p in PRESTATAIRES_CONNUS:
            if p in chemin_u:
                out["prestataire"] = p
                break

    for c in CLIENTS_CONNUS:
        if c in nom:
            out["client"] = c
            break
    if not out["client"]:
        for pattern in (
            r"[_\s-]+([A-Z]{3,12})\s*\.XLS",  # _-_ GHER.xlsx
            r"[_\s-]+([A-Z]{3,12})\s*\.XLSX",
            r"POUR[_\s-]+([A-Z]{3,12})",
            r"CLIENT[_\s-]+([A-Z]{3,12})",
            r"SCI[_\s-]+([A-Z]{3,12})(?:[_\s.]|$)",  # Q1 SCI CADJEE.xls
        ):
            m = re.search(pattern, nom)
            if m:
                candidat = _normaliser_client(m.group(1))
                if candidat in CLIENTS_CONNUS:
                    out["client"] = candidat
                    break

    return out


def clients_dans_donnees(donnees: dict) -> list[str]:
    """Clients distincts présents dans les feuilles (format multi-clients annexe 5)."""
    trouves: set[str] = set()
    for cle in ("interventions", "maintenance", "maintenance_lignes"):
        df = donnees.get(cle)
        if not isinstance(df, pd.DataFrame) or df.empty or "client" not in df.columns:
            continue
        for val in df["client"].dropna().astype(str):
            c = _normaliser_client(val)
            if c and c not in ("NAN", "NONE", ""):
                if c in CLIENTS_CONNUS or len(c) >= 3:
                    trouves.add(c)
    return sorted(trouves)


def client_depuis_parc(parc: pd.DataFrame | None, prestataire: Optional[str] = None) -> Optional[str]:
    """Si un seul client pour le prestataire dans le parc, le retourne."""
    from core.parc import _col_client, _col_marque

    if parc is None or parc.empty:
        return None
    col_c = _col_client(parc)
    if not col_c:
        return None
    df = parc.copy()
    if prestataire and _col_marque(parc):
        col_m = _col_marque(parc)
        p = _normaliser_prestataire(str(prestataire))
        df = df[df[col_m].astype(str).apply(lambda x: _normaliser_prestataire(x)) == p]
    clients = sorted(
        {_normaliser_client(str(v)) for v in df[col_c].dropna() if str(v).strip()}
    )
    clients = [c for c in clients if c and c != "NAN"]
    if len(clients) == 1:
        return clients[0]
    return None


def detecter_metadonnees(
    nom_fichier: Optional[str] = None,
    donnees: Optional[dict] = None,
    parc=None,
    prestataire_hint: Optional[str] = None,
    chemin_parent: Optional[str] = None,
) -> dict[str, Any]:
    """
    Fusionne les sources de détection (fichier, données, parc).
    Retourne valeurs proposées + source pour l'UI.
    """
    fichier = detecter_depuis_nom_fichier(nom_fichier, chemin_parent=chemin_parent or nom_fichier)
    prest = fichier.get("prestataire") or prestataire_hint
    client: Optional[str] = fichier.get("client")
    source_client = "nom_fichier" if client else None
    source_prest = "nom_fichier" if fichier.get("prestataire") else None

    clients_data: list[str] = []
    if donnees:
        clients_data = clients_dans_donnees(donnees)
        if len(clients_data) == 1:
            client = clients_data[0]
            source_client = "donnees"
        elif len(clients_data) > 1 and not client:
            source_client = "donnees_plusieurs"

    client_parc = client_depuis_parc(parc, prest)
    if client_parc:
        client = client_parc
        source_client = "parc"

    return {
        "client": client,
        "prestataire": prest or fichier.get("prestataire"),
        "trimestre": fichier.get("trimestre"),
        "annee": fichier.get("annee"),
        "source_client": source_client,
        "source_prestataire": source_prest or ("nom_fichier" if fichier.get("prestataire") else None),
        "clients_fichier": clients_data,
        "meta_fichier": fichier,
    }


def appliquer_detection_aux_params(
    params: dict,
    detection: dict,
    forcer: bool = False,
) -> dict:
    """
    Applique la détection aux paramètres si l'utilisateur n'a pas verrouillé le choix.
    forcer=True : réapplique même après modification (bouton « rédetecter »).
    """
    out = dict(params)
    manuel_client = bool(params.get("client_manuel")) and not forcer
    manuel_prest = bool(params.get("prestataire_manuel")) and not forcer

    prest = _prestataire_valide(detection.get("prestataire"))
    if prest and not manuel_prest:
        out["prestataire"] = prest
        filtre_p = out.get("filtre_prestataire")
        if filtre_p in (None, "", "Tous") or str(filtre_p).upper() in _PRESTATAIRES_INVALIDES:
            out["filtre_prestataire"] = prest

    if detection.get("trimestre"):
        out.setdefault("trimestre", detection["trimestre"])
    if detection.get("annee"):
        out.setdefault("annee", int(detection["annee"]))

    clients_fichier = detection.get("clients_fichier") or []
    if len(clients_fichier) > 1 and not detection.get("client") and not manuel_client:
        out["filtre_client"] = "Tous"
        out["hypotheses_client"] = clients_fichier[0]
    elif detection.get("client") and not manuel_client:
        out["filtre_client"] = detection["client"]
        out["hypotheses_client"] = detection["client"]

    out["detection_auto"] = detection
    return out


def verifier_coherence_prestataire(
    detecte: Optional[str],
    marque_parc: Optional[str],
) -> Optional[str]:
    """Retourne un message d'alerte si discordance, sinon None."""
    if not detecte or not marque_parc:
        return None
    d = _normaliser_prestataire(detecte)
    m = _normaliser_prestataire(marque_parc)
    if d != m:
        return f"Discordance : fichier « {d} » vs parc « {m} »."
    return None
