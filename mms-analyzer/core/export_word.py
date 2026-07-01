# -*- coding: utf-8 -*-
"""
Génération du compte-rendu trimestriel Word — calqué sur le format
« Compte-rendu de chantier » LVO (tableau d'intervenants, sections
numérotées Responsable/Délai, pénalités chiffrées, synthèse, signature).
"""

from __future__ import annotations

import io
from datetime import date
from pathlib import Path
from typing import Any, Optional

import pandas as pd
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor
from docx.enum.table import WD_TABLE_ALIGNMENT

from config import parametres as cfg

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"
ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"
MODELE_CR = TEMPLATES_DIR / "CR_modele.docx"
LOGO_SVG = ASSETS_DIR / "logo-lvo.svg"
LOGO_COLOR_PNG = ASSETS_DIR / "logo_lvo_color.png"

NAVY = RGBColor(0x1F, 0x3A, 0x5F)
ORANGE = RGBColor(0xE6, 0x7E, 0x22)
ROUGE = RGBColor(0xC0, 0x39, 0x2B)
VERT = RGBColor(0x27, 0xAE, 0x60)
GRIS = RGBColor(0x5D, 0x6D, 0x7E)

_FOND_ENTETE = "1F3A5F"
_FOND_ALERTE = "FDEDEC"
_FOND_OK = "EAFAF1"
_FOND_GRIS = "F4F6F7"


def creer_modele_si_absent() -> Path:
    """Conservé pour compatibilité (l'export ne dépend plus d'un template Jinja)."""
    TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)
    return MODELE_CR


def _ombrer_cellule(cell, hex_color: str) -> None:
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color)
    cell._tc.get_or_add_tcPr().append(shd)


_W_FLDCHAR = "w:fldChar"
_W_FLDCHARTYPE = "w:fldCharType"


def _bordurer_table(table, couleur: str = "D5D8DC") -> None:
    tbl = table._tbl
    tbl_pr = tbl.tblPr
    borders = OxmlElement("w:tblBorders")
    for nom in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = OxmlElement(f"w:{nom}")
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), "4")
        el.set(qn("w:color"), couleur)
        borders.append(el)
    tbl_pr.append(borders)


def _texte_cellule(cell, texte: str, *, gras: bool = False, couleur: Optional[RGBColor] = None, taille: int = 9) -> None:
    cell.text = ""
    p = cell.paragraphs[0]
    lignes = str(texte).split("\n")
    for i, ligne in enumerate(lignes):
        run = p.add_run(ligne) if i == 0 else p.add_run("\n" + ligne)
        run.bold = gras
        run.font.size = Pt(taille)
        if couleur:
            run.font.color.rgb = couleur


def _ajouter_champ_page(p, instr_texte: str) -> None:
    """Insère un champ Word dynamique (ex. PAGE, NUMPAGES) dans le run courant du paragraphe."""
    run = p.add_run()
    fld_begin = OxmlElement(_W_FLDCHAR)
    fld_begin.set(qn(_W_FLDCHARTYPE), "begin")
    instr = OxmlElement("w:instrText")
    instr.text = instr_texte
    fld_sep = OxmlElement(_W_FLDCHAR)
    fld_sep.set(qn(_W_FLDCHARTYPE), "separate")
    fld_end = OxmlElement(_W_FLDCHAR)
    fld_end.set(qn(_W_FLDCHARTYPE), "end")
    run._r.append(fld_begin)
    run._r.append(instr)
    run._r.append(fld_sep)
    run._r.append(fld_end)
    run.font.size = Pt(8)
    return run


def _ajouter_pied_de_page(doc: Document, contexte: dict[str, Any]) -> None:
    section = doc.sections[0]
    footer = section.footer
    p = footer.paragraphs[0] if footer.paragraphs else footer.add_paragraph()
    p.text = ""
    run = p.add_run(
        f"LVO-Ingénierie — Compte-rendu {contexte['trimestre']} {contexte['annee']} — "
        f"{contexte['client']} / {contexte['prestataire']}    Page "
    )
    run.font.size = Pt(8)
    run.font.color.rgb = GRIS

    _ajouter_champ_page(p, "PAGE")
    run_sur = p.add_run(" sur ")
    run_sur.font.size = Pt(8)
    run_sur.font.color.rgb = GRIS
    _ajouter_champ_page(p, "NUMPAGES")
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER


