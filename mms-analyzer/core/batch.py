# -*- coding: utf-8 -*-
"""Traitement par lot : tous les couples client × prestataire."""

from __future__ import annotations

import base64
import logging
from typing import Any, Generator, Optional

import pandas as pd

from core.export_gher_consolide import generer_cr_gher_consolide, nom_fichier_gher_consolide
from core.export_pdf import convertir_docx_en_pdf
from core.parc import couples_client_prestataire
from core.service import executer_analyse, fusionner_params

logger = logging.getLogger(__name__)


def _fichier_correspond_couple(nom: str, client: str, prestataire: str) -> bool:
    n = nom.upper()
    return client.upper() in n and prestataire.upper() in n


def executer_lot(
    fichiers_bruts: list[tuple[str, bytes]],
    contenu_parc: Optional[bytes],
    params_base: Optional[dict[str, Any]] = None,
    nom_fichier_parc: Optional[str] = None,
    generer_consolide_gher: bool = True,
) -> dict[str, Any]:
    """Analyse plusieurs fichiers — résultat complet."""
    journal: list[dict[str, Any]] = []
    rapports: list[dict[str, Any]] = []
    consolidé: list[dict[str, Any]] = []
    payload_final: dict[str, Any] = {}

    for event in iter_lot_events(
        fichiers_bruts,
        contenu_parc,
        params_base,
        nom_fichier_parc,
        generer_consolide_gher=generer_consolide_gher,
    ):
        t = event.get("type")
        if t == "journal_entry":
            journal.append(event["entry"])
        elif t == "rapport":
            rapports.append(event["rapport"])
            consolidé.append(event["consolide_ligne"])
        elif t == "complete":
            payload_final = event.get("payload", {})

    return {
        "ok": True,
        "journal": journal,
        "rapports": rapports,
        "consolide": consolidé,
        "couples_parc": payload_final.get("couples_parc", []),
        "nb_ok": sum(1 for j in journal if j.get("statut") == "ok"),
        "nb_erreur": sum(1 for j in journal if j.get("statut") == "erreur"),
        "nb_skipped": sum(1 for j in journal if j.get("statut") == "skipped"),
        "gher_consolide": payload_final.get("gher_consolide"),
    }


