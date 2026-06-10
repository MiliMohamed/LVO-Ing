# -*- coding: utf-8 -*-
"""Chargement des seuils contractuels par client (YAML)."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

try:
    import yaml
except ImportError:
    yaml = None  # type: ignore

from config.hypotheses_marche import appliquer_hypotheses_client, charger_hypotheses

CLIENTS_DIR = Path(__file__).resolve().parent / "clients"


def charger_config_client(client: str | None) -> dict[str, Any]:
    """Fusionne YAML client, hypothèses JSON et défauts GHER."""
    if not client or str(client).strip().upper() in ("", "TOUS"):
        return {}
    cle = str(client).strip().upper()
    out: dict[str, Any] = {}

    fichier = CLIENTS_DIR / f"{cle.lower()}.yaml"
    if yaml and fichier.is_file():
        try:
            data = yaml.safe_load(fichier.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                out.update(data)
        except OSError:
            pass

    if not out and (CLIENTS_DIR / "gher.yaml").is_file() and yaml:
        try:
            data = yaml.safe_load((CLIENTS_DIR / "gher.yaml").read_text(encoding="utf-8"))
            if isinstance(data, dict):
                out.update(data)
        except OSError:
            pass

    catalogue = charger_hypotheses()
    if cle in catalogue:
        profil = catalogue[cle]
        mapping = {
            "seuil_maintenance_jours": "seuil_maintenance_jours",
            "seuil_pannes_an": "seuil_pannes_an",
            "seuil_immo_h": "seuil_immo_h",
            "seuil_delai_h": "seuil_delai_h",
            "tarif_jour": "tarif_jour",
            "tarif_panne": "tarif_panne",
            "tarif_heure_immo": "tarif_heure_immo",
            "tarif_heure_delai": "tarif_heure_delai",
        }
        for src, dst in mapping.items():
            if src in profil:
                out[dst] = profil[src]

    return out


def appliquer_config_client(params: dict[str, Any], client: str | None) -> dict[str, Any]:
    """Applique config YAML + hypothèses marché au dict params."""
    p = appliquer_hypotheses_client(params, client)
    cfg_yaml = charger_config_client(client)
    if cfg_yaml:
        p.update({k: v for k, v in cfg_yaml.items() if v is not None})
        p["config_client"] = str(client).strip().upper()
    return p
