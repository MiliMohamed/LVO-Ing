# -*- coding: utf-8 -*-
"""
API HTTP FastAPI — appelée par le CRM Next.js (upload → analyse → livrables).
Lancement : uvicorn api_server:app --host 127.0.0.1 --port 8765
"""

from __future__ import annotations

import base64
import json
import sys
import os
from pathlib import Path
import math
from datetime import date, datetime, time
import logging
import time as time_mod
import traceback
from uuid import uuid4
import pandas as pd

from fastapi import Body, FastAPI, File, Form, HTTPException, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from config import parametres as cfg
from config.hypotheses_marche import enregistrer_hypotheses
from core.batch import executer_lot, iter_lot_events
from core.service import (
    analyser_parc,
    detecter_fichier_metadata,
    executer_analyse,
    liste_hypotheses_marche,
    params_par_defaut,
)

LOG_LEVEL = os.getenv("MMS_LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("mms.api")


def _json_safe(value):
    """Convertit les valeurs pandas/NumPy non JSON-compatibles (NaT, NaN, scalaires)."""
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(v) for v in value]
    if isinstance(value, float) and math.isnan(value):
        return None
    if value is None or isinstance(value, (str, int, bool)):
        return value
    if isinstance(value, (date, datetime, time)):
        return value.isoformat()
    try:
        # pd.NaT / np.nan / valeurs manquantes pandas
        if pd.isna(value):
            return None
    except Exception:
        pass
    try:
        # scalaires NumPy -> types Python natifs
        if hasattr(value, "item"):
            return value.item()
    except Exception:
        pass
    return value

app = FastAPI(title="LVO MMS Analyzer API", version="1.0.0", redirect_slashes=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _safe_params(params: dict) -> dict:
    """Logs lisibles: masque base64 et tronque les valeurs trop longues."""
    out: dict = {}
    for k, v in params.items():
        if isinstance(v, str) and len(v) > 300:
            out[k] = f"{v[:300]}...<truncated:{len(v)}>"
        elif "base64" in k.lower():
            out[k] = "<masked>"
        else:
            out[k] = v
    return out


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    req_id = uuid4().hex[:8]
    start = time_mod.perf_counter()
    logger.info("[%s] -> %s %s", req_id, request.method, request.url.path)
    try:
        response = await call_next(request)
        elapsed = (time_mod.perf_counter() - start) * 1000
        logger.info(
            "[%s] <- %s %s status=%s elapsed=%.1fms",
            req_id,
            request.method,
            request.url.path,
            response.status_code,
            elapsed,
        )
        response.headers["X-Request-ID"] = req_id
        return response
    except Exception as exc:
        elapsed = (time_mod.perf_counter() - start) * 1000
        logger.error(
            "[%s] !! %s %s elapsed=%.1fms error=%s\n%s",
            req_id,
            request.method,
            request.url.path,
            elapsed,
            exc,
            traceback.format_exc(),
        )
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal Server Error", "request_id": req_id},
            headers={"X-Request-ID": req_id},
        )


@app.get("/health")
def health():
    return {"status": "ok", "service": "mms-analyzer"}


@app.get("/defaults")
def defaults():
    """Paramètres par défaut pour pré-remplir le formulaire CRM."""
    return params_par_defaut()


@app.get("/hypotheses-marche")
def get_hypotheses_marche():
    """Hypothèses marché par client (seuils, tarifs, commentaires)."""
    return liste_hypotheses_marche()


@app.put("/hypotheses-marche")
async def put_hypotheses_marche(body: dict = Body(...)):
    """Enregistre les hypothèses (fichier config/hypotheses_marche.json)."""
    if not isinstance(body, dict):
        raise HTTPException(400, "Corps JSON attendu : { CLIENT: { ... } }")
    try:
        enregistrer_hypotheses(body)
    except OSError as exc:
        raise HTTPException(500, f"Impossible d'enregistrer : {exc}") from exc
    return {"ok": True, "hypotheses": liste_hypotheses_marche()}