def iter_lot_events(
    fichiers_bruts: list[tuple[str, bytes]],
    contenu_parc: Optional[bytes],
    params_base: Optional[dict[str, Any]] = None,
    nom_fichier_parc: Optional[str] = None,
    generer_consolide_gher: bool = True,
) -> Generator[dict[str, Any], None, None]:
    """Événements NDJSON : start, progress, journal_entry, rapport, complete."""
    from core import parser
    from core.prestataire_detect import detecter_depuis_nom_fichier

    params_base = fusionner_params(params_base or {})
    parc = pd.DataFrame()
    if contenu_parc and len(contenu_parc) >= 64:
        parc = parser.charger_liste_parc(contenu_parc, nom_fichier_parc)

    couples_parc = couples_client_prestataire(parc) if not parc.empty else []
    total = len(fichiers_bruts)
    consolidé: list[dict[str, Any]] = []

    yield {"type": "start", "total": total, "couples_parc": couples_parc}

    for index, (nom, contenu) in enumerate(fichiers_bruts, start=1):
        yield {"type": "progress", "index": index, "total": total, "fichier": nom, "statut": "running"}

        if not contenu or len(contenu) < 64:
            entry = {"fichier": nom, "statut": "erreur", "message": "Fichier vide"}
            yield {"type": "journal_entry", "entry": entry}
            yield {"type": "progress", "index": index, "total": total, "fichier": nom, "statut": "erreur"}
            continue

        meta = detecter_depuis_nom_fichier(nom)
        params = dict(params_base)
        if meta.get("prestataire"):
            params.setdefault("prestataire", meta["prestataire"])
        if meta.get("trimestre"):
            params.setdefault("trimestre", meta["trimestre"])
        if meta.get("annee"):
            params.setdefault("annee", int(meta["annee"]))
        if meta.get("client"):
            params.setdefault("filtre_client", meta["client"])
            params.setdefault("hypotheses_client", meta["client"])

        try:
            result = executer_analyse(
                contenu,
                contenu_parc,
                params,
                nom_fichier_brut=nom,
                nom_fichier_parc=nom_fichier_parc,
            )
            pen = result.get("penalites", {})
            client = str(params.get("filtre_client") or params.get("hypotheses_client") or "-")
            prest = str(params.get("prestataire", "-"))

            fichiers = result.get("fichiers", {})
            word_b = fichiers.get("word", b"")
            pdf_b, pdf_err = convertir_docx_en_pdf(word_b)
            if pdf_b:
                fichiers["pdf"] = pdf_b
                fichiers["pdf_nom"] = fichiers.get("word_nom", "rapport.docx").replace(".docx", ".pdf")

            entry = {
                "fichier": nom,
                "statut": "ok",
                "client": client,
                "prestataire": prest,
                "penalite_totale": pen.get("penalite_totale", 0),
                "pdf_disponible": pdf_b is not None,
                "pdf_erreur": pdf_err,
            }
            yield {"type": "journal_entry", "entry": entry}

            consolide_ligne = {
                "client": client,
                "prestataire": prest,
                "penalite_totale": pen.get("penalite_totale", 0),
                "penalite_maintenance": pen.get("penalite_maintenance", 0),
                "penalite_pannes": pen.get("penalite_pannes", 0),
                "penalite_immobilisation": pen.get("penalite_immobilisation", 0),
                "penalite_delai": pen.get("penalite_delai_intervention", 0),
            }
            consolidé.append(consolide_ligne)
            yield {
                "type": "rapport",
                "rapport": {"client": client, "prestataire": prest, "result": result},
                "consolide_ligne": consolide_ligne,
            }
            yield {
                "type": "progress",
                "index": index,
                "total": total,
                "fichier": nom,
                "statut": "ok",
                "client": client,
                "prestataire": prest,
                "penalite_totale": pen.get("penalite_totale", 0),
            }
        except Exception as exc:
            logger.exception("Échec analyse %s", nom)
            entry = {"fichier": nom, "statut": "erreur", "message": str(exc)}
            yield {"type": "journal_entry", "entry": entry}
            yield {
                "type": "progress",
                "index": index,
                "total": total,
                "fichier": nom,
                "statut": "erreur",
                "message": str(exc),
            }

    if couples_parc and fichiers_bruts:
        noms = [n for n, _ in fichiers_bruts]
        for couple in couples_parc:
            c, p = couple["client"], couple["prestataire"]
            if not any(_fichier_correspond_couple(n, c, p) for n in noms):
                entry = {
                    "fichier": f"(parc) {c} × {p}",
                    "statut": "skipped",
                    "message": "Aucun fichier prestataire correspondant",
                    "client": c,
                    "prestataire": p,
                }
                yield {"type": "journal_entry", "entry": entry}

    payload: dict[str, Any] = {"couples_parc": couples_parc}
    gher_rows = [r for r in consolidé if "GHER" in str(r.get("client", "")).upper()]
    if generer_consolide_gher and len(gher_rows) < 2 and len(consolidé) >= 2:
        gher_rows = consolidé
    if generer_consolide_gher and len(gher_rows) >= 2:
        try:
            docx = generer_cr_gher_consolide(gher_rows, params_base, couples_parc)
            pdf_b, pdf_err = convertir_docx_en_pdf(docx)
            payload["gher_consolide"] = {
                "word_nom": nom_fichier_gher_consolide(params_base),
                "word_base64": base64.b64encode(docx).decode("ascii"),
                "pdf_nom": nom_fichier_gher_consolide(params_base).replace(".docx", ".pdf"),
                "pdf_base64": base64.b64encode(pdf_b).decode("ascii") if pdf_b else None,
                "pdf_erreur": pdf_err,
                "lignes": gher_rows,
            }
        except Exception as exc:
            logger.exception("Rapport GHER consolidé")
            payload["gher_consolide_erreur"] = str(exc)

    yield {"type": "complete", "payload": payload, "consolide": consolidé}