def _assurer_logo_couleur() -> Optional[Path]:
    """Génère un PNG charte LVO si absent (logo couleur pour les rapports)."""
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    if LOGO_COLOR_PNG.is_file():
        return LOGO_COLOR_PNG
    if LOGO_SVG.is_file():
        try:
            import cairosvg

            cairosvg.svg2png(url=str(LOGO_SVG), write_to=str(LOGO_COLOR_PNG), output_width=800)
            return LOGO_COLOR_PNG
        except Exception:
            pass
    try:
        import matplotlib.pyplot as plt

        fig, ax = plt.subplots(figsize=(4, 1.2))
        ax.set_axis_off()
        ax.text(0.5, 0.55, "LVO", fontsize=42, fontweight="bold", color="#1F3A5F", ha="center", va="center", transform=ax.transAxes)
        ax.text(0.5, 0.15, "Ingénierie", fontsize=14, color="#E67E22", ha="center", va="center", transform=ax.transAxes)
        fig.savefig(LOGO_COLOR_PNG, dpi=200, bbox_inches="tight", facecolor="white")
        plt.close(fig)
        return LOGO_COLOR_PNG
    except Exception:
        return None


def _ajouter_entete(doc: Document, contexte: dict[str, Any]) -> None:
    logo = _assurer_logo_couleur()
    if logo and logo.is_file() and doc.sections:
        header = doc.sections[0].header
        p = header.paragraphs[0] if header.paragraphs else header.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.add_run().add_picture(str(logo), width=Cm(4.0))

    titre1 = doc.add_paragraph()
    titre1.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r1 = titre1.add_run(f"COMPTE-RENDU DU {contexte['date_cr']}")
    r1.bold = True
    r1.font.size = Pt(15)
    r1.font.color.rgb = NAVY

    titre2 = doc.add_paragraph()
    titre2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r2 = titre2.add_run(f"SYNTHÈSE ACTIVITÉ {contexte['trimestre']}-{contexte['annee']}")
    r2.bold = True
    r2.font.size = Pt(12)
    r2.font.color.rgb = ORANGE
    doc.add_paragraph()


def _ajouter_table_intervenants(doc: Document, contexte: dict[str, Any], params: dict[str, Any]) -> None:
    intervenants = params.get("intervenants") or [
        {"societe": contexte["prestataire"], "representant": "—", "telephone": "—", "email": "—", "statut": "C"},
        {"societe": "LVO", "representant": params.get("representant_lvo", "—"), "telephone": "—", "email": "—", "statut": "P"},
    ]
    table = doc.add_table(rows=1, cols=5)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    _bordurer_table(table)
    entetes = ["Société", "Représentant", "Téléphone", "Email", "P/C"]
    for i, libelle in enumerate(entetes):
        cell = table.rows[0].cells[i]
        _ombrer_cellule(cell, _FOND_ENTETE)
        _texte_cellule(cell, libelle, gras=True, couleur=RGBColor(0xFF, 0xFF, 0xFF))
    for itv in intervenants:
        row = table.add_row()
        valeurs = [itv.get("societe", ""), itv.get("representant", ""), itv.get("telephone", ""), itv.get("email", ""), itv.get("statut", "")]
        for i, val in enumerate(valeurs):
            _texte_cellule(row.cells[i], str(val))

    note = doc.add_paragraph()
    run = note.add_run("P = Présent / C = Convoqué — par défaut, le compte-rendu est adressé à tous les intervenants ci-dessus.")
    run.italic = True
    run.font.size = Pt(8)
    run.font.color.rgb = GRIS
    doc.add_paragraph()


def _ajouter_bloc_operation(doc: Document, contexte: dict[str, Any], params: dict[str, Any]) -> None:
    p = doc.add_paragraph()
    p.add_run("Adresse opération\n").bold = True
    p.add_run(f"{contexte['client']}\n")
    p.add_run(f"{params.get('adresse_site', '')}")

    p2 = doc.add_paragraph()
    p2.add_run("Prochaine réunion : ").bold = True
    p2.add_run(params.get("prochaine_reunion", "date à définir"))
    doc.add_paragraph()

    disclaimer = doc.add_paragraph()
    run = disclaimer.add_run(
        "Si le présent compte-rendu ne fait l'objet d'aucune remarque sous sept jours, il sera considéré "
        "comme définitivement approuvé. Toute observation éventuelle doit être communiquée par écrit au maître d'œuvre."
    )
    run.italic = True
    run.font.size = Pt(8)
    run.font.color.rgb = GRIS
    doc.add_paragraph()