@app.post("/analyze")
async def analyze(
    fichier_brut: UploadFile = File(..., description="Données brutes prestataire (.xlsx)"),
    fichier_parc: UploadFile | None = File(None, description="Liste du parc (optionnel)"),
    fichier_dernieres_visites: UploadFile | None = File(
        None,
        description="Dernière visite maintenance T-1 par appareil (optionnel)",
    ),
    fichier_cumul_pannes: UploadFile | None = File(
        None,
        description="Cumul pannes T1–T3 pour bilan annuel T4 (optionnel)",
    ),
    params_json: str = Form("{}"),
):
    """
    Analyse le fichier brut et renvoie les livrables (base64) + indicateurs.
    """
    if not fichier_brut.filename:
        raise HTTPException(400, "Fichier brut manquant")

    try:
        params = json.loads(params_json) if params_json.strip() else {}
    except json.JSONDecodeError as exc:
        raise HTTPException(400, f"params_json invalide : {exc}") from exc

    logger.info(
        "analyze payload fichier_brut=%s fichier_parc=%s fichier_dernieres_visites=%s fichier_cumul_pannes=%s params=%s",
        fichier_brut.filename,
        fichier_parc.filename if fichier_parc else None,
        fichier_dernieres_visites.filename if fichier_dernieres_visites else None,
        fichier_cumul_pannes.filename if fichier_cumul_pannes else None,
        _safe_params(params),
    )

    contenu_brut = await fichier_brut.read()
    contenu_parc = None
    if fichier_parc and fichier_parc.filename:
        lu = await fichier_parc.read()
        if lu and len(lu) >= 64:
            contenu_parc = lu

    contenu_dernieres_visites = None
    if fichier_dernieres_visites and fichier_dernieres_visites.filename:
        lu = await fichier_dernieres_visites.read()
        if lu and len(lu) >= 32:
            contenu_dernieres_visites = lu

    contenu_cumul_pannes = None
    if fichier_cumul_pannes and fichier_cumul_pannes.filename:
        lu = await fichier_cumul_pannes.read()
        if lu and len(lu) >= 32:
            contenu_cumul_pannes = lu

    try:
        result = executer_analyse(
            contenu_brut,
            contenu_parc,
            params,
            nom_fichier_brut=fichier_brut.filename,
            nom_fichier_parc=fichier_parc.filename if fichier_parc else None,
            contenu_dernieres_visites=contenu_dernieres_visites,
            nom_fichier_dernieres_visites=(
                fichier_dernieres_visites.filename if fichier_dernieres_visites else None
            ),
            contenu_cumul_pannes=contenu_cumul_pannes,
            nom_fichier_cumul_pannes=(
                fichier_cumul_pannes.filename if fichier_cumul_pannes else None
            ),
        )
    except Exception as exc:
        logger.error("analyze failed fichier_brut=%s error=%s\n%s", fichier_brut.filename, exc, traceback.format_exc())
        raise HTTPException(422, f"Erreur d'analyse : {exc}") from exc

    logger.info(
        "analyze ok fichier_brut=%s client=%s prestataire=%s penalite_totale=%s",
        fichier_brut.filename,
        result.get("detection_auto", {}).get("client"),
        result.get("detection_auto", {}).get("prestataire"),
        result.get("penalites", {}).get("penalite_totale"),
    )
    return _serialiser_resultat(result)


def _serialiser_resultat(result: dict) -> dict:
    fichiers = result.pop("fichiers")
    figures_paths = result.pop("figures_paths", {})
    fichiers_out = {
        "excel_nom": fichiers["excel_nom"],
        "word_nom": fichiers["word_nom"],
        "excel_base64": base64.b64encode(fichiers["excel"]).decode("ascii"),
        "word_base64": base64.b64encode(fichiers["word"]).decode("ascii"),
    }
    if fichiers.get("pdf"):
        fichiers_out["pdf_nom"] = fichiers.get("pdf_nom", fichiers["word_nom"].replace(".docx", ".pdf"))
        fichiers_out["pdf_base64"] = base64.b64encode(fichiers["pdf"]).decode("ascii")
    if fichiers.get("pdf_erreur"):
        fichiers_out["pdf_erreur"] = fichiers["pdf_erreur"]
    return _json_safe({
        **result,
        "fichiers": fichiers_out,
        "figures_paths": figures_paths,
        "avertissement": (
            "Seuils annuels par défaut : immobilisation et pannes en indicateur au T1–T3. "
            "Saisissez la dernière maintenance N-1 pour évaluer le Δ de la 1re visite."
        ),
    })


