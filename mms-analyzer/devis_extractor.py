"""
devis_extractor.py — Extracteur automatique de devis ascenseurs LVO Ingénierie
Supporte : OTIS · CEGELEC · RIVIERE Schindler
"""

import re
import sys
import json
import logging
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional

try:
    import pdfplumber
except ImportError:
    print(json.dumps({"error": "pdfplumber non installé. Exécutez : pip install pdfplumber"}))
    sys.exit(1)

logger = logging.getLogger(__name__)

# ── Regex communs ────────────────────────────────────────────────────────────

RE_DATE = re.compile(
    r"\b(\d{1,2})[/.\-](\d{1,2})[/.\-](20\d{2})\b"
    r"|(\d{1,2})\s+(\w+)\s+(20\d{2})"
)

MOIS_FR = {
    "janvier": "01", "février": "02", "fevrier": "02",
    "mars": "03", "avril": "04", "mai": "05", "juin": "06",
    "juillet": "07", "août": "08", "aout": "08",
    "septembre": "09", "octobre": "10", "novembre": "11", "décembre": "12",
}

RE_MONTANT_SAFE = re.compile(r"(?<![0-9\s])\b(\d{2,}(?:\s\d{3})*[,\.]\d{2})\s*€?", re.IGNORECASE)
RE_TVA = re.compile(r"(?:TVA|tva)[^\d]*(\d{1,2}[.,]\d{0,2})\s*%", re.IGNORECASE)

CLIENTS_REUNION = ["SIDR", "SODIAC", "SEMADER", "CDC", "CINOR", "CAPRES", "SIM", "TCO"]

# Adresse du destinataire — ex. "51 Résidence PARADISIER", "12 Rue des Manguiers"
RE_ADRESSE = re.compile(
    r"\b(\d{1,4}[\s,]+(?:Rue|Av(?:enue)?|Bd|Boulevard|Chemin|All[ée]e|Impasse|"
    r"Lot(?:issement)?\.?|R[ée]s(?:idence)?\.?|Cit[ée])\s+[^\n,]{2,80})",
    re.IGNORECASE,
)

# ── Motif ────────────────────────────────────────────────────────────────────

RE_MOTIF_VANDAL       = re.compile(r"vandal(?:isme)?|acte\s+de\s+malveillance|dégradation\s+volontaire|tags?", re.IGNORECASE)
RE_MOTIF_INTEMPERIES  = re.compile(r"intempérie|intemperie|oxydation|rouille|corrosion|humidité|humidite|pluie|vent|cyclone", re.IGNORECASE)
RE_MOTIF_MAUVAISE_UTIL= re.compile(r"mauvaise\s+utilisation|mauvais\s+usage|surcharge|utilisation\s+abusive|maltraitance", re.IGNORECASE)
RE_MOTIF_VETUSTE      = re.compile(r"vétusté|vetuste|usure|vieillissement|fin\s+de\s+vie|obsolescence", re.IGNORECASE)

def _detect_motif(text: str) -> Optional[str]:
    if RE_MOTIF_VANDAL.search(text):
        return "vandalisme"
    if RE_MOTIF_INTEMPERIES.search(text):
        return "intemperies_oxydation"
    if RE_MOTIF_MAUVAISE_UTIL.search(text):
        return "mauvaise_utilisation"
    if RE_MOTIF_VETUSTE.search(text):
        return "vetuste"
    return None

# ── Patterns par marque ──────────────────────────────────────────────────────

# OTIS
RE_OTIS_NUMERO_DEVIS = re.compile(r"DEVIS\s+N[°o°]?\s*[:\-]?\s*(OP[\-\s]?\d{9,12})", re.IGNORECASE)
# APPAREIL(S) : ZB595  — accepte 2-3 lettres + 3-6 chiffres
RE_OTIS_APPAREIL     = re.compile(r"APPAREIL\(?S?\)?\s*[:\-]?\s*([A-Z]{2,3}\d{3,6})", re.IGNORECASE)
RE_OTIS_IMMEUBLE     = re.compile(r"IMMEUBLE\(?S?\)?\s*[:\-]?\s*\n?([^\n]+)", re.IGNORECASE)
RE_OTIS_MONTANT_HT   = re.compile(
    r"(?:Total\s+Prestations?\s+HT|Montant\s+total\s*\(\s*€\s*HT\s*\)|TOTAL\s+HT)[^\d]*?(\d[\d\s]*[,.]\d{2})",
    re.IGNORECASE
)
RE_OTIS_OBJET        = re.compile(r"(MLO\d+[^\n]{5,120})", re.IGNORECASE)