def _ajouter_section_action(
    doc: Document,
    numero: int,
    titre: str,
    paragraphes: list[str],
    responsable: str,
    delai: str,
    *,
    alerte: bool = False,
) -> None:
    table = doc.add_table(rows=1, cols=3)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    _bordurer_table(table)
    table.columns[0].width = Inches(4.6)
    table.columns[1].width = Inches(1.1)
    table.columns[2].width = Inches(1.0)

    cell_titre, cell_resp, cell_delai = table.rows[0].cells
    _ombrer_cellule(cell_titre, _FOND_ALERTE if alerte else _FOND_GRIS)
    cell_titre.text = ""
    p_titre = cell_titre.paragraphs[0]
    run_titre = p_titre.add_run(f"{numero}. {titre}")
    run_titre.bold = True
    run_titre.font.size = Pt(10)
    run_titre.font.color.rgb = ROUGE if alerte else NAVY
    for ligne in paragraphes:
        p = cell_titre.add_paragraph()
        run = p.add_run(ligne)
        run.font.size = Pt(9)

    _ombrer_cellule(cell_resp, _FOND_GRIS)
    _texte_cellule(cell_resp, responsable, gras=True, taille=9)
    _ombrer_cellule(cell_delai, _FOND_GRIS)
    _texte_cellule(cell_delai, delai, gras=True, taille=9)
    doc.add_paragraph()


def _fmt_euro(montant: float) -> str:
    """Format français : espace en séparateur de milliers, virgule décimale (ex. 3 350,00 €)."""
    s = f"{montant:,.2f}".replace(",", " ").replace(".", ",")
    return f"{s} €"


def _phrase_penalite(montant: float, motif: str) -> str:
    if montant <= 0:
        return f"Aucune pénalité retenue sur la période ({motif})."
    return f"Le montant de pénalité s'élève à {_fmt_euro(montant)} ({motif})."