def _serialiser_rapport_lot(r: dict) -> dict:
    """Rapport individuel dans un lot (sans muter le result interne)."""
    result = r["result"]
    fichiers = result["fichiers"]
    out = {
        "client": r["client"],
        "prestataire": r["prestataire"],
        "penalite_totale": result.get("penalites", {}).get("penalite_totale", 0),
        "fichiers": {
            "excel_nom": fichiers["excel_nom"],
            "word_nom": fichiers["word_nom"],
            "excel_base64": base64.b64encode(fichiers["excel"]).decode("ascii"),
            "word_base64": base64.b64encode(fichiers["word"]).decode("ascii"),
        },
    }
    if fichiers.get("pdf"):
        out["fichiers"]["pdf_nom"] = fichiers.get("pdf_nom", "rapport.pdf")
        out["fichiers"]["pdf_base64"] = base64.b64encode(fichiers["pdf"]).decode("ascii")
    return out


@app.post("/detect-metadata")
async def detect_metadata(
    fichier_brut: UploadFile = File(...),
    fichier_parc: UploadFile | None = File(None),
    params_json: str = Form("{}"),
):
    """Détecte client, prestataire et trimestre sans lancer l'analyse complète."""
    try:
        params = json.loads(params_json) if params_json.strip() else {}
    except json.JSONDecodeError as exc:
        raise HTTPException(400, f"params_json invalide : {exc}") from exc
    logger.info(
        "detect-metadata payload fichier_brut=%s fichier_parc=%s params=%s",
        fichier_brut.filename,
        fichier_parc.filename if fichier_parc else None,
        _safe_params(params),
    )

    contenu = await fichier_brut.read()
    contenu_parc = None
    if fichier_parc and fichier_parc.filename:
        lu = await fichier_parc.read()
        if lu and len(lu) >= 64:
            contenu_parc = lu

    try:
        out = detecter_fichier_metadata(
            contenu,
            fichier_brut.filename,
            contenu_parc,
            fichier_parc.filename if fichier_parc else None,
            params,
        )
        logger.info(
            "detect-metadata ok fichier_brut=%s client=%s prestataire=%s format=%s",
            fichier_brut.filename,
            out.get("client"),
            out.get("prestataire"),
            out.get("format_source"),
        )
        return out
    except Exception as exc:
        logger.error("detect-metadata failed fichier_brut=%s error=%s\n%s", fichier_brut.filename, exc, traceback.format_exc())
        raise HTTPException(422, str(exc)) from exc


@app.post("/parc/couples")
async def parc_couples(fichier_parc: UploadFile = File(...)):
    """Extrait les couples client × prestataire du fichier parc."""
    contenu = await fichier_parc.read()
    if len(contenu) < 64:
        raise HTTPException(400, "Fichier parc trop petit")
    try:
        return analyser_parc(contenu, fichier_parc.filename)
    except Exception as exc:
        raise HTTPException(422, str(exc)) from exc


@app.post("/analyze-batch")
async def analyze_batch(
    fichiers_bruts: list[UploadFile] = File(..., description="Un ou plusieurs fichiers prestataires"),
    fichier_parc: UploadFile | None = File(None),
    params_json: str = Form("{}"),
):
    """Traite tous les fichiers fournis et retourne journal + synthèse consolidée."""
    try:
        params = json.loads(params_json) if params_json.strip() else {}
    except json.JSONDecodeError as exc:
        raise HTTPException(400, f"params_json invalide : {exc}") from exc
    logger.info(
        "analyze-batch payload nb_fichiers=%s fichier_parc=%s params=%s",
        len(fichiers_bruts),
        fichier_parc.filename if fichier_parc else None,
        _safe_params(params),
    )

    contenu_parc = None
    nom_parc = None
    if fichier_parc and fichier_parc.filename:
        lu = await fichier_parc.read()
        if lu and len(lu) >= 64:
            contenu_parc = lu
            nom_parc = fichier_parc.filename

    fichiers: list[tuple[str, bytes]] = []
    for f in fichiers_bruts:
        if f.filename:
            data = await f.read()
            fichiers.append((f.filename, data))

    try:
        lot = executer_lot(fichiers, contenu_parc, params, nom_fichier_parc=nom_parc)
    except Exception as exc:
        logger.error("analyze-batch failed error=%s\n%s", exc, traceback.format_exc())
        raise HTTPException(422, str(exc)) from exc

    rapports_serialises = [_serialiser_rapport_lot(item) for item in lot.get("rapports", [])]
    logger.info(
        "analyze-batch ok nb_ok=%s nb_erreur=%s nb_skipped=%s",
        lot.get("nb_ok", 0),
        lot.get("nb_erreur", 0),
        lot.get("nb_skipped", 0),
    )

    return {
        "ok": True,
        "journal": lot.get("journal", []),
        "consolide": lot.get("consolide", []),
        "couples_parc": lot.get("couples_parc", []),
        "nb_ok": lot.get("nb_ok", 0),
        "nb_erreur": lot.get("nb_erreur", 0),
        "nb_skipped": lot.get("nb_skipped", 0),
        "rapports": rapports_serialises,
        "gher_consolide": lot.get("gher_consolide"),
    }


