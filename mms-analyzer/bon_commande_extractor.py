"""
bon_commande_extractor.py — Extracteur automatique de bons de commande LVO Ingénierie
Extrait : numéro de commande, adresse de livraison/chantier, fournisseur (prestataire),
client (donneur d'ordre) — à partir du texte du PDF déposé par le client.
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

CLIENTS_REUNION = [
    "SIDR", "SODIAC", "SEMADER", "CDC", "CINOR", "CAPRES", "SIM", "TCO",
    # Établissements publics / collectivités fréquemment donneurs d'ordre (Chorus)
    "CHU", "CASUD", "CIVIS",
]
FOURNISSEURS_CONNUS = {
    "OTIS": ["OTIS"],
    "CEGELEC": ["CEGELEC"],
    "RIVIERE_SCHINDLER": ["SCHINDLER", "RIVIERE", "RIVIÈRE"],
}

# Adresse connue de LVO Ingénierie — à exclure des adresses « client » détectées
# (elle apparaît systématiquement dans les bons de commande où LVO est le fournisseur/destinataire).
LVO_MARKERS = ["LVO INGENIERIE", "LVO ING"]

# ── Numéro de commande ───────────────────────────────────────────────────────
RE_NUMERO_COMMANDE = re.compile(
    r"(?:N[°o]?\.?\s*(?:um[ée]ro)?\.?\s*(?:de\s+)?(?:commande|bon\s+de\s+commande)|"
    r"Bon\s+de\s+commande\s+n[°o]?|Commande\s+n[°o]?|BC\s*n[°o]?|PO\s*n[°o]?)"
    r"\s*[:\-]?\s*([A-Z]{0,3}\d{5,15})",
    re.IGNORECASE,
)
# Formulaires Chorus (B2G) : le n° de commande est souvent suivi directement de la date
# sur la même ligne, sans libellé adjacent (ex. « 26021632 22/06/2026 »).
RE_NUMERO_PLUS_DATE = re.compile(r"\b(\d{6,10})\s+\d{1,2}/\d{1,2}/\d{2,4}\b")
RE_NUMERO_FALLBACK = re.compile(r"\b(\d{8,12})\b")

# ── Adresse ──────────────────────────────────────────────────────────────────
RE_ADRESSE_LABEL = re.compile(
    r"(?:Adresse\s+(?:de\s+)?(?:livraison|chantier|exécution|execution|intervention)|"
    r"Lieu\s+(?:de\s+)?(?:livraison|exécution|execution|intervention)|"
    r"Adresse\s+chantier)\s*[:\-]?\s*\n?([^\n]{5,150})",
    re.IGNORECASE,
)
# Rejette les libellés de section voisins capturés par erreur (mise en page en colonnes :
# le texte qui suit immédiatement un libellé « Lieu de livraison » est parfois un AUTRE libellé).
RE_HEADER_LIKE = re.compile(
    r"^(?:lieu\s+de|adresse|code|siret|service|destinataire|bon\s+de\s+commande|gestionnaire)\b",
    re.IGNORECASE,
)
# Réunion : code postal 974xx + ville, sur une seule ligne (tiret/virgule optionnel entre les deux,
# ex. « 97490 - SAINTE CLOTILDE »)
RE_ADRESSE_CP = re.compile(r"([A-ZÀ-Ÿ0-9][^\n]{2,80}?\s*97[34]\d{2}\s*[-,]?\s*[A-ZÀ-Ÿ][^\n]{2,40})", re.IGNORECASE)
# Idem mais ligne autonome « CP VILLE » (mise en page en tableau/colonnes où la rue est sur une
# autre ligne) — on rattache alors la ligne précédente comme complément de rue si plausible.
RE_ADRESSE_CP_LINE = re.compile(r"^[ \t]*(97[34]\d{2}[ \t]+[A-ZÀ-Ÿ][A-Za-zÀ-Ÿ'\-\s]{1,40})[ \t]*$", re.MULTILINE)

# ── Référence devis/offre LVO (permet de relier le BC à une offre existante) ──
RE_DEVIS_REF = re.compile(r"(?:DEVIS|OFFRE)\s*N[°o]?\s*[:\-]?\s*([A-Z]{2,6}-[A-Z]{2,6}-\d{4,8})", re.IGNORECASE)

# ── Montant (info complémentaire, optionnel) ─────────────────────────────────
# Tolère les abréviations pointées (« T.T.C. », « H.T. ») fréquentes sur les BC administratifs.
RE_MONTANT_TTC = re.compile(r"(?:Total|Montant)\s*T\.?T\.?C\.?\b[^\d]*?(\d[\d\s]*[,.]\d{2})", re.IGNORECASE)
RE_MONTANT_HT = re.compile(r"(?:Total|Montant)\s*H\.?T\.?\b[^\d]*?(\d[\d\s]*[,.]\d{2})", re.IGNORECASE)
# Offres LVO (tableaux d'honoraires) : le libellé HT/TTC suit le montant plutôt que de le précéder
# (ex. « TOTAL 750,00 € HT »), à l'inverse des bons de commande administratifs ci-dessus.
RE_MONTANT_APRES = re.compile(
    r"(?:Total|Montant)[^\n\d]{0,15}(\d[\d\s]*[,.]\d{2})\s*€?\s*(?:HT|TTC|H\.T\.|T\.T\.C\.)",
    re.IGNORECASE,
)


@dataclass
class BonCommandeExtrait:
    numero: Optional[str] = None
    adresse: Optional[str] = None
    fournisseur: Optional[str] = None
    client: Optional[str] = None
    montant_ttc: Optional[float] = None
    reference_devis: Optional[str] = None
    confidence: float = 0.0
    raw_text_snippet: Optional[str] = None


def _clean_montant(raw: str) -> Optional[float]:
    s = raw.strip().replace(" ", "").replace(" ", "").replace(",", ".")
    if not re.match(r"^\d+\.\d{2}$", s):
        return None
    try:
        return round(float(s), 2)
    except ValueError:
        return None


def _find_numero(text: str) -> Optional[str]:
    m = RE_NUMERO_COMMANDE.search(text)
    if m:
        return m.group(1).strip().upper()
    m = RE_NUMERO_PLUS_DATE.search(text)
    if m:
        return m.group(1).strip()
    m = RE_NUMERO_FALLBACK.search(text)
    if m:
        return m.group(1)
    return None


def _contains_lvo(text: str) -> bool:
    # Normalise tirets/espaces multiples : « LVO-INGENIERIE » et « LVO  INGENIERIE »
    # doivent tous les deux matcher le marqueur « LVO INGENIERIE ».
    t_norm = re.sub(r"[-\s]+", " ", text.upper())
    return any(marker in t_norm for marker in LVO_MARKERS)


def _find_adresse_colonnes(text: str) -> Optional[str]:
    """Mise en page en colonnes : code postal + ville sur leur propre ligne, rue sur la ligne
    précédente. On exclut les occurrences précédées de la mention LVO (notre propre adresse)."""
    lines = text.split("\n")
    for i, line in enumerate(lines):
        cp_match = RE_ADRESSE_CP_LINE.match(line)
        if not cp_match:
            continue
        context_before = "\n".join(lines[max(0, i - 6) : i])
        if _contains_lvo(context_before):
            continue
        cp_ville = re.sub(r"\s+", " ", cp_match.group(1)).strip()
        prev_line = lines[i - 1].strip() if i > 0 else ""
        if prev_line and not RE_HEADER_LIKE.match(prev_line) and len(prev_line) <= 60:
            return f"{prev_line} {cp_ville}"[:150]
        return cp_ville[:150]
    return None


def _find_adresse(text: str) -> Optional[str]:
    m = RE_ADRESSE_LABEL.search(text)
    if m:
        captured = re.sub(r"\s+", " ", m.group(1)).strip()
        if captured and not RE_HEADER_LIKE.match(captured) and not _contains_lvo(captured):
            return captured[:150]
    for m in RE_ADRESSE_CP.finditer(text):
        captured = re.sub(r"\s+", " ", m.group(1)).strip()
        if _contains_lvo(captured) or _contains_lvo(text[max(0, m.start() - 200) : m.start()]):
            continue
        return captured[:150]
    return _find_adresse_colonnes(text)


def _find_fournisseur(text: str) -> Optional[str]:
    t_upper = text.upper()
    for label, keywords in FOURNISSEURS_CONNUS.items():
        if any(k in t_upper for k in keywords):
            return label
    return None


def _find_client(text: str) -> Optional[str]:
    t_upper = text.upper()
    for c in CLIENTS_REUNION:
        if c in t_upper:
            return c
    return None


def _find_reference_devis(text: str) -> Optional[str]:
    m = RE_DEVIS_REF.search(text)
    if m:
        return m.group(1).strip().upper()
    return None


def _confidence(result: BonCommandeExtrait) -> float:
    fields = [result.numero, result.adresse, result.fournisseur, result.client]
    filled = sum(1 for f in fields if f is not None)
    return round(filled / len(fields), 2)


def extract_bon_commande(pdf_path: str) -> dict:
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

    result = BonCommandeExtrait(
        numero=_find_numero(full_text),
        adresse=_find_adresse(full_text),
        fournisseur=_find_fournisseur(full_text),
        client=_find_client(full_text),
        reference_devis=_find_reference_devis(full_text),
    )

    m = RE_MONTANT_TTC.search(full_text) or RE_MONTANT_HT.search(full_text) or RE_MONTANT_APRES.search(full_text)
    if m:
        result.montant_ttc = _clean_montant(m.group(1))

    result.confidence = _confidence(result)
    result.raw_text_snippet = full_text[:200].replace("\n", " ")

    return asdict(result)


def _cli():
    import argparse
    parser = argparse.ArgumentParser(
        description="Extracteur de bons de commande — LVO Ingénierie (La Réunion)"
    )
    parser.add_argument("pdf", help="Chemin vers le fichier PDF du bon de commande")
    parser.add_argument("--pretty", action="store_true", help="JSON indenté")
    args = parser.parse_args()

    result = extract_bon_commande(args.pdf)
    indent = 2 if args.pretty else None
    print(json.dumps(result, ensure_ascii=False, indent=indent))


if __name__ == "__main__":
    logging.basicConfig(level=logging.WARNING)
    _cli()
