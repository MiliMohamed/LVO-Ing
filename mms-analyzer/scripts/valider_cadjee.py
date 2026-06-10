# -*- coding: utf-8 -*-
"""Validation Q1 SCI CADJEE — chiffres attendus."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from config import parametres as cfg
from core import calculs, parser

FICHIER = Path(r"c:\Users\Mili\Downloads\Q1 SCI CADJEE.xls")


def main() -> None:
    if not FICHIER.exists():
        print("Fichier absent:", FICHIER)
        return
    params = {"client_site": cfg.CLIENT_SITE_CADJEE, "adresse_site": cfg.ADRESSE_SITE_CADJEE}
    donnees = parser.charger_fichier_prestataire(FICHIER.read_bytes(), FICHIER.name, params)
    print("format:", donnees.get("format"))
    donnees.pop("format", None)
    r = calculs.construire_resultats(donnees, None, params)
    syn = r["synthese_appareils"]
    inter = r["interventions"]
    maint = r["maintenance"]
    pen = r["penalites"]

    print("=== Format", r.get("format", "?"))
    print("Interventions:", len(inter))
    print("Pannes retenues:", int(inter["panne_retenue"].sum()) if "panne_retenue" in inter.columns else "?")
    print("Ascenseurs:", sorted(inter["ascenseur"].unique().tolist()) if "ascenseur" in inter.columns else [])
    print("Synthèse lignes:", len(syn))
    if not syn.empty:
        print(syn[["ascenseur", "nb_interventions", "nb_pannes_retenues", "cumul_intervention_h"]].to_string())
    print("Maintenance (après dédup):", len(maint))
    print("Delta > 42j:", int(maint["ecart_signale"].sum()) if "ecart_signale" in maint.columns else 0)
    print("Tranches:", inter["tranche_delai"].value_counts().to_dict() if "tranche_delai" in inter.columns else {})
    if "intervention_h" in inter.columns:
        print("Delais h (min-max):", inter["intervention_h"].min(), inter["intervention_h"].max())
    print("Pénalités:", pen)
    print("Matrice pannes vide?", r["matrice_pannes"].empty)


if __name__ == "__main__":
    main()