@app.post("/analyze-batch-stream")
async def analyze_batch_stream(
    fichiers_bruts: list[UploadFile] = File(...),
    fichier_parc: UploadFile | None = File(None),
    params_json: str = Form("{}"),
):
    """Traitement par lot avec progression (flux NDJSON ligne par ligne)."""
    try:
        params = json.loads(params_json) if params_json.strip() else {}
    except json.JSONDecodeError as exc:
        raise HTTPException(400, f"params_json invalide : {exc}") from exc
    logger.info(
        "analyze-batch-stream payload nb_fichiers=%s fichier_parc=%s params=%s",
        len(fichiers_bruts),
        fichier_parc.filename if fichier_parc else None,
        _safe_params(params),
    )

    contenu_parc = None
    nom_parc = None
    if fichier_parc and fichier_parc.filename:
        lu = await fichier_parc.read()
        if lu and len(lu) >= 64:
            contenu_parc = lu
            nom_parc = fichier_parc.filename

    fichiers: list[tuple[str, bytes]] = []
    for f in fichiers_bruts:
        if f.filename:
            fichiers.append((f.filename, await f.read()))

    def generate():
        journal: list = []
        rapports: list = []
        consolidé: list = []
        payload: dict = {}

        for event in iter_lot_events(fichiers, contenu_parc, params, nom_parc):
            t = event.get("type")
            if t == "journal_entry":
                journal.append(event["entry"])
                logger.info("analyze-batch-stream event journal_entry entry=%s", event.get("entry"))
                yield json.dumps(event, ensure_ascii=False) + "\n"
                continue
            if t == "rapport":
                ser = _serialiser_rapport_lot(event["rapport"])
                rapports.append(ser)
                consolidé.append(event["consolide_ligne"])
                logger.info(
                    "analyze-batch-stream event rapport client=%s prestataire=%s penalite=%s",
                    ser.get("client"),
                    ser.get("prestataire"),
                    ser.get("penalite_totale"),
                )
                yield json.dumps(
                    {"type": "rapport", "rapport": ser, "consolide_ligne": event["consolide_ligne"]},
                    ensure_ascii=False,
                ) + "\n"
                continue
            if t == "complete":
                payload = event.get("payload", {})
                consolidé = event.get("consolide", consolidé)
                logger.info("analyze-batch-stream event complete payload_keys=%s", list(payload.keys()))
                yield json.dumps(
                    {"type": "complete", "payload": {"couples_parc": payload.get("couples_parc", [])}},
                    ensure_ascii=False,
                ) + "\n"
                continue
            yield json.dumps(event, ensure_ascii=False) + "\n"

        final = {
            "type": "result",
            "ok": True,
            "journal": journal,
            "rapports": rapports,
            "consolide": consolidé,
            "couples_parc": payload.get("couples_parc", []),
            "nb_ok": sum(1 for j in journal if j.get("statut") == "ok"),
            "nb_erreur": sum(1 for j in journal if j.get("statut") == "erreur"),
            "nb_skipped": sum(1 for j in journal if j.get("statut") == "skipped"),
            "gher_consolide": payload.get("gher_consolide"),
        }
        logger.info(
            "analyze-batch-stream result nb_ok=%s nb_erreur=%s nb_skipped=%s",
            final["nb_ok"],
            final["nb_erreur"],
            final["nb_skipped"],
        )
        yield json.dumps(final, ensure_ascii=False, default=str) + "\n"

    return StreamingResponse(generate(), media_type="application/x-ndjson")