# CEGELEC
RE_CEG_NUMERO_DEVIS  = re.compile(r"Devis\s+N[°o]?\s*(DVTSP\d{2}\.T\d{4})", re.IGNORECASE)
# Numéro appareil : priorité à "N° contrat : REF/AM30365842" (partie après /)
# puis fallback ASC106
RE_CEG_CONTRAT_NUM   = re.compile(r"N[°o]?\s*contrat\s*[:\-]?\s*[^/\n]*/\s*([A-Z]{2}\d{5,12})", re.IGNORECASE)
RE_CEG_APPAREIL_ASC  = re.compile(r"\b(ASC\d{2,4})\b", re.IGNORECASE)
RE_CEG_MONTANT_HT    = re.compile(
    r"(?:Total\s+HT|Montant\s+HT|TOTAL\s+HORS\s+TAXE)[^\d]*?(\d[\d\s]*[,.]\d{2})",
    re.IGNORECASE
)
RE_CEG_BATIMENT      = re.compile(
    r"R[ée]f[ée]rence\s*[:\-]?\s*\S+\s+(?:R[ée]s(?:idence)?\.?\s+)?([A-ZÀ-Ÿa-zà-ÿ][^\-\n]{2,60}?)(?:\s+-|\n)",
    re.IGNORECASE
)

# RIVIERE Schindler
RE_RIV_PROPOSITION   = re.compile(r"Proposition\s+n[°o]?\s*[:\-]?\s*(\d[\d\s]*\d)", re.IGNORECASE)
RE_RIV_MONTANT_HT    = re.compile(
    r"TOTAL\s+HORS\s+TAXES[\s\S]{0,120}?\n(\d[\d\s]*[,.]\d{2})\s+\d",
    re.IGNORECASE
)
RE_RIV_MONTANT_HT2   = re.compile(
    r"(?:Montant\s+HT|Prix\s+HT|TOTAL\s+HT)[^\d]*?(\d[\d\s]*[,.]\d{2})",
    re.IGNORECASE
)
RE_RIV_OBJET         = re.compile(r"Objet\s*[:\-]\s*(.{10,300}?)(?:\n|$)", re.IGNORECASE)
RE_RIV_OBJET_ASSIST  = re.compile(r"(Assistance[^\n]{5,150}|Remise en service[^\n]{5,100})", re.IGNORECASE)

# ── Dataclass résultat ────────────────────────────────────────────────────────

@dataclass
class DevisExtrait:
    numero_devis: Optional[str] = None
    marque: Optional[str] = None
    client_nom: Optional[str] = None
    numero_appareil: Optional[str] = None
    batiment: Optional[str] = None
    adresse: Optional[str] = None
    ascenseur_arret: bool = False
    montant_ht: Optional[float] = None
    taux_tva: float = 2.10
    montant_tva: Optional[float] = None
    montant_ttc: Optional[float] = None
    date_devis: Optional[str] = None
    objet: Optional[str] = None
    motif: Optional[str] = None
    confidence: float = 0.0
    raw_text_snippet: Optional[str] = None


# ── Utilitaires ──────────────────────────────────────────────────────────────

def _clean_montant(raw: str) -> Optional[float]:
    s = raw.strip().replace(" ", "").replace(" ", "").replace(",", ".")
    if not re.match(r"^\d+\.\d{2}$", s):
        return None
    try:
        return round(float(s), 2)
    except ValueError:
        return None


def _parse_date(text: str) -> Optional[str]:
    m = RE_DATE.search(text)
    if not m:
        return None
    if m.group(1):
        return f"{m.group(3)}-{m.group(2).zfill(2)}-{m.group(1).zfill(2)}"
    jour, mois_txt, annee = m.group(4), m.group(5).lower(), m.group(6)
    mois = MOIS_FR.get(mois_txt)
    if mois:
        return f"{annee}-{mois}-{jour.zfill(2)}"
    return None


