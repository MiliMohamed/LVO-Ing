# -*- coding: utf-8 -*-
"""
Lecture et normalisation des fichiers Excel bruts prestataire.
Détection dynamique des en-têtes, parseur d'heures/dates unifié.
"""

from __future__ import annotations

import io
import re
import unicodedata
from datetime import date, datetime, time, timedelta
from typing import BinaryIO, Optional, Union

import pandas as pd

from config import parametres as cfg

FileLike = Union[str, bytes, BinaryIO]

# Signatures binaires Excel
_MAGIC_ZIP = b"PK"  # .xlsx / .xlsm
_MAGIC_OLE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"  # .xls (BIFF)


def _vers_bytes(source: FileLike) -> bytes:
    """Normalise toute source en bytes."""
    if isinstance(source, bytes):
        return source
    if isinstance(source, str):
        with open(source, "rb") as f:
            return f.read()
    if hasattr(source, "read"):
        return source.read()
    raise TypeError("Source fichier non supportée")


def _detecter_format_excel(data: bytes, filename: Optional[str] = None) -> str:
    """
    Retourne 'xlsx' (zip) ou 'xls' (OLE).
    Utilise les octets du fichier en priorité, puis l'extension.
    """
    if len(data) < 8:
        raise ValueError(
            "Fichier vide ou trop petit. Déposez le classeur Excel complet du prestataire (.xlsx ou .xls)."
        )
    if data[:2] == _MAGIC_ZIP:
        return "xlsx"
    if data[:8] == _MAGIC_OLE:
        return "xls"
    if filename:
        nom = filename.lower()
        if nom.endswith(".xls") and not nom.endswith(".xlsx") and not nom.endswith(".xlsm"):
            return "xls"
        if nom.endswith((".xlsx", ".xlsm")):
            return "xlsx"
    raise ValueError(
        "Format non reconnu : le fichier doit être un classeur Excel (.xlsx ou .xls). "
        "Les exports CSV/HTML renommés en .xlsx ne sont pas acceptés. "
        "Ouvrez le fichier dans Excel et enregistrez-le au format « Classeur Excel (.xlsx) »."
    )


def _moteur_pandas(fmt: str) -> str:
    return "xlrd" if fmt == "xls" else "openpyxl"


def _ouvrir_classeur(data: bytes, filename: Optional[str] = None) -> tuple[pd.ExcelFile, str]:
    """
    Ouvre le classeur avec le bon moteur (openpyxl / xlrd).
    En cas d'échec, tente le moteur alternatif.
    """
    fmt = _detecter_format_excel(data, filename)
    moteur = _moteur_pandas(fmt)
    buffer = io.BytesIO(data)
    try:
        return pd.ExcelFile(buffer, engine=moteur), moteur
    except Exception as exc_primaire:
        alt = "xlrd" if moteur == "openpyxl" else "openpyxl"
        try:
            buffer.seek(0)
            return pd.ExcelFile(io.BytesIO(data), engine=alt), alt
        except Exception:
            raise ValueError(
                f"Impossible de lire le classeur Excel ({filename or 'fichier'}) : {exc_primaire}. "
                "Vérifiez que le fichier n'est pas corrompu et qu'il s'agit bien des données brutes prestataire."
            ) from exc_primaire


def _lire_feuille_brute_bytes(
    data: bytes,
    nom_feuille: str,
    moteur: str,
) -> pd.DataFrame:
    return pd.read_excel(
        io.BytesIO(data),
        sheet_name=nom_feuille,
        header=None,
        engine=moteur,
    )


def _normaliser_texte(val: object) -> str:
    """Minuscules, sans accents, espaces réduits — pour comparaisons robustes."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return ""
    s = str(val).strip().lower()
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", s)


def normaliser_libelle(val: object) -> str:
    """Nettoyage des libellés « type de panne » avant regroupement."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return ""
    return str(val).strip().lower()


