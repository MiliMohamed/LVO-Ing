# -*- coding: utf-8 -*-
"""Conversion DOCX → PDF (Word, LibreOffice ou docx2pdf)."""

from __future__ import annotations

import logging
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


def _via_docx2pdf(docx_path: Path, pdf_path: Path) -> bool:
    try:
        from docx2pdf import convert

        convert(str(docx_path), str(pdf_path))
        return pdf_path.is_file() and pdf_path.stat().st_size > 0
    except Exception as exc:
        logger.info("docx2pdf indisponible : %s", exc)
        return False


def _via_libreoffice(docx_path: Path, pdf_path: Path) -> bool:
    for binaire in ("soffice", "libreoffice"):
        exe = shutil.which(binaire)
        if not exe:
            continue
        out_dir = pdf_path.parent
        try:
            subprocess.run(
                [
                    exe,
                    "--headless",
                    "--convert-to",
                    "pdf",
                    "--outdir",
                    str(out_dir),
                    str(docx_path),
                ],
                check=True,
                capture_output=True,
                timeout=120,
            )
            genere = out_dir / f"{docx_path.stem}.pdf"
            if genere.is_file() and genere != pdf_path:
                genere.replace(pdf_path)
            return pdf_path.is_file() and pdf_path.stat().st_size > 0
        except (subprocess.SubprocessError, OSError) as exc:
            logger.info("Conversion %s échouée : %s", binaire, exc)
    return False


def convertir_docx_en_pdf(docx_bytes: bytes) -> tuple[Optional[bytes], Optional[str]]:
    """
    Retourne (pdf_bytes, message_erreur).
    message_erreur est renseigné si la conversion a échoué.
    """
    if not docx_bytes or len(docx_bytes) < 128:
        return None, "Document Word vide."

    with tempfile.TemporaryDirectory() as tmp:
        docx_path = Path(tmp) / "rapport.docx"
        pdf_path = Path(tmp) / "rapport.pdf"
        docx_path.write_bytes(docx_bytes)

        if _via_docx2pdf(docx_path, pdf_path) or _via_libreoffice(docx_path, pdf_path):
            return pdf_path.read_bytes(), None

    return (
        None,
        "Export PDF impossible : installez Microsoft Word (docx2pdf) ou LibreOffice sur ce poste.",
    )
