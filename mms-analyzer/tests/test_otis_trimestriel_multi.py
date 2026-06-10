# -*- coding: utf-8 -*-
"""Export OTIS trimestriel multi-clients (Annexe 5)."""

from __future__ import annotations

from pathlib import Path

import pytest

from core.service import detecter_fichier_metadata, executer_analyse

FICHIER = Path(
    r"c:\Users\Mili\OneDrive\Documents\T1-2026\Otis\donnees Prestataires - rendu Trimestriel Q1.xlsx"
)


@pytest.mark.skipif(not FICHIER.is_file(), reason="Fichier OTIS trimestriel absent sur ce poste")
def test_otis_trimestriel_multi_clients():
    contenu = FICHIER.read_bytes()
    chemin = f"Otis/{FICHIER.name}"
    meta = detecter_fichier_metadata(
        contenu,
        FICHIER.name,
        None,
        None,
        {"chemin_source": chemin, "prestataire": "OTIS"},
    )
    assert meta["params_suggestes"]["filtre_client"] == "Tous"
    assert meta["params_suggestes"]["prestataire"] == "OTIS"
    assert len(meta["clients_disponibles"]) >= 2

    result = executer_analyse(
        contenu,
        None,
        {
            "chemin_source": chemin,
            "filtre_client": "Tous",
            "prestataire": "OTIS",
            "filtre_prestataire": "OTIS",
            "integrer_graphiques": True,
        },
        FICHIER.name,
        None,
    )
    ind = result["indicateurs"]
    assert ind["nb_interventions"] > 0
    assert ind["nb_appareils"] > 0
    tranches = ind.get("tranches_delai") or {}
    assert tranches.get("inconnu", 0) < ind["nb_interventions"]
    assert result["fichiers"]["excel"]
    assert len(result.get("figures_paths") or {}) >= 1