def construire_contexte(resultats: dict[str, Any], params: dict[str, Any]) -> dict[str, Any]:
    """Calcule toutes les valeurs nécessaires au compte-rendu à partir des résultats d'analyse."""
    interventions = resultats.get("interventions", pd.DataFrame())
    maintenance = resultats.get("maintenance", pd.DataFrame())
    suivi = resultats.get("suivi_tests", pd.DataFrame())
    synthese = resultats.get("synthese_appareils", pd.DataFrame())
    pen = resultats.get("penalites", {})
    detail = pen.get("detail", {})
    desinc = resultats.get("desincarceration", pd.DataFrame())
    parc_orphelins = resultats.get("parc_orphelins", pd.DataFrame())

    nb_appareils = len(synthese) if not synthese.empty else 0
    liste_parc = []
    if not synthese.empty:
        liste_parc = [
            f"{r.get('ascenseur', '')} ({r.get('client', '')} — {r.get('adresse', '')})" for _, r in synthese.iterrows()
        ]

    tranches = (
        interventions["tranche_delai"].value_counts().to_dict()
        if not interventions.empty and "tranche_delai" in interventions.columns
        else {}
    )

    app_exces = 0
    if not synthese.empty and "nb_pannes_retenues" in synthese.columns:
        from core.calculs import seuil_prorata_trimestre

        seuil = seuil_prorata_trimestre(
            float(params.get("seuil_pannes_an", cfg.SEUIL_PANNES_PAR_AN_APPAREIL)),
            str(params.get("trimestre", "T1")),
        )
        app_exces = int((synthese["nb_pannes_retenues"] > seuil).sum())

    sans_para = int(suivi["parachute_manquant"].sum()) if not suivi.empty and "parachute_manquant" in suivi.columns else 0
    sans_cables = int(suivi["cables_manquant"].sum()) if not suivi.empty and "cables_manquant" in suivi.columns else 0
    nb_parachute = int(suivi["nb_parachute"].sum()) if not suivi.empty and "nb_parachute" in suivi.columns else 0
    nb_cables = int(suivi["nb_cables"].sum()) if not suivi.empty and "nb_cables" in suivi.columns else 0

    nb_ecarts = int(maintenance["ecart_signale"].sum()) if not maintenance.empty and "ecart_signale" in maintenance.columns else 0

    nb_inter = len(interventions)
    nb_pannes_retenues = int(interventions["panne_retenue"].sum()) if not interventions.empty and "panne_retenue" in interventions.columns else 0
    nb_hors_delai = int(tranches.get("2 à 4h", 0)) + int(tranches.get("> 4h", 0))
    nb_dans_delai = int(tranches.get("< 1h", 0)) + int(tranches.get("1 à 2h", 0))
    nb_plus_4h = int(tranches.get("> 4h", 0))

    nb_desinc = len(desinc)
    nb_hors_delai_desinc = int(desinc["hors_delai_45min"].sum()) if not desinc.empty and "hors_delai_45min" in desinc.columns else 0

    return {
        "prestataire": params.get("prestataire", "—"),
        "trimestre": params.get("trimestre", "T1"),
        "annee": params.get("annee", date.today().year),
        "date_cr": params.get("date_cr", date.today().strftime("%d/%m/%Y")),
        "client": params.get("filtre_client") or params.get("hypotheses_client") or params.get("client_site", "—"),
        "nb_appareils": nb_appareils,
        "liste_parc": liste_parc,
        "nb_visites_maintenance": len(maintenance),
        "seuil_maintenance": params.get("seuil_maintenance_jours", cfg.SEUIL_ECART_MAINTENANCE_JOURS),
        "nb_ecarts_maintenance": nb_ecarts,
        "jours_retard_maintenance": detail.get("jours_retard_maintenance", 0),
        "penalite_maintenance": float(pen.get("penalite_maintenance", 0)),
        "tarif_jour": params.get("tarif_jour", cfg.TARIF_PENALITE_JOUR_MAINTENANCE),
        "nb_parachute": nb_parachute,
        "nb_cables": nb_cables,
        "appareils_sans_parachute": sans_para,
        "appareils_sans_cables": sans_cables,
        "seuil_parachute_mois": params.get("seuil_parachute_mois", cfg.SEUIL_PARACHUTE_MOIS),
        "seuil_cables_mois": params.get("seuil_cables_mois", cfg.SEUIL_CABLES_MOIS),
        "nb_interventions": nb_inter,
        "nb_pannes_retenues": nb_pannes_retenues,
        "appareils_exces_pannes": app_exces,
        "penalite_pannes": float(pen.get("penalite_pannes", 0)),
        "tarif_panne": params.get("tarif_panne", cfg.TARIF_PENALITE_PANNE),
        "seuil_pannes_an": params.get("seuil_pannes_an", cfg.SEUIL_PANNES_PAR_AN_APPAREIL),
        "seuil_immo_h": params.get("seuil_immo_h", cfg.SEUIL_IMMOBILISATION_HEURES_AN),
        "tarif_immo": params.get("tarif_heure_immo", cfg.TARIF_PENALITE_HEURE_IMMOBILISATION),
        "penalite_immobilisation": float(pen.get("penalite_immobilisation", 0)),
        "heures_immo_excedentaires": detail.get("heures_immo_excedentaires", 0),
        "delai_moins_1h": int(tranches.get("< 1h", 0)),
        "delai_1_2h": int(tranches.get("1 à 2h", 0)),
        "delai_2_4h": int(tranches.get("2 à 4h", 0)),
        "delai_plus_4h": nb_plus_4h,
        "nb_dans_delai": nb_dans_delai,
        "nb_hors_delai": nb_hors_delai,
        "seuil_delai_h": params.get("seuil_delai_h", cfg.SEUIL_DELAI_INTERVENTION_HEURES),
        "tarif_delai": params.get("tarif_heure_delai", cfg.TARIF_PENALITE_HEURE_DELAI),
        "penalite_delai": float(pen.get("penalite_delai_intervention", 0)),
        "heures_delai_excedentaires": detail.get("heures_delai_excedentaires", 0),
        "nb_desincarceration": nb_desinc,
        "nb_hors_delai_desinc": nb_hors_delai_desinc,
        "seuil_desinc": params.get("seuil_desincarc_min", cfg.SEUIL_DESINCARCERATION_MINUTES),
        "penalite_totale": float(pen.get("penalite_totale", 0)),
        "commentaire": params.get("commentaire", ""),
        "libelle_mode_pannes": detail.get("libelle_mode_pannes", ""),
        "libelle_mode_immobilisation": detail.get("libelle_mode_immobilisation", ""),
        "mention_pannes": detail.get("mention_pannes", ""),
        "appareils_a_arret": list(parc_orphelins.get("ascenseur", [])) if not parc_orphelins.empty and "ascenseur" in parc_orphelins.columns else [],
    }


