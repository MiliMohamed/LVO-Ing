# -*- coding: utf-8 -*-
"""
Paramètres contractuels par défaut (exemple marché CADJEE/OTIS).
Modifiables dans l'interface Streamlit avant génération des livrables.
"""

# Seuils par défaut
SEUIL_ECART_MAINTENANCE_JOURS = 42
SEUIL_PANNES_PAR_AN_APPAREIL = 2
SEUIL_IMMOBILISATION_HEURES_AN = 48
SEUIL_DELAI_INTERVENTION_HEURES = 2
SEUIL_DESINCARCERATION_MINUTES = 45
SEUIL_PARACHUTE_MOIS = 12
SEUIL_CABLES_MOIS = 6

# Tarifs de pénalité par défaut (€) — marché CADJEE
TARIF_PENALITE_JOUR_MAINTENANCE = 50.0
TARIF_PENALITE_PANNE = 150.0
TARIF_PENALITE_HEURE_IMMOBILISATION = 50.0
TARIF_PENALITE_HEURE_DELAI = 50.0

# Clients du groupement
CLIENTS_GROUPEMENT = ("SIDR", "SODIAC", "SEMADER", "CDC")

# Correspondance « type de panne » (normalisé) → catégorie
# Clés en minuscules sans espaces superflus ; valeurs : "retenue" | "non_retenue"
TABLE_CLASSEMENT_PANNES_DEFAUT = {
    "panne technique": "retenue",
    "appareil repris en panne": "retenue",
    "désincarcération": "retenue",
    "desincarceration": "retenue",
    "réparation temporaire": "non_retenue",
    "reparation temporaire": "non_retenue",
    "mauvaise utilisation": "non_retenue",
    "vandalisme": "non_retenue",
    "cause exterieure": "non_retenue",
    "cause extérieure": "non_retenue",
    "pas de panne": "non_retenue",
    "app en fin de vie": "non_retenue",
    "en fonction": "non_retenue",
}

# Noms de feuilles attendus (recherche partielle insensible à la casse)
FEUILLES_INTERVENTION = ("historique intervention", "intervention")
FEUILLES_MAINTENANCE = ("historique maintenance", "maintenance")
FEUILLES_PARACHUTE = ("test parachute", "parachute")
FEUILLES_CABLES = ("controle des cables", "contrôle des câbles", "controle cables", "cables")

# Site unique CADJEE (format OTIS SCI)
CLIENT_SITE_CADJEE = "CADJEE"
ADRESSE_SITE_CADJEE = "Centre d'Affaires CADJEE"