def _promouvoir_ligne_sous_entetes(df: pd.DataFrame) -> pd.DataFrame:
    """
    Fusionne une 2e ligne d'en-têtes (Date / Heure sous « Appel client », etc.)
    fréquente sur les exports OTIS trimestriels Annexe 5.
    """
    if df.empty or len(df) < 2:
        return df

    sous = [_normaliser_texte(v) for v in df.iloc[0]]
    nb_date_heure = sum(
        1
        for t in sous
        if t in ("date", "heure") or t.startswith("date") or t.startswith("heure")
    )
    if nb_date_heure < 2:
        return df

    parents = [_normaliser_texte(c) for c in df.columns]
    nouveaux: list[str] = []
    dernier_parent = ""
    for parent, sub in zip(parents, sous):
        p = parent if parent and not parent.startswith("col_") else dernier_parent
        if parent and not parent.startswith("col_"):
            dernier_parent = p
        if sub in ("date", "heure") or sub.startswith("date") or sub.startswith("heure"):
            label = f"{p} {sub}".strip() if p else sub
            nouveaux.append(label)
        elif sub and sub not in ("nan", "none"):
            nouveaux.append(sub)
        else:
            nouveaux.append(parent or f"col_{len(nouveaux)}")

    out = df.iloc[1:].copy()
    out.columns = nouveaux
    return out.reset_index(drop=True)


def _trouver_ligne_entete(df_brut: pd.DataFrame, max_lignes: int = 30) -> int:
    """
    Repère la ligne d'en-tête en cherchant « adresse » ou « ascenseur »
    dans les premières lignes du classeur.
    """
    limite = min(max_lignes, len(df_brut))
    for i in range(limite):
        ligne = df_brut.iloc[i]
        for cell in ligne:
            t = _normaliser_texte(cell)
            if "adresse" in t or t == "ascenseur" or t.startswith("ascenseur"):
                return i
    return 0


def _feuille_correspondante(
    noms: list[str],
    motifs: tuple[str, ...],
    exclure_dans_nom: tuple[str, ...] = (),
) -> Optional[str]:
    """Retourne le nom réel de la feuille correspondant à l'un des motifs."""
    noms_norm = {_normaliser_texte(n): n for n in noms}
    for motif in motifs:
        m = _normaliser_texte(motif)
        for cle, original in noms_norm.items():
            if exclure_dans_nom and any(ex in cle for ex in exclure_dans_nom):
                continue
            if m in cle or cle in m:
                return original
    return None


def _moteur_excel(chemin_ou_buffer: FileLike) -> str:
    """xlrd pour .xls, openpyxl pour .xlsx — depuis chemin disque."""
    if isinstance(chemin_ou_buffer, str):
        data = _vers_bytes(chemin_ou_buffer)
        _, moteur = _ouvrir_classeur(data, chemin_ou_buffer)
        return moteur
    return "openpyxl"


def _colonnes_normalisees(cols: list) -> dict[str, str]:
    """Mappe nom normalisé → nom d'origine."""
    return {_normaliser_texte(c): str(c) for c in cols}


def _trouver_colonne(
    cols_map: dict[str, str],
    *mots_cles: str,
    exclure: tuple[str, ...] = (),
) -> Optional[str]:
    """
    Retrouve une colonne dont le libellé contient tous les mots-clés.
    En cas d'ambiguïté, préfère le libellé le plus court (plus spécifique).
    """
    candidats: list[tuple[int, str]] = []
    for cle_norm, nom_orig in cols_map.items():
        if exclure and any(ex in cle_norm for ex in exclure):
            continue
        if all(_normaliser_texte(m) in cle_norm for m in mots_cles):
            candidats.append((len(cle_norm), nom_orig))
    if not candidats:
        return None
    candidats.sort(key=lambda x: x[0])
    return candidats[0][1]


def parse_heure(val: object) -> Optional[time]:
    """
    Parseur unique d'heures : « 10h00 », « 8h40 », datetime, time, HH:MM:SS.
    """
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    if isinstance(val, time) and not isinstance(val, datetime):
        return val
    if isinstance(val, datetime):
        return val.time()
    if isinstance(val, timedelta):
        total = int(val.total_seconds())
        h, r = divmod(total, 3600)
        m, s = divmod(r, 60)
        return time(h % 24, m, s)

    s = str(val).strip()
    if not s:
        return None

    # Format français « 10h00 », « 8h40 », « 7h00 »
    m = re.match(r"^(\d{1,2})\s*h\s*(\d{2})$", s, re.IGNORECASE)
    if m:
        return time(int(m.group(1)), int(m.group(2)))

    m = re.match(r"^(\d{1,2}):(\d{2})(?::(\d{2}))?$", s)
    if m:
        sec = int(m.group(3)) if m.group(3) else 0
        return time(int(m.group(1)), int(m.group(2)), sec)

    try:
        parsed = pd.to_datetime(s, errors="coerce")
        if pd.notna(parsed):
            return parsed.time()
    except Exception:
        pass
    return None


