# -*- coding: utf-8 -*-
"""Analyse du fichier parc : couples client × prestataire."""

from __future__ import annotations

import re
from typing import Any

import pandas as pd

from core.prestataire_detect import _normaliser_prestataire


def _col_client(df: pd.DataFrame) -> str | None:
    for c in df.columns:
        cn = str(c).lower()
        if "identite client" in cn or "identité client" in cn or cn == "client":
            return c
    return None


def _col_marque(df: pd.DataFrame) -> str | None:
    for c in df.columns:
        cn = str(c).lower()
        if cn in ("marque", "prestataire", "mainteneur"):
            return c
    return None


def couples_client_prestataire(parc: pd.DataFrame) -> list[dict[str, Any]]:
    """Liste des couples (client, prestataire) présents dans le parc."""
    if parc is None or parc.empty:
        return []

    col_c = _col_client(parc)
    col_m = _col_marque(parc)
    if not col_c:
        return []

    couples: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()

    for _, row in parc.iterrows():
        client = str(row.get(col_c, "") or "").strip().upper()
        if not client or client == "NAN":
            continue
        marque = ""
        if col_m:
            marque = _normaliser_prestataire(str(row.get(col_m, "") or ""))
        cle = (client, marque or "INCONNU")
        if cle in seen:
            continue
        seen.add(cle)
        nb = int(
            parc[
                parc[col_c].astype(str).str.strip().str.upper() == client
            ].shape[0]
        )
        if col_m and marque:
            nb = int(
                parc[
                    (parc[col_c].astype(str).str.strip().str.upper() == client)
                    & (parc[col_m].astype(str).apply(lambda x: _normaliser_prestataire(str(x))) == marque)
                ].shape[0]
            )
        couples.append(
            {
                "client": client,
                "prestataire": marque or "INCONNU",
                "nb_appareils": nb,
            }
        )

    return sorted(couples, key=lambda x: (x["client"], x["prestataire"]))


def prestataires_pour_client(parc: pd.DataFrame, client: str) -> list[str]:
    """Prestataires présents sur le parc d'un client donné."""
    couples = couples_client_prestataire(parc)
    c = str(client).strip().upper()
    return sorted({x["prestataire"] for x in couples if x["client"] == c})


def filtrer_parc(parc: pd.DataFrame, client: str | None, prestataire: str | None) -> pd.DataFrame:
    if parc is None or parc.empty:
        return pd.DataFrame()
    out = parc.copy()
    col_c = _col_client(out)
    col_m = _col_marque(out)
    if client and col_c:
        out = out[out[col_c].astype(str).str.strip().str.upper() == str(client).strip().upper()]
    if prestataire and col_m:
        p = _normaliser_prestataire(str(prestataire))
        out = out[out[col_m].astype(str).apply(lambda x: _normaliser_prestataire(str(x)) == p)]
    return out.reset_index(drop=True)
