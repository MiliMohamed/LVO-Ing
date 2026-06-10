# -*- coding: utf-8 -*-
"""
Interface Streamlit — Analyse des données de maintenance ascenseurs (LVO-Ingénierie).
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd
import streamlit as st

# Racine du projet pour les imports config / core
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from config import parametres as cfg
from core import calculs, export_excel, export_word, parser
from core.export_word import creer_modele_si_absent

st.set_page_config(
    page_title="LVO — Analyse maintenance ascenseurs",
    page_icon="🛗",
    layout="wide",
)

st.title("Analyse maintenance ascenseurs")
st.caption("LVO-Ingénierie — Groupement SIDR / SODIAC / SEMADER / CDC")

st.warning(
    "Hypothèses par défaut : marché CADJEE (tarifs et seuils annuels proratisés au trimestre). "
    "Le marché du Groupement peut prévoir des valeurs différentes : vérifiez et ajustez "
    "les paramètres ci-dessous avant de générer les livrables."
)

# --- Sidebar : dépôt des fichiers ---
with st.sidebar:
    st.header("1. Fichiers")
    fichier_brut = st.file_uploader(
        "Données brutes prestataire (obligatoire)",
        type=["xlsx", "xls"],
        help="Classeur 4 feuilles : interventions, maintenance, parachute, câbles",
    )
    fichier_parc = st.file_uploader(
        "Liste du parc (optionnel)",
        type=["xlsx", "xls"],
        help="Colonnes Ascenseur, Client, Résidence",
    )

# --- Paramètres ---
st.header("2. Paramètres")
col1, col2, col3 = st.columns(3)

with col1:
    prestataire = st.text_input("Prestataire", value="OTIS")
    trimestre = st.selectbox("Trimestre", ["T1", "T2", "T3", "T4"], index=0)
    annee = st.number_input("Année", min_value=2010, max_value=2100, value=date.today().year)
    date_cr = st.date_input("Date du compte-rendu", value=date.today())

with col2:
    st.subheader("Seuils contractuels")
    seuil_maint = st.number_input("Écart max. entre visites (jours)", value=cfg.SEUIL_ECART_MAINTENANCE_JOURS, min_value=1)
    seuil_pannes = st.number_input("Pannes max. / an / appareil", value=cfg.SEUIL_PANNES_PAR_AN_APPAREIL, min_value=0)
    seuil_immo = st.number_input("Immobilisation max. (h/an/appareil)", value=float(cfg.SEUIL_IMMOBILISATION_HEURES_AN))
    seuil_delai = st.number_input("Délai d'intervention max. (h)", value=float(cfg.SEUIL_DELAI_INTERVENTION_HEURES))
    seuil_desinc = st.number_input("Délai désincarcération (min)", value=cfg.SEUIL_DESINCARCERATION_MINUTES)
    seuil_para = st.number_input("Écart max. test parachute (mois)", value=cfg.SEUIL_PARACHUTE_MOIS)
    seuil_cables = st.number_input("Écart max. contrôle câbles (mois)", value=cfg.SEUIL_CABLES_MOIS)
    prorata_immo = st.checkbox(
        "Prorata trimestriel immobilisation (12 h/Q)",
        value=False,
        help="Décoché : pénalité immo uniquement au T4 sur cumul annuel (48 h).",
    )
    prorata_pannes = st.checkbox(
        "Prorata trimestriel pannes (seuil ÷ 4)",
        value=False,
        help="Décoché : indicateur seul en T1–T3 ; pénalité au T4 (2 pannes/an).",
    )

with col3:
    st.subheader("Tarifs de pénalité (€)")
    tarif_jour = st.number_input("€ / jour (maintenance)", value=float(cfg.TARIF_PENALITE_JOUR_MAINTENANCE), format="%.2f")
    tarif_panne = st.number_input("€ / panne excédentaire", value=float(cfg.TARIF_PENALITE_PANNE), format="%.2f")
    tarif_immo = st.number_input("€ / h immobilisation", value=float(cfg.TARIF_PENALITE_HEURE_IMMOBILISATION), format="%.2f")
    tarif_delai = st.number_input("€ / h délai intervention", value=float(cfg.TARIF_PENALITE_HEURE_DELAI), format="%.2f")
    commentaire_cr = st.text_area("Commentaire (compte-rendu)", height=80)

st.subheader("Table de classement des types de panne")
with st.expander("Modifier la correspondance type → retenue / non retenue"):
    table_json = st.text_area(
        "JSON : clé = libellé normalisé (minuscules), valeur = retenue | non_retenue",
        value=json.dumps(cfg.TABLE_CLASSEMENT_PANNES_DEFAUT, ensure_ascii=False, indent=2),
        height=200,
    )
    try:
        table_classement = json.loads(table_json)
    except json.JSONDecodeError:
        st.error("JSON invalide — utilisation de la table par défaut.")
        table_classement = cfg.TABLE_CLASSEMENT_PANNES_DEFAUT.copy()

params = {
    "prestataire": prestataire,
    "trimestre": trimestre,
    "annee": int(annee),
    "date_cr": date_cr.strftime("%d/%m/%Y"),
    "commentaire": commentaire_cr,
    "seuil_maintenance_jours": int(seuil_maint),
    "seuil_pannes_an": int(seuil_pannes),
    "seuil_immo_h": float(seuil_immo),
    "seuil_delai_h": float(seuil_delai),
    "seuil_desincarc_min": int(seuil_desinc),
    "seuil_parachute_mois": int(seuil_para),
    "seuil_cables_mois": int(seuil_cables),
    "tarif_jour": float(tarif_jour),
    "tarif_panne": float(tarif_panne),
    "tarif_heure_immo": float(tarif_immo),
    "tarif_heure_delai": float(tarif_delai),
    "table_classement": table_classement,
    "prorata_immo_trimestriel": prorata_immo,
    "prorata_pannes_trimestriel": prorata_pannes,
}

# --- Traitement ---
if fichier_brut is None:
    st.info("Déposez le fichier brut du prestataire pour lancer l'analyse.")
    st.stop()

try:
    contenu_brut = fichier_brut.read()
    donnees = parser.charger_fichier_prestataire(contenu_brut)
    parc = pd.DataFrame()
    if fichier_parc is not None:
        parc = parser.charger_liste_parc(fichier_parc.read())
except Exception as exc:
    st.error(f"Erreur de lecture du fichier : {exc}")
    st.stop()

# --- Filtre périmètre ---
st.header("3. Périmètre du rapport")
interventions_raw = donnees.get("interventions", pd.DataFrame())
clients_dispo = ["Tous"]
adresses_dispo = ["Tous"]
if not interventions_raw.empty and "client" in interventions_raw.columns:
    clients_dispo += sorted(interventions_raw["client"].dropna().astype(str).unique().tolist())
if not interventions_raw.empty and "adresse" in interventions_raw.columns:
    adresses_dispo += sorted(interventions_raw["adresse"].dropna().astype(str).unique().tolist())

fc1, fc2 = st.columns(2)
with fc1:
    filtre_client = st.selectbox("Client", clients_dispo)
with fc2:
    filtre_adresse = st.selectbox("Site / résidence", adresses_dispo)

donnees_filtrees = calculs.filtrer_perimetre(
    donnees,
    None if filtre_client == "Tous" else filtre_client,
    None if filtre_adresse == "Tous" else filtre_adresse,
)

try:
    resultats = calculs.construire_resultats(donnees_filtrees, parc, params)
except Exception as exc:
    st.error(f"Erreur lors des calculs : {exc}")
    st.stop()

# --- Aperçu ---
st.header("4. Aperçu")

pen = resultats["penalites"]
m1, m2, m3, m4, m5 = st.columns(5)
m1.metric("Interventions", len(resultats["interventions"]))
m2.metric("Pannes retenues", int(resultats["interventions"]["panne_retenue"].sum()) if not resultats["interventions"].empty else 0)
m3.metric("Visites maintenance", len(resultats["maintenance"]))
m4.metric("Pénalité totale (€)", f"{pen['penalite_totale']:,.2f}")
m5.metric("Appareils (synthèse)", len(resultats["synthese_appareils"]))

tab1, tab2, tab3, tab4 = st.tabs(
    ["Historique", "Synthèse appareils", "Pénalités", "Parc sans activité"]
)
with tab1:
    st.dataframe(resultats["interventions"], use_container_width=True, height=350)
with tab2:
    st.dataframe(resultats["synthese_appareils"], use_container_width=True)
with tab3:
    st.json(pen)
with tab4:
    if resultats["parc_orphelins"].empty:
        st.success("Aucun appareil du parc sans activité (ou liste parc non fournie).")
    else:
        st.dataframe(resultats["parc_orphelins"], use_container_width=True)

# Graphiques
if not resultats["synthese_appareils"].empty:
    st.subheader("Graphiques")
    g1, g2 = st.columns(2)
    syn = resultats["synthese_appareils"]

    with g1:
        fig, ax = plt.subplots(figsize=(8, 4))
        top = syn.nlargest(15, "nb_pannes_retenues")
        ax.barh(
            top["ascenseur"].astype(str) + " (" + top["client"].astype(str) + ")",
            top["nb_pannes_retenues"],
            color="#2563eb",
        )
        ax.set_xlabel("Pannes retenues")
        ax.set_title("Top 15 appareils — pannes retenues")
        plt.tight_layout()
        st.pyplot(fig)
        plt.close()

    with g2:
        if not resultats["interventions"].empty:
            tr = resultats["interventions"]["tranche_delai"].value_counts()
            fig2, ax2 = plt.subplots(figsize=(6, 4))
            ax2.pie(tr.values, labels=tr.index, autopct="%1.0f%%", startangle=90)
            ax2.set_title("Répartition des délais d'intervention")
            st.pyplot(fig2)
            plt.close()

# --- Génération ---
st.header("5. Génération des livrables")
creer_modele_si_absent()

col_dl1, col_dl2 = st.columns(2)
with col_dl1:
    try:
        excel_bytes = export_excel.generer_tableau_mms(resultats, params, seuil_pannes_an=int(seuil_pannes))
        nom_excel = f"Tableau_MMS_{prestataire}_{trimestre}_{annee}.xlsx"
        st.download_button(
            "Télécharger le Tableau MMS (Excel)",
            data=excel_bytes,
            file_name=nom_excel,
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    except Exception as exc:
        st.error(f"Export Excel : {exc}")

with col_dl2:
    try:
        word_bytes = export_word.generer_compte_rendu(resultats, params)
        nom_word = f"CR_{prestataire}_{trimestre}_{annee}.docx"
        st.download_button(
            "Télécharger le Compte-rendu (Word)",
            data=word_bytes,
            file_name=nom_word,
            mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
    except Exception as exc:
        st.error(f"Export Word : {exc}")