def parse_date(val: object) -> Optional[date]:
    """Date depuis datetime, chaîne ou numéro de série Excel."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date) and not isinstance(val, datetime):
        return val
    if isinstance(val, (int, float)) and not isinstance(val, bool):
        try:
            parsed = pd.to_datetime(val, unit="D", origin="1899-12-30", errors="coerce")
            if pd.notna(parsed):
                return parsed.date()
        except Exception:
            pass
    try:
        parsed = pd.to_datetime(val, errors="coerce", dayfirst=True)
        if pd.notna(parsed):
            return parsed.date()
    except Exception:
        pass
    return None


def combiner_date_heure(
    date_val: object,
    heure_val: object,
) -> Optional[datetime]:
    """Assemble date + heure ; None si l'un des deux manque."""
    d = parse_date(date_val)
    h = parse_heure(heure_val)
    if d is None:
        return None
    if h is None:
        h = time(0, 0)
    return datetime.combine(d, h)


def _charger_feuille_normalisee(
    data: bytes,
    sheet_names: list[str],
    motifs_feuille: tuple[str, ...],
    mapping_colonnes: dict[str, tuple[str, ...]],
    moteur: str,
    exclusions_colonnes: Optional[dict[str, tuple[str, ...]]] = None,
    exclure_feuilles: tuple[str, ...] = (),
) -> pd.DataFrame:
    """
    Charge une feuille, détecte l'en-tête, renomme les colonnes selon mapping_colonnes.
    mapping_colonnes : clé cible → mots-clés pour retrouver la colonne source.
    """
    nom = _feuille_correspondante(
        sheet_names,
        motifs_feuille,
        exclure_dans_nom=exclure_feuilles,
    )
    if nom is None:
        return pd.DataFrame()

    brut = _lire_feuille_brute_bytes(data, nom, moteur)
    if brut.empty:
        return pd.DataFrame()

    idx = _trouver_ligne_entete(brut)
    entetes = brut.iloc[idx].tolist()
    df = brut.iloc[idx + 1 :].copy()
    df.columns = [str(c).strip() if pd.notna(c) else f"col_{i}" for i, c in enumerate(entetes)]
    df = df.dropna(how="all").reset_index(drop=True)
    df = _promouvoir_ligne_sous_entetes(df)

    cols_map = _colonnes_normalisees(df.columns.tolist())
    exclusions = exclusions_colonnes or {}
    rename = {}
    for cible, mots in mapping_colonnes.items():
        col = _trouver_colonne(
            cols_map,
            *mots,
            exclure=exclusions.get(cible, ()),
        )
        if col:
            rename[col] = cible
    df = df.rename(columns=rename)
    return df


# Mappings colonnes par type de feuille
# Exclusions pour éviter les faux positifs sur exports OTIS SCI mal routés
_EXCL_COL_CLIENT = ("description", "diagnostique", "origine", "appelant")
_EXCL_COL_TECH = ("diagnostique", "description")

_MAP_INTERVENTION = {
    "adresse": ("adresse",),
    "client": ("client",),
    "ascenseur": ("ascenseur",),
    "nom_appelant": ("nom", "appelant"),
    "nom_technicien": ("nom", "technicien"),
    "cause_panne": ("cause", "panne"),
    "materiel": ("materiel", "matériel"),
}

_EXCLUSIONS_COLONNES_INTERVENTION: dict[str, tuple[str, ...]] = {
    "client": _EXCL_COL_CLIENT,
    "nom_technicien": _EXCL_COL_TECH,
    "nom_appelant": ("technicien", "diagnostique"),
}

_MAP_MAINTENANCE = {
    "adresse": ("adresse",),
    "client": ("client",),
    "ascenseur": ("ascenseur",),
    "nom_technicien": ("technicien",),
    "type_maintenance": ("type", "maintenance"),
    "materiel_change": ("materiel", "chang"),
}