def _find_client(text: str) -> Optional[str]:
    for c in CLIENTS_REUNION:
        if c in text.upper():
            return c
    return None


def _detect_arret(text: str) -> bool:
    keywords = ["arrêt", "arret", "hors service", "immobilisé", "immobilise",
                "remise en service", "remise en marche", "bloqué", "bloque",
                "appareil a l'arret", "appareil à l'arrêt"]
    t = text.lower()
    return any(k in t for k in keywords)


def _first_montant(pattern: re.Pattern, text: str) -> Optional[float]:
    m = pattern.search(text)
    if m:
        v = _clean_montant(m.group(1))
        if v is not None and v > 0:
            return v
    return None


def _safe_montant_fallback(text: str) -> Optional[float]:
    best = None
    for m in RE_MONTANT_SAFE.finditer(text):
        v = _clean_montant(m.group(1))
        if v is not None and v > 10:
            if best is None or v > best:
                best = v
    return best


def _calc_tva_ttc(result: DevisExtrait) -> None:
    if result.montant_ht is None:
        return
    tva = result.taux_tva / 100
    result.montant_tva = round(result.montant_ht * tva, 2)
    result.montant_ttc = round(result.montant_ht + result.montant_tva, 2)


def _confidence(result: DevisExtrait) -> float:
    fields = [
        result.numero_devis, result.marque, result.montant_ht,
        result.date_devis, result.numero_appareil, result.objet,
    ]
    filled = sum(1 for f in fields if f is not None)
    return round(filled / len(fields), 2)


# ── Extracteurs par marque ────────────────────────────────────────────────────

def _extract_otis(text: str) -> DevisExtrait:
    r = DevisExtrait(marque="OTIS")

    # N° devis : "DEVIS N° : OP-002345865"
    m = RE_OTIS_NUMERO_DEVIS.search(text)
    if m:
        r.numero_devis = m.group(1).replace(" ", "").upper()
        if not r.numero_devis.startswith("OP-"):
            r.numero_devis = r.numero_devis.replace("OP", "OP-")

    # Appareil : "APPAREIL(S) : ZB595"
    m = RE_OTIS_APPAREIL.search(text)
    if m:
        r.numero_appareil = m.group(1).upper()

    # Bâtiment : "IMMEUBLE(S) :\nSEMADER RICO CARPAYE"
    m = RE_OTIS_IMMEUBLE.search(text)
    if m:
        batiment_raw = m.group(1).strip()
        for c in CLIENTS_REUNION:
            batiment_raw = re.sub(r"^\s*" + c + r"\s*", "", batiment_raw, flags=re.IGNORECASE).strip()
        if len(batiment_raw) > 2:
            r.batiment = batiment_raw[:100]

    # Montant HT
    r.montant_ht = _first_montant(RE_OTIS_MONTANT_HT, text)
    if r.montant_ht is None:
        r.montant_ht = _safe_montant_fallback(text)

    # Objet
    m = RE_OTIS_OBJET.search(text)
    if m:
        objet_raw = re.sub(r"^MLO\d+\s*", "", m.group(1), flags=re.IGNORECASE).strip()
        r.objet = objet_raw[:300]

    # TVA
    m = RE_TVA.search(text)
    if m:
        try:
            r.taux_tva = float(m.group(1).replace(",", "."))
        except ValueError:
            pass

    return r


