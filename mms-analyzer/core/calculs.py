# -*- coding: utf-8 -*-
"""
Logique métier : durées, classements, écarts maintenance, pénalités.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Optional

import pandas as pd

from core.parser import combiner_date_heure, normaliser_libelle
from config import parametres as cfg


def _heures_decimales(delta: Optional[pd.Timedelta]) -> Optional[float]:
    if delta is None or pd.isna(delta):
        return None
    return round(delta.total_seconds() / 3600.0, 4)


def _format_hhmm(delta: Optional[pd.Timedelta]) -> str:
    if delta is None or pd.isna(delta):
        return ""
    total_sec = int(abs(delta.total_seconds()))
    h, r = divmod(total_sec, 3600)
    m, _ = divmod(r, 60)
    sign = "-" if delta.total_seconds() < 0 else ""
    return f"{sign}{h:02d}:{m:02d}"


def _cle_appareil(row: pd.Series) -> str:
    client = str(row.get("client", "") or "").strip()
    asc = str(row.get("ascenseur", "") or "").strip()
    adr = str(row.get("adresse", "") or "").strip()
    return f"{client}|{asc}|{adr}"


def fraction_trimestre(trimestre: str) -> float:
    """Part de l'année couverte par un trimestre civil (T1–T4 = 3 mois)."""
    t = str(trimestre or "T1").strip().upper()
    if t in ("T1", "T2", "T3", "T4"):
        return 0.25
    return 0.25


def seuil_prorata_trimestre(valeur_annuelle: float, trimestre: str) -> float:
    """Convertit un seuil annuel (pannes, heures) en seuil pour le trimestre traité."""
    return float(valeur_annuelle) * fraction_trimestre(trimestre)


def _delta_jours_calendrier(dt_fin: object, dt_debut: object) -> int:
    """
    Écart en jours calendaires entre deux dates (sans troncature horaire).
    (datetime avec heures).days peut sous-estimer d'un jour (ex. 19/01 → 03/03 = 43).
    """
    d1 = pd.Timestamp(dt_debut).normalize().date()
    d2 = pd.Timestamp(dt_fin).normalize().date()
    return (d2 - d1).days


def _normaliser_ascenseur(val: object) -> str:
    return str(val or "").strip().upper()


_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _parse_date_saisie(val: object) -> pd.Timestamp:
    """
    Parse une date saisie (CRM ISO ou Excel européen).
    Les chaînes YYYY-MM-DD ne doivent pas passer par dayfirst (sinon 2026-12-01 → 12 janv.).
    """
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return pd.NaT
    if isinstance(val, pd.Timestamp):
        return val
    if isinstance(val, datetime):
        return pd.Timestamp(val)
    s = str(val).strip()
    if not s or s.lower() == "nan":
        return pd.NaT
    if _ISO_DATE.match(s):
        return pd.to_datetime(s, format="%Y-%m-%d", errors="coerce")
    return pd.to_datetime(val, errors="coerce", dayfirst=True)


def _dict_dernieres_visites(raw: Any) -> dict[str, pd.Timestamp]:
    """Normalise le dict ascenseur → date depuis params ou fichier."""
    if not raw or not isinstance(raw, dict):
        return {}
    out: dict[str, pd.Timestamp] = {}
    for cle, val in raw.items():
        asc = _normaliser_ascenseur(cle)
        if not asc:
            continue
        ts = _parse_date_saisie(val)
        if pd.notna(ts):
            out[asc] = ts
    return out


def _texte_operation_maintenance(row: pd.Series) -> str:
    """Concatène les libellés utiles (type, procédure, etc.)."""
    parts = []
    for col in ("type_maintenance", "materiel_change", "description_intervention"):
        v = row.get(col)
        if v is not None and not (isinstance(v, float) and pd.isna(v)):
            s = str(v).strip()
            if s and s.lower() != "nan":
                parts.append(s)
    return " ".join(parts)


def _est_ligne_test_parachute_cables(texte: str) -> tuple[bool, bool]:
    """Retourne (est_parachute, est_cables) selon le libellé d'opération."""
    t = normaliser_libelle(texte)
    if not t:
        return False, False
    est_para = bool(
        re.search(
            r"parachute|prise de parachute|systeme parachute|système parachute|"
            r"essai parachute|test parachute|controle.*parachute|contrôle.*parachute",
            t,
        )
    )
    est_cable = bool(re.search(r"cable|câble|traction", t))
    return est_para, est_cable