def _ajuster_colonnes_dates(df: pd.DataFrame) -> pd.DataFrame:
    """Repère date_debut / date_fin et heures associées sur feuilles maintenance / tests."""
    if df.empty:
        return df
    cols = _colonnes_normalisees(df.columns.tolist())
    for cle_norm, orig in cols.items():
        if cle_norm.startswith("date") and "deb" in cle_norm:
            df["date_debut"] = df[orig]
        elif cle_norm.startswith("date") and "fin" in cle_norm:
            df["date_fin"] = df[orig]
        elif "date" in cle_norm and "heure" in cle_norm:
            if "deb" in cle_norm:
                df["date_debut"] = df[orig]
            elif "fin" in cle_norm:
                df["date_fin"] = df[orig]
        elif cle_norm.startswith("heure") and "deb" in cle_norm:
            df["heure_debut"] = df[orig]
        elif cle_norm == "heure" or (cle_norm.startswith("heure") and "fin" not in cle_norm and "deb" not in cle_norm):
            if "heure_fin" not in df.columns:
                df["heure_fin"] = df[orig]
    return df

_MAP_TEST = {
    "adresse": ("adresse",),
    "client": ("client",),
    "ascenseur": ("ascenseur",),
    "date_debut": ("date", "deb"),
    "heure_debut": ("heure", "deb"),
    "date_fin": ("date", "fin"),
    "heure_fin": ("heure",),
    "nom_technicien": ("technicien",),
    "commentaire": ("commentaire",),
}


def _mapper_dates_heures_intervention(df: pd.DataFrame) -> None:
    """Mappe les colonnes Date/Heure séparées (export OTIS trimestriel)."""
    cols = _colonnes_normalisees(df.columns.tolist())
    dates: list[str] = []
    heures: list[str] = []
    for cle_norm, orig in cols.items():
        if "type" in cle_norm and "panne" in cle_norm:
            continue
        if cle_norm == "date" or (cle_norm.startswith("date") and "type" not in cle_norm):
            dates.append(orig)
        elif cle_norm == "heure" or (cle_norm.startswith("heure") and len(cle_norm) <= 12):
            heures.append(orig)
        elif "date" in cle_norm and "heure" in cle_norm:
            if "deb" in cle_norm or "debut" in cle_norm:
                df["date_debut"] = df[orig]
            elif "fin" in cle_norm:
                df["date_fin"] = df[orig]
            elif "date_appel" not in df.columns:
                df["date_appel"] = df[orig]
        elif "appel" in cle_norm and "date" in cle_norm:
            df["date_appel"] = df[orig]
        elif "appel" in cle_norm and "heure" in cle_norm:
            df["heure_appel"] = df[orig]
        elif ("deb" in cle_norm or "debut" in cle_norm) and "date" in cle_norm:
            df["date_debut"] = df[orig]
        elif ("deb" in cle_norm or "debut" in cle_norm) and "heure" in cle_norm:
            df["heure_debut"] = df[orig]
        elif "fin" in cle_norm and "date" in cle_norm:
            df["date_fin"] = df[orig]
        elif "fin" in cle_norm and "heure" in cle_norm:
            df["heure_fin"] = df[orig]

    paires = list(zip(dates, heures))
    if paires and "date_appel" not in df.columns:
        df["date_appel"] = df[paires[0][0]]
        df["heure_appel"] = df[paires[0][1]]
    if len(paires) > 1 and "date_debut" not in df.columns:
        df["date_debut"] = df[paires[1][0]]
        df["heure_debut"] = df[paires[1][1]]
    if len(paires) > 2 and "date_fin" not in df.columns:
        df["date_fin"] = df[paires[2][0]]
        df["heure_fin"] = df[paires[2][1]]