def _extract_cegelec(text: str) -> DevisExtrait:
    r = DevisExtrait(marque="CEGELEC")

    # N° devis
    m = RE_CEG_NUMERO_DEVIS.search(text)
    if m:
        r.numero_devis = m.group(1).upper()

    # Numéro appareil — stratégie 1 : "N° contrat : REF/AM30365842" → AM30365842
    m = RE_CEG_CONTRAT_NUM.search(text)
    if m:
        r.numero_appareil = m.group(1).upper()
    else:
        # Stratégie 2 : code ASC dans la désignation (ASC106, ASC102…)
        m = RE_CEG_APPAREIL_ASC.search(text)
        if m:
            r.numero_appareil = m.group(1).upper()

    # Bâtiment
    m = RE_CEG_BATIMENT.search(text)
    if m:
        r.batiment = m.group(1).strip()[:100]
    else:
        m2 = re.search(r"R[ée]s(?:idence)?\.?\s+([A-ZÀ-Ÿ][^\n\-]{2,50}?)(?:\s*\-|\n|$)", text, re.IGNORECASE)
        if m2:
            r.batiment = m2.group(1).strip()[:100]

    # Montant HT
    r.montant_ht = _first_montant(RE_CEG_MONTANT_HT, text)
    if r.montant_ht is None:
        r.montant_ht = _safe_montant_fallback(text)

    # Objet
    m = re.search(
        r"(?:D[ée]signation\s+des\s+travaux[^\n]*\n)\s*\d+\s+\S+\s+(.+?)(?:\s+\d+\s+\d)",
        text, re.IGNORECASE | re.DOTALL
    )
    if m:
        r.objet = m.group(1).strip()[:300]
    else:
        m2 = re.search(
            r"\b(?:ASC\d{2,4})\s+(.{10,200}?)(?:\s+\d+\s+[\d\s,\.]+€?)",
            text, re.IGNORECASE
        )
        if m2:
            r.objet = m2.group(1).strip()[:300]

    m = RE_TVA.search(text)
    if m:
        try:
            r.taux_tva = float(m.group(1).replace(",", "."))
        except ValueError:
            pass

    return r


def _extract_riviere_schindler(text: str) -> DevisExtrait:
    r = DevisExtrait(marque="RIVIERE_SCHINDLER")

    # N° devis : "Proposition n° : 16 375" → "P16375"
    m = RE_RIV_PROPOSITION.search(text)
    if m:
        num = re.sub(r"\s+", "", m.group(1))
        r.numero_devis = f"P{num}"
    else:
        m2 = re.search(r"\b(\d{5,6})\b", text)
        if m2 and not (2000 <= int(m2.group(1)) <= 2100):
            r.numero_devis = m2.group(1)

    # Numéro appareil — mapping précis selon format réel du PDF :
    #   - "N° (colonne Installation) → 102"  : tableau avec colonne N° / Installation
    #   - "Installation : ASC N° 102"          : format ligne
    #   - "ASC N° 102"                          : raccourci
    asc_patterns = [
        # Table colonne : "N°   Installation\n102  ..."  ou  "N°\n102\nInstallation"
        r"(?:^|\n)\s*N[°o]\s+(\d{2,4})\b(?:[^\n]*\nInstallation|\s+Installation)",
        # "Installation ... N° 102" (même ligne ou ligne suivante)
        r"Installation[^:\n\d]{0,30}N[°o]\s*[:\-]?\s*(\d{2,4})\b",
        # "Installation : ASC N° 102"
        r"Installation[^:\n]*[:\-]?\s*(?:ASC\s+)?N[°o]?\s*[:\-]?\s*(\d{2,4})\b",
        # Tableau : numéro seul précédant le mot Installation sur ligne suivante
        r"(\d{2,4})\s*\n\s*Installation",
        # "ASC N° 102" ou "ASC102" n'importe où
        r"\bASC\s*N[°o]?\s*[:\-]?\s*(\d{2,4})\b",
        r"\bASC\s*(\d{2,4})\b",
    ]
    for pat in asc_patterns:
        m = re.search(pat, text, re.IGNORECASE | re.MULTILINE)
        if m:
            r.numero_appareil = m.group(1)
            break

    # Montant HT
    r.montant_ht = _first_montant(RE_RIV_MONTANT_HT, text)
    if r.montant_ht is None:
        r.montant_ht = _first_montant(RE_RIV_MONTANT_HT2, text)
    if r.montant_ht is None:
        m2 = re.search(r"(\d[\d\s]*[,.]\d{2})\s+\d\s+2[,.]1", text)
        if m2:
            r.montant_ht = _clean_montant(m2.group(1))

    # Objet
    m = RE_RIV_OBJET.search(text)
    if m:
        r.objet = m.group(1).strip()[:300]
    else:
        m2 = RE_RIV_OBJET_ASSIST.search(text)
        if m2:
            r.objet = m2.group(1).strip()[:300]

    m = RE_TVA.search(text)
    if m:
        try:
            r.taux_tva = float(m.group(1).replace(",", "."))
        except ValueError:
            pass

    return r