# Conservé pour compatibilité (anciens appelants éventuels)
_contexte_word = construire_contexte


def _construire_document(contexte: dict[str, Any], params: dict[str, Any]) -> Document:
    doc = Document()
    style = doc.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(10)

    _ajouter_entete(doc, contexte)
    _ajouter_table_intervenants(doc, contexte, params)
    _ajouter_bloc_operation(doc, contexte, params)

    # 1. Rappel du parc
    n_app = contexte["nb_appareils"]
    rappel = [f"Le prestataire {contexte['prestataire']} assure la maintenance de {n_app} appareil(s) suivi(s) sur la période."]
    if contexte["liste_parc"]:
        apercu = contexte["liste_parc"][:10]
        rappel.append("• " + "\n• ".join(apercu))
        if len(contexte["liste_parc"]) > 10:
            rappel.append(f"… et {len(contexte['liste_parc']) - 10} autre(s) appareil(s).")
    _ajouter_section_action(doc, 1, "Rappel du parc", rappel, contexte["prestataire"], "Rappel")

    # 2. Visites d'entretien
    maint_alerte = contexte["penalite_maintenance"] > 0
    motif_maint = f"{contexte['tarif_jour']:.0f} €/jour × {contexte['jours_retard_maintenance']} j de retard cumulés"
    visites = [
        f"{contexte['nb_visites_maintenance']} visite(s) d'entretien enregistrée(s) — seuil contractuel : {contexte['seuil_maintenance']} jours entre deux visites.",
        f"{contexte['nb_ecarts_maintenance']} écart(s) constaté(s) au-delà du seuil.",
        _phrase_penalite(contexte["penalite_maintenance"], motif_maint),
    ]
    _ajouter_section_action(doc, 2, "Visites d'entretien", visites, contexte["prestataire"], "10 jours", alerte=maint_alerte)

    # 3. Tests parachute
    para_alerte = contexte["appareils_sans_parachute"] > 0
    parachute = [
        f"Contrôle du système parachute requis tous les {contexte['seuil_parachute_mois']} mois maximum.",
        f"{contexte['nb_parachute']} test(s) déclaré(s) sur la période.",
        f"{contexte['appareils_sans_parachute']} appareil(s) sans test parachute sur la période." if para_alerte else "Tous les appareils suivis ont un test parachute à jour sur la période.",
    ]
    _ajouter_section_action(doc, 3, "Tests parachute", parachute, contexte["prestataire"], "5 jours", alerte=para_alerte)

    # 4. Vérification câbles / courroie
    cables_alerte = contexte["appareils_sans_cables"] > 0
    cables = [
        f"Contrôle des câbles de traction requis tous les {contexte['seuil_cables_mois']} mois maximum.",
        f"{contexte['nb_cables']} vérification(s) déclarée(s) sur la période.",
        f"{contexte['appareils_sans_cables']} appareil(s) sans contrôle câbles sur la période." if cables_alerte else "Tous les appareils suivis ont un contrôle câbles à jour sur la période.",
    ]
    _ajouter_section_action(doc, 4, "Vérification des câbles / courroie de traction", cables, contexte["prestataire"], "5 jours", alerte=cables_alerte)

    # 5. Fonctionnement - taux de pannes
    pannes_alerte = contexte["penalite_pannes"] > 0
    motif_pannes = f"{contexte['tarif_panne']:.0f} €/panne excédentaire — seuil {contexte['seuil_pannes_an']}/an/appareil"
    pannes = [
        f"Seuil contractuel : {contexte['seuil_pannes_an']} pannes maximum/an/appareil, {contexte['seuil_immo_h']} h maximum d'immobilisation/an.",
        f"{contexte['nb_interventions']} intervention(s)/demande(s) sur la période, dont {contexte['nb_pannes_retenues']} panne(s) retenue(s).",
        contexte["mention_pannes"] or f"{contexte['appareils_exces_pannes']} appareil(s) au-dessus des objectifs.",
        _phrase_penalite(contexte["penalite_pannes"], motif_pannes),
    ]
    _ajouter_section_action(doc, 5, "Fonctionnement — Taux de pannes", pannes, contexte["prestataire"], "15 jours", alerte=pannes_alerte)

    # 6. Causes
    causes = [
        contexte["commentaire"] or "L'entreprise doit proposer un plan d'action pour remédier aux pannes techniques constatées.",
    ]
    _ajouter_section_action(doc, 6, "Causes", causes, contexte["prestataire"], "15 jours")

    # 7. Délais d'intervention
    delai_alerte = contexte["penalite_delai"] > 0
    motif_delai = f"{contexte['tarif_delai']:.0f} €/h au-delà de {contexte['seuil_delai_h']:.0f} h"
    delais = [
        f"Délai d'intervention contractuel : {contexte['seuil_delai_h']:.0f} h.",
        f"{contexte['nb_dans_delai']} demande(s) traitée(s) dans le délai contractuel, {contexte['nb_hors_delai']} hors délai dont {contexte['delai_plus_4h']} à plus de 4 h.",
        _phrase_penalite(contexte["penalite_delai"], motif_delai),
        f"Désincarcération : {contexte['nb_desincarceration']} intervention(s) avec personne bloquée, {contexte['nb_hors_delai_desinc']} hors délai contractuel ({contexte['seuil_desinc']} min).",
    ]
    _ajouter_section_action(doc, 7, "Délais d'intervention", delais, contexte["prestataire"], "1 semaine", alerte=delai_alerte)

    # 8. Levée des réserves
    _ajouter_section_action(
        doc, 8, "Levée des réserves Bureau de Contrôle",
        ["L'entreprise doit transmettre son planning de levée des réserves du rapport périodique (délai contractuel : 60 jours)."],
        contexte["prestataire"], "1 semaine",
    )

    # 9. Offres et devis
    _ajouter_section_action(
        doc, 9, "Offres et devis",
        [
            "L'ensemble des offres doit parvenir pour validation.",
            "Chaque offre doit être justifiée : constat détaillé, diagnostic et analyse.",
            "Offre détaillée : main d'œuvre, matériel, postes ; délais d'approvisionnement et d'exécution à communiquer.",
        ],
        contexte["prestataire"], "Rappel",
    )

    # 10. Ascenseurs à l'arrêt
    arret = contexte["appareils_a_arret"]
    arret_alerte = len(arret) > 0
    texte_arret = ["Aucun appareil du parc sans activité sur la période."] if not arret_alerte else [
        f"{len(arret)} appareil(s) du parc sans activité enregistrée :",
        "• " + ", ".join(str(a) for a in arret[:20]),
    ]
    _ajouter_section_action(doc, 10, "Ascenseurs à l'arrêt", texte_arret, contexte["prestataire"], "Rappel", alerte=arret_alerte)

    # 11. Divers
    _ajouter_section_action(
        doc, 11, "Divers",
        [contexte["commentaire"] or "Aucune remarque complémentaire sur la période."],
        contexte["prestataire"], "Rappel",
    )

    # 12. Synthèse
    doc.add_paragraph()
    titre_synth = doc.add_paragraph()
    run = titre_synth.add_run("12. SYNTHÈSE")
    run.bold = True
    run.font.size = Pt(12)
    run.font.color.rgb = NAVY

    table_synth = doc.add_table(rows=5, cols=2)
    table_synth.alignment = WD_TABLE_ALIGNMENT.CENTER
    _bordurer_table(table_synth)
    lignes_synth = [
        ("Pénalité maintenance", contexte["penalite_maintenance"]),
        ("Pénalité pannes", contexte["penalite_pannes"]),
        ("Pénalité immobilisation", contexte["penalite_immobilisation"]),
        ("Pénalité délai d'intervention", contexte["penalite_delai"]),
        ("TOTAL", contexte["penalite_totale"]),
    ]
    couleurs_postes = {
        "Pénalité maintenance": "1F3A5F",
        "Pénalité pannes": "E67E22",
        "Pénalité immobilisation": "27AE60",
        "Pénalité délai d'intervention": "C0392B",
    }
    for i, (libelle, montant) in enumerate(lignes_synth):
        cell_lib, cell_montant = table_synth.rows[i].cells
        if libelle == "TOTAL":
            _ombrer_cellule(cell_lib, "2C3E50")
            _ombrer_cellule(cell_montant, _FOND_GRIS)
            _texte_cellule(cell_lib, libelle, gras=True, couleur=RGBColor(0xFF, 0xFF, 0xFF), taille=11)
            _texte_cellule(cell_montant, f"{montant:,.2f} €", gras=True, taille=11)
        else:
            _ombrer_cellule(cell_lib, couleurs_postes[libelle])
            _ombrer_cellule(cell_montant, _FOND_ALERTE if montant > 0 else _FOND_OK)
            _texte_cellule(cell_lib, libelle, gras=True, couleur=RGBColor(0xFF, 0xFF, 0xFF))
            _texte_cellule(cell_montant, f"{montant:,.2f} €")

    doc.add_paragraph()
    conclusion = doc.add_paragraph()
    texte_conclusion = (
        f"Le respect des clauses du marché doit être assuré par {contexte['prestataire']}. "
        f"Le cumul des pénalités constatées s'élève à {contexte['penalite_totale']:,.2f} € pour {contexte['trimestre']} {contexte['annee']}. "
        "L'entreprise doit communiquer son plan d'action pour se conformer au marché et aux attentes du maître d'ouvrage. "
        "L'ensemble des indicateurs doit parvenir au plus tard 10 jours avant chaque rendez-vous trimestriel, "
        "accompagné d'un reporting mensuel."
        if contexte["penalite_totale"] > 0
        else
        f"Aucune pénalité n'est retenue à l'encontre de {contexte['prestataire']} pour {contexte['trimestre']} {contexte['annee']}. "
        "L'entreprise doit poursuivre la fourniture des indicateurs trimestriels et du reporting mensuel."
    )
    run_concl = conclusion.add_run(texte_conclusion)
    run_concl.font.size = Pt(9)

    doc.add_paragraph()
    signature = doc.add_paragraph()
    signature.add_run(params.get("representant_lvo", "LVO-Ingénierie")).bold = True

    _ajouter_pied_de_page(doc, contexte)
    return doc