def _ajuster_colonnes_intervention(df: pd.DataFrame) -> pd.DataFrame:
    """
    Complète date_appel / date_debut / date_fin et type_panne selon les libellés réels.
    Gère « Date / Heure », « Date Début / Heure Déb », « Date Fin / Heure ».
    """
    if df.empty:
        return df

    cols = _colonnes_normalisees(df.columns.tolist())

    def _assign(cible: str, orig: str) -> None:
        if orig in df.columns:
            df[cible] = df[orig]

    _mapper_dates_heures_intervention(df)

    for cle_norm, orig in cols.items():
        if "type" in cle_norm and "panne" in cle_norm:
            _assign("type_panne", orig)
        if "date" in cle_norm and "heure" in cle_norm:
            if "deb" in cle_norm or "debut" in cle_norm:
                _assign("date_debut", orig)
            elif "fin" in cle_norm:
                _assign("date_fin", orig)
            elif "appel" not in cle_norm and "fin" not in cle_norm and "deb" not in cle_norm:
                if "date_appel" not in df.columns:
                    _assign("date_appel", orig)

    # Colonnes « Type de panne » non renommées par le mapping générique
    for col in df.columns:
        cn = _normaliser_texte(col)
        if cn == "type de panne" or (cn.startswith("type") and "panne" in cn):
            df["type_panne"] = df[col].map(normaliser_libelle)

    if "type_panne" in df.columns:
        df["type_panne"] = df["type_panne"].map(normaliser_libelle)

    # Supprime les doublons de colonnes sources non renommées si présentes
    return df


def charger_fichier_prestataire(
    source: FileLike,
    filename: Optional[str] = None,
    params: Optional[dict] = None,
) -> dict[str, pd.DataFrame]:
    """
    Charge le fichier brut prestataire (format annexe 5 ou OTIS SCI).
    Retourne un dict : interventions, maintenance, parachute, cables [, arrets].
    """
    data = _vers_bytes(source)
    xl, moteur = _ouvrir_classeur(data, filename)
    noms = xl.sheet_names

    from core.parser_otis_sci import charger_fichier_otis_sci, est_format_otis_sci

    # OTIS SCI en priorité absolue (3 feuilles) — ne jamais passer par l'annexe 5
    if est_format_otis_sci(noms):
        return charger_fichier_otis_sci(data, filename, params or {})

    _excl_feuilles_otis = ("demandes", "demande", "operation de maintenance", "appareil a l arret")
    interventions = _charger_feuille_normalisee(
        data,
        noms,
        cfg.FEUILLES_INTERVENTION,
        _MAP_INTERVENTION,
        moteur,
        exclusions_colonnes=_EXCLUSIONS_COLONNES_INTERVENTION,
        exclure_feuilles=_excl_feuilles_otis,
    )
    interventions = _ajuster_colonnes_intervention(interventions)

    maintenance = _charger_feuille_normalisee(
        data, noms, cfg.FEUILLES_MAINTENANCE, _MAP_MAINTENANCE, moteur
    )
    maintenance = _ajuster_colonnes_dates(maintenance)

    parachute = _charger_feuille_normalisee(
        data, noms, cfg.FEUILLES_PARACHUTE, _MAP_TEST, moteur
    )
    parachute = _ajuster_colonnes_dates(parachute)

    cables = _charger_feuille_normalisee(
        data, noms, cfg.FEUILLES_CABLES, _MAP_TEST, moteur
    )
    cables = _ajuster_colonnes_dates(cables)

    if (
        interventions.empty
        and maintenance.empty
        and parachute.empty
        and cables.empty
    ):
        feuilles = ", ".join(noms[:12]) if noms else "(aucune)"
        raise ValueError(
            "Aucune des 4 feuilles attendues n'a été trouvée "
            "(Historique Intervention, Historique Maintenance, Test Parachute, Contrôle des Câbles). "
            f"Feuilles présentes dans le fichier : {feuilles}"
        )

    return {
        "interventions": interventions,
        "maintenance": maintenance,
        "maintenance_lignes": maintenance.copy(),
        "parachute": parachute,
        "cables": cables,
        "format": "annexe5",
    }