def extraire_parachute_cables_depuis_maintenance(
    maintenance: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Format OTIS SCI : les tests sont mélangés dans la feuille Maintenance.
    Filtre les opérations contenant parachute, câble ou traction.
    """
    if maintenance.empty or "type_maintenance" not in maintenance.columns:
        return pd.DataFrame(), pd.DataFrame()

    lignes_para = []
    lignes_cables = []
    for _, row in maintenance.iterrows():
        para, cab = _est_ligne_test_parachute_cables(_texte_operation_maintenance(row))
        if not para and not cab:
            continue
        base = {
            "client": row.get("client"),
            "adresse": row.get("adresse"),
            "ascenseur": row.get("ascenseur"),
            "nom_technicien": row.get("nom_technicien"),
            "type_maintenance": row.get("type_maintenance"),
        }
        dt = row.get("datetime_debut") or row.get("datetime_visite")
        if pd.notna(dt):
            ts = pd.Timestamp(dt)
            base["date_debut"] = ts.date()
            base["heure_debut"] = ts.time()
        if para:
            lignes_para.append(base.copy())
        if cab:
            lignes_cables.append(base.copy())

    para = _dedoublonner_tests_par_appareil_date(pd.DataFrame(lignes_para))
    cab = _dedoublonner_tests_par_appareil_date(pd.DataFrame(lignes_cables))
    return para, cab


def _dedoublonner_tests_par_appareil_date(df: pd.DataFrame) -> pd.DataFrame:
    """Une visite OTIS = plusieurs sous-opérations : 1 test parachute / câbles par (appareil, date)."""
    if df.empty or "ascenseur" not in df.columns:
        return df
    d = df.copy()
    if "date_debut" not in d.columns:
        return d
    d["_date"] = pd.to_datetime(d["date_debut"], errors="coerce", dayfirst=True).dt.date
    d["_asc"] = d["ascenseur"].astype(str).str.strip().str.upper()
    d = d.dropna(subset=["_date", "_asc"])
    d = d.sort_values(["_asc", "_date"])
    return d.drop_duplicates(subset=["_asc", "_date"], keep="first").drop(
        columns=["_date", "_asc"], errors="ignore"
    )


def _resoudre_datetime_appel(row: pd.Series) -> Optional[datetime]:
    """Date/heure d'appel : colonne combinée ou date + heure séparées."""
    if "date_appel" in row.index:
        val = row["date_appel"]
        if isinstance(val, datetime):
            return val
        dt = combiner_date_heure(val, row.get("heure_appel"))
        if dt:
            return dt
    return combiner_date_heure(row.get("date_appel"), row.get("heure_appel"))


def _minutes_vers_timedelta(series: pd.Series) -> pd.Series:
    mins = pd.to_numeric(series, errors="coerce")
    return pd.to_timedelta(mins, unit="m")


def enrichir_interventions(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calcule datetimes, durées, tranches.
    Priorité aux durées fournies par OTIS SCI (minutes) si présentes.
    """
    if df.empty:
        return df.copy()

    out = df.copy()

    for col in ("datetime_appel", "datetime_arrivee", "datetime_fin"):
        if col in out.columns:
            out[col] = pd.to_datetime(out[col], errors="coerce", dayfirst=True)

    if "datetime_appel" not in out.columns:
        datetimes_appel = []
        for _, row in out.iterrows():
            datetimes_appel.append(_resoudre_datetime_appel(row))
        out["datetime_appel"] = pd.to_datetime(datetimes_appel, errors="coerce", dayfirst=True)

    if "datetime_arrivee" not in out.columns:
        out["datetime_arrivee"] = out.apply(
            lambda r: combiner_date_heure(r.get("date_debut"), r.get("heure_debut")),
            axis=1,
        )
        out["datetime_arrivee"] = pd.to_datetime(out["datetime_arrivee"], errors="coerce", dayfirst=True)

    if "datetime_fin" not in out.columns:
        out["datetime_fin"] = out.apply(
            lambda r: combiner_date_heure(r.get("date_fin"), r.get("heure_fin")),
            axis=1,
        )
        out["datetime_fin"] = pd.to_datetime(out["datetime_fin"], errors="coerce", dayfirst=True)

    # Délai d'intervention : colonnes minutes OTIS en priorité
    if "delai_intervention_min" in out.columns:
        out["temps_intervention"] = _minutes_vers_timedelta(out["delai_intervention_min"])
    else:
        out["temps_intervention"] = out["datetime_arrivee"] - out["datetime_appel"]

    if "duree_hors_service_min" in out.columns:
        out["temps_indisponibilite"] = _minutes_vers_timedelta(out["duree_hors_service_min"])
    else:
        out["temps_indisponibilite"] = out["datetime_fin"] - out["datetime_appel"]

    out["temps_reparation"] = out["datetime_fin"] - out["datetime_arrivee"]

    for prefix, col in [
        ("intervention", "temps_intervention"),
        ("reparation", "temps_reparation"),
        ("indisponibilite", "temps_indisponibilite"),
    ]:
        out[f"{prefix}_h"] = out[col].apply(_heures_decimales)
        out[f"{prefix}_hhmm"] = out[col].apply(_format_hhmm)

    out["tranche_delai"] = out["temps_intervention"].apply(classer_tranche_delai)
    return out


def classer_tranche_delai(delta: Optional[pd.Timedelta]) -> str:
    """Répartition des délais d'intervention."""
    h = _heures_decimales(delta)
    if h is None:
        return "inconnu"
    if h < 1:
        return "< 1h"
    if h < 2:
        return "1 à 2h"
    if h < 4:
        return "2 à 4h"
    return "> 4h"


def classifier_interventions(
    df: pd.DataFrame,
    table_classement: dict[str, str],
) -> pd.DataFrame:
    """Ajoute panne_retenue, personne_bloquee, asc_sans_panne."""
    if df.empty:
        return df.copy()

    out = df.copy()
    retenues = []
    bloquees = []
    sans_panne = []

    for _, row in out.iterrows():
        type_p = normaliser_libelle(row.get("type_panne", ""))
        cause = normaliser_libelle(row.get("cause_panne", ""))
        texte = f"{type_p} {cause}"

        cat = table_classement.get(type_p)
        if cat is None:
            cat = table_classement.get(type_p.replace("é", "e"), "non_retenue")
        retenues.append(cat == "retenue")

        bloque = (
            "desincarceration" in texte.replace("é", "e")
            or "désincarcération" in type_p
            or type_p == "desincarceration"
            or ("passager" in cause and ("bloque" in cause or "bloqué" in cause))
        )
        bloquees.append(bloque)

        sans_panne.append(
            "pas de panne" in type_p or "en fonction" in type_p
        )

    out["panne_retenue"] = retenues
    out["personne_bloquee"] = bloquees
    out["asc_sans_panne"] = sans_panne
    return out


def enrichir_maintenance(
    df: pd.DataFrame,
    seuil_jours: int = cfg.SEUIL_ECART_MAINTENANCE_JOURS,
    dernieres_visites: Optional[dict[str, Any]] = None,
) -> tuple[pd.DataFrame, list[str]]:
    """
    Calcule Δ entre visites consécutives par appareil (jours calendaires).
    Seuil contractuel : delta strictement > seuil_jours (ex. > 42 j).
    La première visite du trimestre peut s'appuyer sur « dernieres_visites » (T-1).
    """
    avertissements: list[str] = []
    if df.empty:
        return df.copy(), avertissements

    refs_t4 = _dict_dernieres_visites(dernieres_visites)

    out = df.copy()
    if "datetime_debut" in out.columns:
        out["datetime_visite"] = pd.to_datetime(out["datetime_debut"], errors="coerce", dayfirst=True)
    else:
        out["datetime_visite"] = out.apply(
            lambda r: combiner_date_heure(r.get("date_debut"), r.get("heure_debut")),
            axis=1,
        )
        out["datetime_visite"] = pd.to_datetime(out["datetime_visite"], errors="coerce", dayfirst=True)
    out["cle_appareil"] = out.apply(_cle_appareil, axis=1)

    deltas: list[tuple[Any, Any]] = []
    ecart_signale: list[tuple[Any, bool]] = []
    jours_retard: list[tuple[Any, Any]] = []
    delta_ref: list[tuple[Any, str]] = []
    statuts: list[tuple[Any, str]] = []

    for _, groupe in out.sort_values("datetime_visite").groupby("cle_appareil"):
        asc = _normaliser_ascenseur(groupe.iloc[0].get("ascenseur"))
        prev_visite: Optional[pd.Timestamp] = refs_t4.get(asc)
        ref_initiale = "trimestre_precedent" if prev_visite is not None else None
        premiere_visite = groupe["datetime_visite"].min()

        if (
            prev_visite is not None
            and pd.notna(premiere_visite)
            and pd.Timestamp(prev_visite).normalize() > pd.Timestamp(premiere_visite).normalize()
        ):
            avertissements.append(
                f"{asc} : date de référence T-1 ({pd.Timestamp(prev_visite).date()}) postérieure à la "
                f"première visite du trimestre ({pd.Timestamp(premiere_visite).date()}) — référence ignorée."
            )
            prev_visite = None
            ref_initiale = None

        for idx, row in groupe.iterrows():
            dt = row["datetime_visite"]
            if prev_visite is not None and pd.notna(dt):
                ref_ts = pd.Timestamp(prev_visite).normalize()
                vis_ts = pd.Timestamp(dt).normalize()
                if ref_ts > vis_ts:
                    msg = (
                        f"{asc} : date de référence T-1 ({ref_ts.date()}) postérieure à la visite "
                        f"du {vis_ts.date()} — Δ non calculé."
                    )
                    avertissements.append(msg)
                    deltas.append((idx, None))
                    delta_ref.append((idx, "reference_posterieure"))
                    statuts.append((idx, "donnees_incoherentes"))
                    ecart_signale.append((idx, False))
                    jours_retard.append((idx, None))
                    ref_initiale = None
                else:
                    delta_j = _delta_jours_calendrier(dt, prev_visite)
                    deltas.append((idx, delta_j))
                    ref_lbl = ref_initiale or "visite_precedente"
                    delta_ref.append((idx, ref_lbl))
                    if delta_j < 0:
                        avertissements.append(
                            f"{asc} : Δ négatif ({delta_j} j) — vérifiez la date de référence T-1."
                        )
                        statuts.append((idx, "donnees_incoherentes"))
                        ecart_signale.append((idx, False))
                        jours_retard.append((idx, None))
                    else:
                        statuts.append((idx, "evalue"))
                        if delta_j > seuil_jours:
                            ecart_signale.append((idx, True))
                            jours_retard.append((idx, delta_j - seuil_jours))
                        else:
                            ecart_signale.append((idx, False))
                            jours_retard.append((idx, 0))
                    ref_initiale = None
            else:
                deltas.append((idx, None))
                delta_ref.append((idx, "non_renseigne"))
                statuts.append((idx, "non_evaluable"))
                ecart_signale.append((idx, False))
                jours_retard.append((idx, None))
            if pd.notna(dt):
                prev_visite = pd.Timestamp(dt)
                ref_initiale = None

    out["delta_jours"] = pd.NA
    out["delta_reference"] = ""
    out["statut_delta"] = ""
    out["ecart_signale"] = False
    out["jours_retard"] = pd.NA
    for idx, val in deltas:
        out.at[idx, "delta_jours"] = val
    for idx, val in delta_ref:
        out.at[idx, "delta_reference"] = val
    for idx, val in statuts:
        out.at[idx, "statut_delta"] = val
    for idx, val in ecart_signale:
        out.at[idx, "ecart_signale"] = val
    for idx, val in jours_retard:
        out.at[idx, "jours_retard"] = val

    # Libellé lisible pour l'export Excel
    libelles = {
        "evalue": "Évalué",
        "non_evaluable": "Non évaluable",
        "donnees_incoherentes": "Données incohérentes",
    }
    out["statut_delta_libelle"] = out["statut_delta"].map(
        lambda s: libelles.get(str(s), str(s))
    )

    return out, avertissements


def matrice_pannes_mois(df: pd.DataFrame) -> pd.DataFrame:
    """Matrice appareil × mois du nombre de pannes retenues."""
    if df.empty or "panne_retenue" not in df.columns:
        return pd.DataFrame()

    subset = df[df["panne_retenue"]].copy()
    if subset.empty:
        return pd.DataFrame()

    subset["datetime_appel"] = pd.to_datetime(subset["datetime_appel"], errors="coerce")
    subset = subset.dropna(subset=["datetime_appel"])
    subset["mois"] = subset["datetime_appel"].dt.to_period("M").astype(str)
    subset["cle_appareil"] = subset.apply(_cle_appareil, axis=1)

    pivot = (
        subset.groupby(["cle_appareil", "ascenseur", "client", "adresse", "mois"])
        .size()
        .unstack(fill_value=0)
    )
    return pivot.reset_index() if not pivot.empty else pd.DataFrame()


def synthese_par_appareil(df: pd.DataFrame) -> pd.DataFrame:
    """Synthèse par appareil : comptages et cumuls de durées."""
    if df.empty:
        return pd.DataFrame()

    df = df.copy()
    df["cle_appareil"] = df.apply(_cle_appareil, axis=1)
    lignes = []

    for cle, grp in df.groupby("cle_appareil"):
        row0 = grp.iloc[0]
        nb_retenues = int(grp["panne_retenue"].sum()) if "panne_retenue" in grp.columns else 0
        tranches = grp["tranche_delai"].value_counts().to_dict() if "tranche_delai" in grp.columns else {}

        def _sum_h(col: str) -> float:
            if col not in grp.columns:
                return 0.0
            return float(grp[col].fillna(0).sum())

        lignes.append(
            {
                "cle_appareil": cle,
                "client": row0.get("client"),
                "ascenseur": row0.get("ascenseur"),
                "adresse": row0.get("adresse"),
                "nb_interventions": len(grp),
                "nb_pannes_retenues": nb_retenues,
                "tranche_<1h": tranches.get("< 1h", 0),
                "tranche_1_2h": tranches.get("1 à 2h", 0),
                "tranche_2_4h": tranches.get("2 à 4h", 0),
                "tranche_>4h": tranches.get("> 4h", 0),
                "cumul_intervention_h": _sum_h("intervention_h"),
                "cumul_reparation_h": _sum_h("reparation_h"),
                "cumul_indisponibilite_h": _sum_h("indisponibilite_h"),
            }
        )
    return pd.DataFrame(lignes)


def suivi_parachute_cables(
    parachute: pd.DataFrame,
    cables: pd.DataFrame,
    seuil_para_mois: int = cfg.SEUIL_PARACHUTE_MOIS,
    seuil_cables_mois: int = cfg.SEUIL_CABLES_MOIS,
    date_debut_periode: Optional[datetime] = None,
    date_fin_periode: Optional[datetime] = None,
) -> pd.DataFrame:
    """Suivi par appareil : tests réalisés / manquants, écarts entre contrôles."""
    appareils: dict[str, dict[str, Any]] = {}

    def _enregistrer(df: pd.DataFrame, type_test: str) -> None:
        if df.empty:
            return
        for _, row in df.iterrows():
            cle = _cle_appareil(row)
            if cle not in appareils:
                appareils[cle] = {
                    "client": row.get("client"),
                    "ascenseur": row.get("ascenseur"),
                    "adresse": row.get("adresse"),
                    "nb_parachute": 0,
                    "nb_cables": 0,
                    "dernier_parachute": None,
                    "dernier_cables": None,
                    "alerte_parachute": False,
                    "alerte_cables": False,
                }
            dt = combiner_date_heure(row.get("date_debut"), row.get("heure_debut"))
            if dt is None:
                dt = combiner_date_heure(row.get("date_fin"), row.get("heure_fin"))
            if type_test == "parachute":
                appareils[cle]["nb_parachute"] += 1
                prev = appareils[cle]["dernier_parachute"]
                if prev and dt:
                    mois = (dt - prev).days / 30.44
                    if mois > seuil_para_mois:
                        appareils[cle]["alerte_parachute"] = True
                if dt and (prev is None or dt > prev):
                    appareils[cle]["dernier_parachute"] = dt
            else:
                appareils[cle]["nb_cables"] += 1
                prev = appareils[cle]["dernier_cables"]
                if prev and dt:
                    mois = (dt - prev).days / 30.44
                    if mois > seuil_cables_mois:
                        appareils[cle]["alerte_cables"] = True
                if dt and (prev is None or dt > prev):
                    appareils[cle]["dernier_cables"] = dt

    _enregistrer(parachute, "parachute")
    _enregistrer(cables, "cables")

    lignes = []
    for cle, info in appareils.items():
        manque_para = info["nb_parachute"] == 0
        manque_cables = info["nb_cables"] == 0
        lignes.append(
            {
                "cle_appareil": cle,
                **info,
                "parachute_manquant": manque_para,
                "cables_manquant": manque_cables,
            }
        )
    return pd.DataFrame(lignes)


def appareils_parc_sans_activite(
    parc: Optional[pd.DataFrame],
    interventions: pd.DataFrame,
    maintenance: pd.DataFrame,
) -> pd.DataFrame:
    """Signale les appareils du parc sans intervention ni visite."""
    if parc is None or parc.empty or "ascenseur" not in parc.columns:
        return pd.DataFrame()

    actifs = set()
    for df in (interventions, maintenance):
        if not df.empty and "ascenseur" in df.columns:
            for _, r in df.iterrows():
                actifs.add(
                    (
                        str(r.get("client", "")).strip(),
                        str(r.get("ascenseur", "")).strip(),
                    )
                )

    orphelins = []
    for _, r in parc.iterrows():
        cle = (str(r.get("client", "")).strip(), str(r.get("ascenseur", "")).strip())
        if cle not in actifs:
            orphelins.append(r.to_dict())
    return pd.DataFrame(orphelins)


def _trimestre_num(trimestre: str) -> int:
    t = str(trimestre or "T1").strip().upper()
    if t in ("T1", "T2", "T3", "T4"):
        return int(t[1])
    return 1


def libelle_mode_pannes(mode: str, prorata: bool) -> str:
    """Libellé UI pour le mode d'application du seuil pannes."""
    if prorata or mode == "prorata_trimestriel":
        return "Mode : prorata trimestriel (0,5 panne / trimestre)"
    if mode == "glissant_12_mois":
        return "Mode : annuel 12 mois glissants"
    if mode in ("annuel_avec_cumul", "annuel_sans_cumul"):
        return "Mode : annuel (bilan T4 avec cumul trimestres)"
    return "Mode : annuel — indicateur seul (historique 12 mois manquant ou T1–T3)"


def libelle_mode_immobilisation(mode: str, prorata: bool) -> str:
    """Libellé UI pour le mode d'application du seuil immobilisation."""
    if prorata or mode == "prorata_trimestriel":
        return "Mode : prorata trimestriel (12 h / trimestre / appareil)"
    if mode == "annuel_t4":
        return "Mode : annuel (cumul 4 trimestres au T4)"
    return "Mode : annuel — indicateur seul (pénalité au T4 ou prorata optionnel)"


def _pannes_retenues_par_appareil(interventions: pd.DataFrame) -> dict[str, int]:
    """Nombre de pannes retenues par ascenseur sur le périmètre fourni."""
    if interventions.empty or "panne_retenue" not in interventions.columns:
        return {}
    inter = interventions[interventions["panne_retenue"]].copy()
    if inter.empty or "ascenseur" not in inter.columns:
        return {}
    comptes: dict[str, int] = {}
    for asc, grp in inter.groupby(inter["ascenseur"].astype(str).str.strip().str.upper()):
        if asc and asc != "NAN":
            comptes[asc] = len(grp)
    return comptes


def _date_fin_trimestre(trimestre: str, annee: int) -> pd.Timestamp:
    """Dernier jour civil du trimestre."""
    t = _trimestre_num(trimestre)
    mois_fin = t * 3
    dernier_jour = pd.Timestamp(year=annee, month=mois_fin, day=1) + pd.offsets.MonthEnd(0)
    return dernier_jour.normalize()


def _historique_couvre_12_mois(interventions: pd.DataFrame, date_fin: pd.Timestamp) -> bool:
    """True si les données remontent au moins sur 12 mois avant date_fin."""
    if interventions.empty or "datetime_appel" not in interventions.columns:
        return False
    dates = pd.to_datetime(interventions["datetime_appel"], errors="coerce", dayfirst=True).dropna()
    if dates.empty:
        return False
    debut_requis = date_fin - pd.DateOffset(months=12) + pd.Timedelta(days=1)
    return pd.Timestamp(dates.min()).normalize() <= debut_requis.normalize()


def _pannes_glissant_12_mois(
    interventions: pd.DataFrame,
    date_fin: pd.Timestamp,
) -> dict[str, int]:
    """Compte les pannes retenues par appareil sur les 12 mois glissants se terminant à date_fin."""
    if interventions.empty or "panne_retenue" not in interventions.columns:
        return {}
    inter = interventions[interventions["panne_retenue"]].copy()
    if inter.empty or "datetime_appel" not in inter.columns:
        return {}
    inter["datetime_appel"] = pd.to_datetime(inter["datetime_appel"], errors="coerce", dayfirst=True)
    inter = inter.dropna(subset=["datetime_appel"])
    debut = date_fin - pd.DateOffset(months=12) + pd.Timedelta(days=1)
    inter = inter[(inter["datetime_appel"] >= debut) & (inter["datetime_appel"] <= date_fin + pd.Timedelta(days=1))]
    return _pannes_retenues_par_appareil(inter)


def _appareils_seuil_annuel_atteint(
    comptes_trimestre: dict[str, int],
    seuil_annuel: float,
    cumul_precedent: Optional[dict[str, int]] = None,
) -> list[dict[str, Any]]:
    """
    Voyant rouge : seuil annuel déjà atteint sur le trimestre seul ou cumul T1–T3 + trimestre.
    """
    ascenseurs = set(comptes_trimestre) | set(cumul_precedent or {})
    lignes = []
    for asc in sorted(ascenseurs):
        nb_trim = comptes_trimestre.get(asc, 0)
        nb_cumul = int((cumul_precedent or {}).get(asc, 0))
        nb_total = nb_trim + nb_cumul
        seuil_trim_atteint = nb_trim >= seuil_annuel
        seuil_annuel_atteint = nb_total > seuil_annuel
        if seuil_trim_atteint or seuil_annuel_atteint:
            lignes.append(
                {
                    "ascenseur": asc,
                    "nb_pannes_trimestre": nb_trim,
                    "nb_pannes_cumul_precedent": nb_cumul,
                    "nb_pannes_total": nb_total,
                    "seuil_annuel": seuil_annuel,
                    "voyant_seuil_trimestre": seuil_trim_atteint,
                    "voyant_exces_annuel": seuil_annuel_atteint,
                }
            )
    return lignes


def calculer_penalites(
    interventions: pd.DataFrame,
    maintenance: pd.DataFrame,
    params: dict[str, float],
    arrets: Optional[pd.DataFrame] = None,
) -> dict[str, Any]:
    """
    Calcule les 4 postes de pénalité et le total.
    params : seuils et tarifs issus de l'interface.
    """
    trimestre = str(params.get("trimestre", "T1"))
    t_num = _trimestre_num(trimestre)
    prorata_immo = bool(params.get("prorata_immo_trimestriel", False))
    prorata_pannes = bool(params.get("prorata_pannes_trimestriel", False))

    seuil_j = int(params.get("seuil_maintenance_jours", cfg.SEUIL_ECART_MAINTENANCE_JOURS))
    seuil_pannes_annuel = float(params.get("seuil_pannes_an", cfg.SEUIL_PANNES_PAR_AN_APPAREIL))
    seuil_immo_annuel = float(params.get("seuil_immo_h", cfg.SEUIL_IMMOBILISATION_HEURES_AN))
    seuil_delai = float(params.get("seuil_delai_h", cfg.SEUIL_DELAI_INTERVENTION_HEURES))

    tarif_j = float(params.get("tarif_jour", cfg.TARIF_PENALITE_JOUR_MAINTENANCE))
    tarif_panne = float(params.get("tarif_panne", cfg.TARIF_PENALITE_PANNE))
    tarif_immo = float(params.get("tarif_heure_immo", cfg.TARIF_PENALITE_HEURE_IMMOBILISATION))
    tarif_delai = float(params.get("tarif_heure_delai", cfg.TARIF_PENALITE_HEURE_DELAI))

    # Maintenance : jours de retard cumulés (N/A si Δ non calculable — pas de 0 implicite)
    jours_retard_total = 0
    nb_lignes_non_evaluables = 0
    if not maintenance.empty and "jours_retard" in maintenance.columns:
        jr = pd.to_numeric(maintenance["jours_retard"], errors="coerce").dropna()
        jours_retard_total = int(jr.sum())
    nb_lignes_incoherentes = 0
    if not maintenance.empty and "statut_delta" in maintenance.columns:
        nb_lignes_non_evaluables = int((maintenance["statut_delta"] == "non_evaluable").sum())
        nb_lignes_incoherentes = int((maintenance["statut_delta"] == "donnees_incoherentes").sum())

    penalite_maintenance = jours_retard_total * tarif_j

    # --- Pannes : 2/an — pas de pénalité T1–T3 sans cumul ; bilan annuel au T4 avec import ---
    cumul_pannes = params.get("cumul_pannes_par_appareil") or {}
    if not isinstance(cumul_pannes, dict):
        cumul_pannes = {}
    cumul_pannes = {_normaliser_ascenseur(k): int(v) for k, v in cumul_pannes.items() if v is not None}
    cumuler_trimestres = bool(params.get("cumuler_trimestres_precedents", False))

    annee = int(params.get("annee", pd.Timestamp.today().year))
    date_fin = _date_fin_trimestre(trimestre, annee)

    comptes_trim = _pannes_retenues_par_appareil(interventions)
    voyants = _appareils_seuil_annuel_atteint(comptes_trim, seuil_pannes_annuel, None)
    nb_voyant_seuil_trim = sum(1 for v in voyants if v.get("voyant_seuil_trimestre"))

    historique = params.get("interventions_historique")
    if isinstance(historique, pd.DataFrame) and not historique.empty:
        inter_hist = historique
    else:
        inter_hist = interventions

    comptes_12m = _pannes_glissant_12_mois(inter_hist, date_fin)
    historique_12m_disponible = bool(params.get("historique_12_mois_force")) or _historique_couvre_12_mois(
        inter_hist, date_fin
    )

    mode_pannes = "indicateur_sans_penalite"
    mention_pannes = (
        "Seuil non évaluable — historique 12 mois manquant. "
        "Indicateur trimestriel affiché sans pénalité (seuil 2/an)."
    )
    seuil_pannes_effectif = seuil_pannes_annuel
    nb_pannes_excedentaires = 0
    penalite_pannes = 0.0

    if prorata_pannes:
        mode_pannes = "prorata_trimestriel"
        mention_pannes = "Prorata trimestriel actif (seuil ÷ 4 = 0,5 panne/Q)."
        seuil_pannes_effectif = seuil_prorata_trimestre(seuil_pannes_annuel, trimestre)
        for asc, nb in comptes_trim.items():
            if nb > seuil_pannes_effectif:
                nb_pannes_excedentaires += 1
        penalite_pannes = nb_pannes_excedentaires * tarif_panne
    elif historique_12m_disponible and comptes_12m and t_num > 1:
        mode_pannes = "glissant_12_mois"
        mention_pannes = (
            f"Pénalité sur fenêtre glissante 12 mois se terminant le {date_fin.date():%d/%m/%Y}."
        )
        seuil_pannes_effectif = seuil_pannes_annuel
        for asc, nb in comptes_12m.items():
            if nb > seuil_pannes_annuel:
                nb_pannes_excedentaires += 1
        penalite_pannes = nb_pannes_excedentaires * tarif_panne
        voyants = _appareils_seuil_annuel_atteint(comptes_trim, seuil_pannes_annuel, None)
    elif t_num == 4 and cumuler_trimestres and cumul_pannes:
        mode_pannes = "annuel_avec_cumul"
        mention_pannes = "Bilan annuel T1–T4 (cumul importé + trimestre courant)."
        seuil_pannes_effectif = seuil_pannes_annuel
        voyants = _appareils_seuil_annuel_atteint(comptes_trim, seuil_pannes_annuel, cumul_pannes)
        for asc in set(comptes_trim) | set(cumul_pannes):
            nb_total = comptes_trim.get(asc, 0) + cumul_pannes.get(asc, 0)
            if nb_total > seuil_pannes_annuel:
                nb_pannes_excedentaires += 1
        penalite_pannes = nb_pannes_excedentaires * tarif_panne
    elif t_num == 4:
        mode_pannes = "annuel_sans_cumul"
        mention_pannes = (
            "T4 sans fichier de cumul des trimestres précédents — pénalité pannes non appliquée."
        )
        voyants = _appareils_seuil_annuel_atteint(comptes_trim, seuil_pannes_annuel, None)
    else:
        voyants = _appareils_seuil_annuel_atteint(comptes_trim, seuil_pannes_annuel, None)

    # --- Immobilisation : désactivée T1–T3 sauf prorata explicite ; annuelle au T4 ---
    mode_immo = "desactive_hors_t4"
    heures_immo_excedentaires = 0.0
    seuil_immo_effectif = 0.0
    penalite_immo = 0.0

    if prorata_immo:
        mode_immo = "prorata_trimestriel"
        seuil_immo_effectif = seuil_prorata_trimestre(seuil_immo_annuel, trimestre)
    elif t_num == 4:
        mode_immo = "annuel_t4"
        seuil_immo_effectif = seuil_immo_annuel
    else:
        seuil_immo_effectif = 0.0

    if seuil_immo_effectif > 0 and (
        prorata_immo or t_num == 4
    ):
        if not interventions.empty and "indisponibilite_h" in interventions.columns:
            inter = interventions.copy()
            inter["datetime_appel"] = pd.to_datetime(inter["datetime_appel"], errors="coerce", dayfirst=True)
            inter = inter.dropna(subset=["datetime_appel"])
            inter["cle_appareil"] = inter.apply(_cle_appareil, axis=1)
            inter["annee"] = inter["datetime_appel"].dt.year
            for (_, annee), grp in inter.groupby(["cle_appareil", "annee"]):
                total_h = grp["indisponibilite_h"].fillna(0).sum()
                heures_immo_excedentaires += max(0.0, total_h - seuil_immo_effectif)

        if arrets is not None and not arrets.empty:
            ar = arrets.copy()
            if "datetime_debut_arret" in ar.columns and "datetime_fin_arret" in ar.columns:
                ar["datetime_debut_arret"] = pd.to_datetime(
                    ar["datetime_debut_arret"], errors="coerce", dayfirst=True
                )
                ar["datetime_fin_arret"] = pd.to_datetime(
                    ar["datetime_fin_arret"], errors="coerce", dayfirst=True
                )
                ar["duree_h"] = (
                    ar["datetime_fin_arret"] - ar["datetime_debut_arret"]
                ).dt.total_seconds() / 3600.0
                ar["cle_appareil"] = ar.apply(_cle_appareil, axis=1)
                ar["annee"] = ar["datetime_debut_arret"].dt.year
                for (_, annee), grp in ar.groupby(["cle_appareil", "annee"]):
                    total_h = grp["duree_h"].fillna(0).sum()
                    heures_immo_excedentaires += max(0.0, total_h - seuil_immo_effectif)

        penalite_immo = heures_immo_excedentaires * tarif_immo

    # Délai d'intervention : heures au-delà du seuil (2 h) — hors désincarcération (seuil 45 min séparé)
    heures_delai_excedentaires = 0.0
    if not interventions.empty and "intervention_h" in interventions.columns:
        for _, row in interventions.iterrows():
            if row.get("personne_bloquee"):
                continue
            if "panne_retenue" in interventions.columns and not row.get("panne_retenue"):
                continue
            h = row.get("intervention_h")
            if h is not None and not pd.isna(h) and h > seuil_delai:
                heures_delai_excedentaires += h - seuil_delai

    penalite_delai = heures_delai_excedentaires * tarif_delai

    total = penalite_maintenance + penalite_pannes + penalite_immo + penalite_delai

    return {
        "penalite_maintenance": float(round(penalite_maintenance, 2)),
        "penalite_pannes": float(round(penalite_pannes, 2)),
        "penalite_immobilisation": float(round(penalite_immo, 2)),
        "penalite_delai_intervention": float(round(penalite_delai, 2)),
        "penalite_totale": float(round(total, 2)),
        "detail": {
            "jours_retard_maintenance": int(jours_retard_total),
            "nb_pannes_excedentaires": int(nb_pannes_excedentaires),
            "nb_appareils_seuil_annuel_atteint": int(nb_voyant_seuil_trim),
            "nb_appareils_exces_annuel_cumul": int(
                sum(1 for v in voyants if v.get("voyant_exces_annuel"))
            ),
            "mention_pannes": mention_pannes,
            "appareils_voyant_pannes": voyants,
            "nb_lignes_maintenance_non_evaluables": int(nb_lignes_non_evaluables),
            "nb_lignes_maintenance_incoherentes": int(nb_lignes_incoherentes),
            "heures_immo_excedentaires": float(round(heures_immo_excedentaires, 2)),
            "heures_delai_excedentaires": float(round(heures_delai_excedentaires, 2)),
            "seuil_pannes_effectif": round(seuil_pannes_effectif, 2),
            "seuil_immo_effectif_h": round(seuil_immo_effectif, 2),
            "seuil_pannes_annuel": seuil_pannes_annuel,
            "seuil_immo_annuel_h": seuil_immo_annuel,
            "trimestre": trimestre,
            "mode_pannes": mode_pannes,
            "mode_immobilisation": mode_immo,
            "libelle_mode_pannes": libelle_mode_pannes(mode_pannes, prorata_pannes),
            "libelle_mode_immobilisation": libelle_mode_immobilisation(mode_immo, prorata_immo),
            "prorata_pannes_trimestriel": prorata_pannes,
            "prorata_immo_trimestriel": prorata_immo,
            "penalite_pannes_appliquee": penalite_pannes > 0,
            "penalite_immo_appliquee": penalite_immo > 0,
            "historique_12_mois_disponible": historique_12m_disponible,
            "nb_pannes_glissant_12m": sum(comptes_12m.values()) if comptes_12m else 0,
        },
    }


def filtrer_perimetre(
    dfs: dict[str, pd.DataFrame],
    client: Optional[str] = None,
    adresse: Optional[str] = None,
) -> dict[str, pd.DataFrame]:
    """Filtre toutes les feuilles par client et/ou site."""
    out = {}
    for nom, df in dfs.items():
        if not isinstance(df, pd.DataFrame):
            continue
        if df.empty:
            out[nom] = df
            continue
        f = df.copy()
        if client and client != "Tous" and "client" in f.columns:
            f = f[f["client"].astype(str).str.strip().str.upper() == client.strip().upper()]
        if adresse and adresse != "Tous" and "adresse" in f.columns:
            f = f[f["adresse"].astype(str).str.strip() == adresse.strip()]
        out[nom] = f.reset_index(drop=True)
    return out


def indicateurs_desincarceration(
    interventions: pd.DataFrame,
    seuil_minutes: int = cfg.SEUIL_DESINCARCERATION_MINUTES,
) -> pd.DataFrame:
    """Interventions avec personne bloquée et délai vs seuil contractuel."""
    if interventions.empty or "personne_bloquee" not in interventions.columns:
        return pd.DataFrame()

    desinc = interventions[interventions["personne_bloquee"]].copy()
    if desinc.empty:
        return desinc

    desinc["delai_minutes"] = desinc["temps_intervention"].apply(
        lambda t: t.total_seconds() / 60.0 if pd.notna(t) else None
    )
    desinc["hors_delai_45min"] = desinc["delai_minutes"].apply(
        lambda m: m is not None and m > seuil_minutes
    )
    return desinc


def construire_resultats(
    donnees: dict[str, pd.DataFrame],
    parc: pd.DataFrame,
    params: dict[str, Any],
) -> dict[str, Any]:
    """Pipeline complet : enrichissement, synthèses, pénalités."""
    table = params.get("table_classement", cfg.TABLE_CLASSEMENT_PANNES_DEFAUT)

    interventions = enrichir_interventions(donnees.get("interventions", pd.DataFrame()))
    interventions = classifier_interventions(interventions, table)

    maint_visites = donnees.get("maintenance", pd.DataFrame())
    maint_lignes = donnees.get("maintenance_lignes", maint_visites)
    maintenance, avertissements_delta = enrichir_maintenance(
        maint_visites,
        int(params.get("seuil_maintenance_jours", cfg.SEUIL_ECART_MAINTENANCE_JOURS)),
        dernieres_visites=params.get("dernieres_visites"),
    )

    parachute = donnees.get("parachute", pd.DataFrame())
    cables = donnees.get("cables", pd.DataFrame())
    if (parachute.empty and cables.empty) and not maint_lignes.empty:
        parachute, cables = extraire_parachute_cables_depuis_maintenance(maint_lignes)

    synthese = synthese_par_appareil(interventions)
    matrice = matrice_pannes_mois(interventions)
    suivi_tests = suivi_parachute_cables(
        parachute,
        cables,
        int(params.get("seuil_parachute_mois", cfg.SEUIL_PARACHUTE_MOIS)),
        int(params.get("seuil_cables_mois", cfg.SEUIL_CABLES_MOIS)),
    )
    arrets = donnees.get("arrets", pd.DataFrame())
    penalites = calculer_penalites(interventions, maintenance, params, arrets=arrets)
    parc_orphelins = appareils_parc_sans_activite(parc, interventions, maintenance)
    desinc = indicateurs_desincarceration(
        interventions,
        int(params.get("seuil_desincarc_min", cfg.SEUIL_DESINCARCERATION_MINUTES)),
    )

    return {
        "interventions": interventions,
        "maintenance": maintenance,
        "parachute": parachute,
        "cables": cables,
        "arrets": arrets if isinstance(arrets, pd.DataFrame) else pd.DataFrame(),
        "synthese_appareils": synthese,
        "matrice_pannes": matrice,
        "suivi_tests": suivi_tests,
        "penalites": penalites,
        "parc_orphelins": parc_orphelins,
        "desincarceration": desinc,
        "avertissements_delta": avertissements_delta,
    }
