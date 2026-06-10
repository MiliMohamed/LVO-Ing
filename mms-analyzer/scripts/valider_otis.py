# -*- coding: utf-8 -*-
"""Validation parseur OTIS SCI — Q1 SCI CADJEE.xls (T1, seuils annuels par défaut)."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from core.service import executer_analyse, params_par_defaut

CHEMIN_DEFAUT = Path(r"c:\Users\Mili\Downloads\Q1 SCI CADJEE.xls")


def main() -> int:
    chemin = Path(sys.argv[1]) if len(sys.argv) > 1 else CHEMIN_DEFAUT
    if not chemin.is_file():
        print(f"Fichier introuvable : {chemin}")
        return 1

    params = params_par_defaut()
    params["trimestre"] = "T1"
    result = executer_analyse(chemin.read_bytes(), None, params, nom_fichier_brut=chemin.name)
    pen = result["penalites"]
    detail = pen.get("detail", {})

    print(f"format: {result.get('format_source')}")
    print(f"total: {pen.get('penalite_totale')} €")
    print(
        f"  maint={pen.get('penalite_maintenance')} pannes={pen.get('penalite_pannes')} "
        f"immo={pen.get('penalite_immobilisation')} delai={pen.get('penalite_delai_intervention')}"
    )
    print(f"modes: pannes={detail.get('mode_pannes')} immo={detail.get('mode_immobilisation')}")
    print(f"voyants seuil annuel (>=2 pannes/T1): {detail.get('nb_appareils_seuil_annuel_atteint')}")

    erreurs: list[str] = []
    if pen.get("penalite_immobilisation", 0) != 0:
        erreurs.append("immo doit être 0 en T1 sans prorata")
    if pen.get("penalite_pannes", 0) != 0:
        erreurs.append("pannes doit être 0 en T1 sans prorata")
    if detail.get("nb_appareils_seuil_annuel_atteint", 0) != 4:
        erreurs.append(
            f"4 appareils voyant rouge attendus (≥2 pannes/T1), reçu {detail.get('nb_appareils_seuil_annuel_atteint')}"
        )
    total = float(pen.get("penalite_totale", 0))
    if not (3200 <= total <= 3700):
        erreurs.append(f"total hors fourchette 3200–3700 € (±10 % CR) : {total}")

    if erreurs:
        print("ÉCHEC:", *erreurs, sep="\n  ")
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