# ── Détection marque ─────────────────────────────────────────────────────────

def _detect_brand(text: str) -> str:
    t_upper = text.upper()

    if "OTIS" in t_upper and ("OP-" in text or "DEVIS N°" in t_upper):
        return "OTIS"
    if "CEGELEC" in t_upper:
        return "CEGELEC"
    if "SCHINDLER" in t_upper or "RIVIERE" in t_upper or "RIVIÈRE" in t_upper:
        return "RIVIERE_SCHINDLER"
    if "OTIS" in t_upper:
        return "OTIS"
    if "DVTSP" in t_upper:
        return "CEGELEC"
    if re.search(r"\bASC\d{2,4}\b", text, re.IGNORECASE):
        return "RIVIERE_SCHINDLER"

    return "INCONNU"


# ── Interface principale ──────────────────────────────────────────────────────

def extract_devis(pdf_path: str) -> dict:
    path = Path(pdf_path)
    if not path.exists():
        return {"error": f"Fichier introuvable : {pdf_path}"}

    full_text = ""
    try:
        with pdfplumber.open(str(path)) as pdf:
            pages = []
            for page in pdf.pages:
                t = page.extract_text(x_tolerance=2, y_tolerance=2) or ""
                pages.append(t)
            full_text = "\n".join(pages)
    except Exception as exc:
        return {"error": f"Erreur lecture PDF : {exc}"}

    if not full_text.strip():
        return {"error": "Le PDF ne contient pas de texte extractible (PDF image ?). Utilisez un outil OCR."}

    brand = _detect_brand(full_text)

    if brand == "OTIS":
        result = _extract_otis(full_text)
    elif brand == "CEGELEC":
        result = _extract_cegelec(full_text)
    elif brand == "RIVIERE_SCHINDLER":
        result = _extract_riviere_schindler(full_text)
    else:
        result = DevisExtrait(marque="INCONNU")
        result.montant_ht = _safe_montant_fallback(full_text)
        m = RE_TVA.search(full_text)
        if m:
            try:
                result.taux_tva = float(m.group(1).replace(",", "."))
            except ValueError:
                pass

    # Champs communs
    result.date_devis = _parse_date(full_text)
    result.client_nom = _find_client(full_text)
    result.ascenseur_arret = _detect_arret(full_text)
    result.motif = _detect_motif(full_text)

    # Adresse du destinataire
    m_adr = RE_ADRESSE.search(full_text)
    if m_adr:
        result.adresse = re.sub(r"\s+", " ", m_adr.group(1)).strip()[:150]

    # Bâtiment commun si non trouvé
    if not result.batiment:
        m = re.search(
            r"(?:Résidence|Rés\.?|Bâtiment|Batiment|Immeuble)\s*[:\-]?\s*([A-ZÀ-Ÿ][^\n,\-]{2,60}?)(?:\n|,|-|$)",
            full_text, re.IGNORECASE
        )
        if m:
            result.batiment = m.group(1).strip()[:100]

    _calc_tva_ttc(result)

    result.confidence = _confidence(result)
    result.raw_text_snippet = full_text[:200].replace("\n", " ")

    return asdict(result)


# ── CLI ───────────────────────────────────────────────────────────────────────

def _cli():
    import argparse
    parser = argparse.ArgumentParser(
        description="Extracteur de devis ascenseurs — LVO Ingénierie (La Réunion)"
    )
    parser.add_argument("pdf", help="Chemin vers le fichier PDF du devis")
    parser.add_argument("--pretty", action="store_true", help="JSON indenté")
    args = parser.parse_args()

    result = extract_devis(args.pdf)
    indent = 2 if args.pretty else None
    print(json.dumps(result, ensure_ascii=False, indent=indent))


if __name__ == "__main__":
    logging.basicConfig(level=logging.WARNING)
    _cli()