def charger_liste_parc(
    source: FileLike,
    filename: Optional[str] = None,
) -> pd.DataFrame:
    """Charge la liste optionnelle du parc (Ascenseur, Client, Résidence)."""
    if source is None:
        return pd.DataFrame()
    data = _vers_bytes(source)
    if len(data) < 64:
        return pd.DataFrame()
    _, moteur = _ouvrir_classeur(data, filename)
    brut = pd.read_excel(io.BytesIO(data), header=None, engine=moteur, sheet_name=0)

    idx = _trouver_ligne_entete(brut)
    entetes = brut.iloc[idx].tolist()
    df = brut.iloc[idx + 1 :].copy()
    df.columns = [str(c).strip() if pd.notna(c) else f"col_{i}" for i, c in enumerate(entetes)]
    df = df.dropna(how="all").reset_index(drop=True)

    cols_map = _colonnes_normalisees(df.columns.tolist())
    rename = {}
    for cible, mots in [
        ("ascenseur", ("ascenseur", "numero appareil", "numéro appareil")),
        ("client", ("identite client", "identité client", "client",)),
        ("marque", ("marque", "prestataire", "mainteneur")),
        ("residence", ("residence", "résidence", "adresse", "site")),
        ("type_entrainement", ("type entrainement", "type d'entrainement", "entrainement")),
    ]:
        col = _trouver_colonne(cols_map, *mots)
        if col:
            rename[col] = cible
    return df.rename(columns=rename)


def charger_dernieres_visites(
    source: FileLike,
    filename: Optional[str] = None,
) -> dict[str, str]:
    """
    Charge les dates de dernière maintenance du trimestre précédent.
    Colonnes attendues : ascenseur (ou numéro appareil) + date (dernière visite).
  """
    if source is None:
        return {}
    data = _vers_bytes(source)
    if len(data) < 32:
        return {}

    _, moteur = _ouvrir_classeur(data, filename)
    df = pd.read_excel(io.BytesIO(data), header=0, engine=moteur, sheet_name=0)
    if df.empty:
        return {}

    cols_map = _colonnes_normalisees(df.columns.tolist())
    col_asc = (
        _trouver_colonne(cols_map, "ascenseur")
        or _trouver_colonne(cols_map, "numero", "appareil")
        or _trouver_colonne(cols_map, "numéro", "appareil")
    )
    col_date = (
        _trouver_colonne(cols_map, "derniere", "visite")
        or _trouver_colonne(cols_map, "dernière", "visite")
        or _trouver_colonne(cols_map, "date", "visite")
        or _trouver_colonne(cols_map, "date")
    )
    if not col_asc or not col_date:
        raise ValueError(
            "Fichier « dernières visites » : colonnes ascenseur et date requises "
            "(ex. Ascenseur, Date dernière visite)."
        )

    out: dict[str, str] = {}
    for _, row in df.iterrows():
        asc = str(row[col_asc]).strip().upper()
        if not asc or asc.lower() == "nan":
            continue
        dt = pd.to_datetime(row[col_date], errors="coerce", dayfirst=True)
        if pd.notna(dt):
            out[asc] = dt.strftime("%Y-%m-%d")
    return out


def charger_cumul_pannes(
    source: FileLike,
    filename: Optional[str] = None,
) -> dict[str, int]:
    """
    Cumul pannes retenues des trimestres précédents (pour bilan annuel au T4).
    Colonnes : ascenseur + nombre de pannes (cumul T1…T(n-1)).
    """
    if source is None:
        return {}
    data = _vers_bytes(source)
    if len(data) < 32:
        return {}

    _, moteur = _ouvrir_classeur(data, filename)
    df = pd.read_excel(io.BytesIO(data), header=0, engine=moteur, sheet_name=0)
    if df.empty:
        return {}

    cols_map = _colonnes_normalisees(df.columns.tolist())
    col_asc = (
        _trouver_colonne(cols_map, "ascenseur")
        or _trouver_colonne(cols_map, "numero", "appareil")
        or _trouver_colonne(cols_map, "numéro", "appareil")
    )
    col_nb = (
        _trouver_colonne(cols_map, "pannes", "retenues")
        or _trouver_colonne(cols_map, "nb", "pannes")
        or _trouver_colonne(cols_map, "cumul", "pannes")
        or _trouver_colonne(cols_map, "nombre", "pannes")
    )
    if not col_asc or not col_nb:
        raise ValueError(
            "Fichier cumul pannes : colonnes ascenseur et nombre de pannes requises "
            "(ex. Ascenseur, Nb pannes retenues cumul)."
        )

    out: dict[str, int] = {}
    for _, row in df.iterrows():
        asc = str(row[col_asc]).strip().upper()
        if not asc or asc.lower() == "nan":
            continue
        nb = pd.to_numeric(row[col_nb], errors="coerce")
        if pd.notna(nb):
            out[asc] = int(nb)
    return out
