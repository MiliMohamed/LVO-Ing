# -*- coding: utf-8 -*-
"""
Génère un fichier Excel de test minimal pour valider le pipeline sans données CADJEE.
Usage : py scripts/generer_donnees_test.py
"""

from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd

OUT = Path(__file__).resolve().parent.parent / "samples" / "donnees_test_prestataire.xlsx"


def main() -> None:
    base = datetime(2025, 1, 15, 8, 0)
    interventions = pd.DataFrame(
        {
            "Adresse": ["Résidence Les Flamboyants", "Résidence Les Flamboyants"],
            "Client": ["SIDR", "SODIAC"],
            "Ascenseur": ["ASC-001", "ASC-002"],
            "Date / Heure": [base, base + timedelta(days=5)],
            "Nom appelant": ["Gardien", "Résident"],
            "Date Début / Heure Déb": [base + timedelta(hours=1), base + timedelta(days=5, hours=2)],
            "Date Fin / Heure": [base + timedelta(hours=3), base + timedelta(days=5, hours=4)],
            "Nom technicien": ["Tech A", "Tech B"],
            "cause de la panne": ["Porte", "Moteur"],
            "Matériel sur lequel la panne est détectée": ["Porte palière", "Moteur"],
            "Type de panne": ["Panne technique", "Cause extérieure"],
        }
    )
    maintenance = pd.DataFrame(
        {
            "Adresse": ["Résidence Les Flamboyants"],
            "Client": ["SIDR"],
            "Ascenseur": ["ASC-001"],
            "Date Début": [datetime(2025, 1, 1)],
            "Heure Déb": ["9h00"],
            "Date Fin": [datetime(2025, 1, 1)],
            "Heure": ["11h30"],
            "Nom technicien": ["Tech A"],
            "Type de Maintenance": ["Entretien trimestriel"],
            "Matériel Changé": [""],
        }
    )
    parachute = pd.DataFrame(
        {
            "Adresse": ["Résidence Les Flamboyants"],
            "Client": ["SIDR"],
            "Ascenseur": ["ASC-001"],
            "Date Début": [datetime(2025, 2, 1)],
            "Heure Déb": ["10h00"],
            "Date Fin": [datetime(2025, 2, 1)],
            "Heure": ["10h30"],
            "Nom technicien": ["Tech A"],
        }
    )
    cables = parachute.copy()

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with pd.ExcelWriter(OUT, engine="openpyxl") as w:
        interventions.to_excel(w, sheet_name="Historique Intervention", index=False)
        maintenance.to_excel(w, sheet_name="Historique Maintenance", index=False)
        parachute.to_excel(w, sheet_name="Test Parachute", index=False)
        cables.to_excel(w, sheet_name="Controle des Cables", index=False)
    print(f"Fichier créé : {OUT}")


if __name__ == "__main__":
    main()