def _enrichir_document_logo_et_graphiques(
    docx_bytes: bytes,
    figure_paths: Optional[dict[str, str]] = None,
) -> bytes:
    """Ajoute le logo LVO en en-tête de page et les figures en fin de document.

    Conservé pour core/export_gher_consolide.py (rapport comparatif multi-prestataires).
    """
    buffer_in = io.BytesIO(docx_bytes)
    doc = Document(buffer_in)

    logo = _assurer_logo_couleur()
    if logo and logo.is_file() and doc.sections:
        header = doc.sections[0].header
        p = header.paragraphs[0] if header.paragraphs else header.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.add_run().add_picture(str(logo), width=Cm(4.5))

    _ajouter_graphiques(doc, figure_paths)

    out = io.BytesIO()
    doc.save(out)
    out.seek(0)
    return out.getvalue()


def _ajouter_graphiques(doc: Document, figure_paths: Optional[dict[str, str]]) -> None:
    if not figure_paths:
        return
    doc.add_page_break()
    titre = doc.add_paragraph()
    run = titre.add_run("Graphiques")
    run.bold = True
    run.font.size = Pt(13)
    run.font.color.rgb = NAVY
    for cle, chemin in figure_paths.items():
        p = Path(chemin)
        if not p.is_file():
            continue
        doc.add_paragraph(cle.replace("_", " ").title())
        try:
            doc.add_picture(str(p), width=Inches(6.0))
        except Exception:
            continue


def generer_compte_rendu(
    resultats: dict[str, Any],
    params: dict[str, Any],
    figure_paths: Optional[dict[str, str]] = None,
) -> bytes:
    """Génère le .docx en mémoire — format compte-rendu de chantier (intervenants, sections, synthèse, signature)."""
    contexte = construire_contexte(resultats, params)
    doc = _construire_document(contexte, params)
    _ajouter_graphiques(doc, figure_paths)

    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()


def nom_fichier_cr(params: dict[str, Any], version: int = 1) -> str:
    """Convention LVO_<CLIENT>_<PRESTATAIRE>_CR_T<n>_<année>_v<version>.docx"""
    client = str(
        params.get("filtre_client")
        or params.get("hypotheses_client")
        or params.get("client_site")
        or "CLIENT"
    ).replace(" ", "_")
    if client.upper() == "TOUS":
        client = str(params.get("client_site", "CLIENT")).replace(" ", "_")
    prest = str(params.get("prestataire", "PRESTATAIRE")).replace(" ", "_")
    trimestre = str(params.get("trimestre", "T1"))
    annee = int(params.get("annee", date.today().year))
    return f"LVO_{client}_{prest}_CR_{trimestre}_{annee}_v{version}.docx"
