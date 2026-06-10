# -*- coding: utf-8 -*-
"""Test de validation CADJEE × OTIS T1 2026 — fourchette CR de référence."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from core.service import executer_analyse, params_par_defaut

FIXTURE_PATHS = [
    Path(os.environ.get("MMS_FIXTURE_CADJEE", r"c:\Users\Mili\Downloads\Q1 SCI CADJEE.xls")),
    ROOT / "tests" / "fixtures" / "Q1_SCI_CADJEE.xls",
]


def _chemin_fixture() -> Path:
    for p in FIXTURE_PATHS:
        if p.is_file():
            return p
    pytest.skip("Jeu CADJEE/OTIS absent — placez Q1 SCI CADJEE.xls dans tests/fixtures/")


@pytest.mark.parametrize("prorata_immo,prorata_pannes", [(False, False)])
def test_cadjee_otis_t1_penalites_dans_fourchette(prorata_immo: bool, prorata_pannes: bool) -> None:
    chemin = _chemin_fixture()
    params = params_par_defaut()
    params["trimestre"] = "T1"
    params["annee"] = 2026
    params["hypotheses_client"] = "CADJEE"
    params["prorata_immo_trimestriel"] = prorata_immo
    params["prorata_pannes_trimestriel"] = prorata_pannes

    result = executer_analyse(chemin.read_bytes(), None, params, nom_fichier_brut=chemin.name)
    pen = result["penalites"]
    detail = pen.get("detail", {})

    total = float(pen.get("penalite_totale", 0))
    assert 3200 <= total <= 3700, f"Pénalité totale {total} € hors fourchette 3200–3700 €"

    assert pen.get("penalite_immobilisation", 0) == 0, "Immobilisation T1 sans prorata = 0"
    assert pen.get("penalite_pannes", 0) == 0, "Pannes T1 sans historique 12 mois = 0"
    assert detail.get("mode_pannes") == "indicateur_sans_penalite"
    assert detail.get("mode_immobilisation") == "desactive_hors_t4"


def test_parachute_sept_appareils() -> None:
    chemin = _chemin_fixture()
    params = params_par_defaut()
    from core import parser, calculs

    donnees = parser.charger_fichier_prestataire(chemin.read_bytes(), chemin.name, params)
    donnees.pop("format")
    r = calculs.construire_resultats(donnees, None, params)
    para = r["parachute"]
    assert len(para) >= 7, "Au moins 7 tests parachute (03/03/2026)"


def test_libelles_parachute_variantes() -> None:
    from core.calculs import _est_ligne_test_parachute_cables

    for lib in (
        "essai parachute",
        "test parachute",
        "prise de parachute",
        "système parachute",
        "PARACHUTE",
    ):
        para, _ = _est_ligne_test_parachute_cables(lib)
        assert para, lib
