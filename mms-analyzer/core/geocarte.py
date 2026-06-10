# -*- coding: utf-8 -*-
"""Cartographie des pénalités par adresse (géocodage Nominatim)."""

from __future__ import annotations

import hashlib
import logging
import time
from pathlib import Path
from typing import Any, Optional

import matplotlib.pyplot as plt
import pandas as pd

from core.figures import CHARTE, _savefig, _titre

logger = logging.getLogger(__name__)

# Centre La Réunion (repli si géocodage indisponible)
_REUNION_CENTER = (-21.1151, 55.5364)
_GEO_CACHE: dict[str, tuple[float, float] | None] = {}


def _geocoder(adresse: str) -> tuple[float, float] | None:
    """Géocode une adresse (cache mémoire, débit Nominatim respecté)."""
    cle = adresse.strip().lower()
    if not cle or cle == "nan":
        return None
    if cle in _GEO_CACHE:
        return _GEO_CACHE[cle]

    coords: tuple[float, float] | None = None
    try:
        from geopy.geocoders import Nominatim

        geo = Nominatim(user_agent="lvo-mms-analyzer/1.0", timeout=8)
        query = adresse if "réunion" in cle or "reunion" in cle else f"{adresse}, La Réunion, France"
        time.sleep(1.05)
        loc = geo.geocode(query)
        if loc:
            coords = (float(loc.latitude), float(loc.longitude))
    except Exception as exc:
        logger.info("Géocodage « %s » : %s", adresse[:40], exc)

    if coords is None:
        h = int(hashlib.md5(cle.encode()).hexdigest()[:8], 16)
        lat = _REUNION_CENTER[0] + ((h % 1000) - 500) / 50000.0
        lon = _REUNION_CENTER[1] + (((h >> 10) % 1000) - 500) / 50000.0
        coords = (lat, lon)
        logger.debug("Repli géographique pour %s", adresse[:30])

    _GEO_CACHE[cle] = coords
    return coords


def generer_carte_penalites(
    resultats: dict[str, Any],
    params: dict[str, Any],
    penalites: dict[str, Any],
    out_dir: Path,
) -> Optional[str]:
    """
    Carte scatter : taille/couleur selon exposition aux pénalités par appareil.
    Retourne le chemin PNG ou None.
    """
    synthese = resultats.get("synthese_appareils", pd.DataFrame())
    if synthese.empty or "adresse" not in synthese.columns:
        return None

    client = str(params.get("filtre_client") or params.get("hypotheses_client") or "CLIENT")
    if client.upper() == "TOUS":
        client = str(params.get("client_site", "CLIENT"))
    prestataire = str(params.get("prestataire", "PRESTATAIRE"))
    trimestre = str(params.get("trimestre", "T1"))
    annee = int(params.get("annee", 2026))

    points: list[dict[str, Any]] = []
    for _, row in synthese.iterrows():
        adr = str(row.get("adresse", "") or "").strip()
        if not adr:
            continue
        coords = _geocoder(adr)
        if not coords:
            continue
        score = float(row.get("nb_pannes_retenues", 0) or 0) * 150
        score += float(row.get("cumul_indisponibilite_h", 0) or 0) * 50
        points.append(
            {
                "lat": coords[0],
                "lon": coords[1],
                "score": max(score, 50),
                "ascenseur": str(row.get("ascenseur", "")),
                "adresse": adr,
            }
        )

    if not points:
        return None

    out_dir.mkdir(parents=True, exist_ok=True)
    df = pd.DataFrame(points)

    fig, ax = plt.subplots(figsize=(10, 8))
    total_pen = float(penalites.get("penalite_totale", 0))
    norm = plt.Normalize(df["score"].min(), max(df["score"].max(), 1))
    colors = [plt.cm.RdYlGn_r(norm(s)) for s in df["score"]]
    ax.scatter(
        df["lon"],
        df["lat"],
        s=df["score"] / 8 + 40,
        c=colors,
        alpha=0.85,
        edgecolors=CHARTE["navy"],
        linewidths=0.6,
    )
    for _, r in df.iterrows():
        ax.annotate(
            r["ascenseur"],
            (r["lon"], r["lat"]),
            fontsize=7,
            ha="center",
            xytext=(0, 6),
            textcoords="offset points",
        )

    ax.set_xlabel("Longitude")
    ax.set_ylabel("Latitude")
    ax.set_title(
        _titre(client, prestataire, trimestre, annee, f"Cartographie pénalités (total {total_pen:,.0f} €)")
    )
    ax.grid(True, alpha=0.3)

    chemin = out_dir / "carte_penalites.png"
    _savefig(chemin, fig)
    return str(chemin)
