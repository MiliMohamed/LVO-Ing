# -*- coding: utf-8 -*-
"""
Génération des graphiques PNG (charte LVO) et chemins pour intégration Excel / Word.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Optional

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import pandas as pd
logger = logging.getLogger(__name__)

CHARTE = {
    "navy": "#1F3A5F",
    "orange": "#E67E22",
    "vert": "#27AE60",
    "rouge": "#C0392B",
    "gris": "#95A5A6",
    "gris_clair": "#ECF0F1",
    "palette": ["#1F3A5F", "#E67E22", "#27AE60", "#C0392B", "#3498DB", "#9B59B6"],
    "tranches": {
        "< 1h": "#27AE60",
        "1 à 2h": "#2ECC71",
        "2 à 4h": "#F39C12",
        "> 4h": "#E67E22",
        "inconnu": "#95A5A6",
    },
}

_RC = {
    "figure.facecolor": "white",
    "axes.facecolor": "#FAFBFC",
    "axes.edgecolor": "#D5D8DC",
    "axes.labelcolor": "#1F3A5F",
    "axes.titleweight": "bold",
    "axes.titlesize": 11,
    "axes.labelsize": 9,
    "xtick.labelsize": 8,
    "ytick.labelsize": 8,
    "font.family": "sans-serif",
    "font.sans-serif": ["Segoe UI", "Arial", "DejaVu Sans"],
    "grid.color": "#E5E8EB",
    "grid.linestyle": "-",
    "grid.linewidth": 0.6,
}


def _titre(client: str, prestataire: str, trimestre: str, annee: int, sous_titre: str) -> str:
    return f"{sous_titre}\n{client} × {prestataire} — {trimestre} {annee}"


def _dossier_figures(base: Path, client: str, prestataire: str, trimestre: str) -> Path:
    out = base / client / prestataire / trimestre / "figures"
    out.mkdir(parents=True, exist_ok=True)
    return out


def _nouvelle_figure(largeur: float = 7, hauteur: float = 4.2) -> tuple[plt.Figure, plt.Axes]:
    with plt.rc_context(_RC):
        fig, ax = plt.subplots(figsize=(largeur, hauteur), dpi=120)
        fig.subplots_adjust(left=0.1, right=0.96, top=0.82, bottom=0.18)
        _style_axes(ax)
        return fig, ax


def _style_axes(ax: plt.Axes) -> None:
    ax.set_facecolor("#FAFBFC")
    ax.grid(True, axis="y", alpha=0.9, zorder=0)
    ax.set_axisbelow(True)
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)
    for spine in ("left", "bottom"):
        ax.spines[spine].set_color("#BDC3C7")


def _savefig(path: Path, fig: plt.Figure) -> None:
    fig.savefig(path, dpi=200, bbox_inches="tight", facecolor="white", edgecolor="none")
    plt.close(fig)
    logger.info("Figure enregistrée : %s", path)


def _couleurs_tranches(labels: list[str]) -> list[str]:
    return [CHARTE["tranches"].get(l, CHARTE["palette"][i % len(CHARTE["palette"])]) for i, l in enumerate(labels)]


def generer_figures(
    resultats: dict[str, Any],
    params: dict[str, Any],
    penalites: dict[str, Any],
    base_output: Path,
) -> dict[str, str]:
    """Génère les PNG et retourne figure_key → chemin absolu."""
    client = str(params.get("filtre_client") or params.get("hypotheses_client") or "CLIENT")
    if client in ("Tous", ""):
        client = str(params.get("client_site", "CLIENT"))
    prestataire = str(params.get("prestataire", "PRESTATAIRE"))
    trimestre = str(params.get("trimestre", "T1"))
    annee = int(params.get("annee", 2026))
    titre_ctx = lambda st: _titre(client, prestataire, trimestre, annee, st)

    out_dir = _dossier_figures(base_output, client, prestataire, trimestre)
    paths: dict[str, str] = {}

    interventions = resultats.get("interventions", pd.DataFrame())
    synthese = resultats.get("synthese_appareils", pd.DataFrame())
    maintenance = resultats.get("maintenance", pd.DataFrame())
    if not isinstance(interventions, pd.DataFrame):
        interventions = pd.DataFrame()
    if not isinstance(synthese, pd.DataFrame):
        synthese = pd.DataFrame()
    if not isinstance(maintenance, pd.DataFrame):
        maintenance = pd.DataFrame()

    def _penalites_donut() -> Optional[tuple[str, Path]]:
        fig, ax = _nouvelle_figure(6.5, 5)
        postes = [
            ("Maintenance", float(penalites.get("penalite_maintenance", 0))),
            ("Pannes", float(penalites.get("penalite_pannes", 0))),
            ("Immobilisation", float(penalites.get("penalite_immobilisation", 0))),
            ("Délai", float(penalites.get("penalite_delai_intervention", 0))),
        ]
        labels = [p[0] for p in postes if p[1] > 0]
        vals = [p[1] for p in postes if p[1] > 0]
        if not vals:
            labels, vals = ["Aucune pénalité"], [1.0]
        total_pen = sum(vals)
        _, _, autotexts = ax.pie(
            vals,
            labels=labels,
            autopct=lambda pct: f"{pct:.0f}%\n({pct/100*total_pen:,.0f} €)" if total_pen else "",
            colors=CHARTE["palette"][: len(vals)],
            startangle=90,
            pctdistance=0.75,
            wedgeprops=dict(width=0.45, edgecolor="white", linewidth=2),
        )
        for t in autotexts:
            t.set_fontsize(7)
            t.set_color("#1F3A5F")
        ax.set_title(titre_ctx("Répartition des pénalités (€)"), pad=12)
        return "penalites_par_type", out_dir / "penalites_par_type.png"

    def _top10_exposition() -> Optional[tuple[str, Path]]:
        if synthese.empty or "ascenseur" not in synthese.columns:
            return None
        syn = synthese.copy()
        syn["_score"] = syn.get("cumul_indisponibilite_h", 0).fillna(0) + syn.get(
            "nb_pannes_retenues", 0
        ).fillna(0) * 10
        top = syn.nlargest(10, "_score")
        fig, ax = _nouvelle_figure(7, 4.8)
        bars = ax.barh(
            top["ascenseur"].astype(str),
            top["_score"],
            color=CHARTE["navy"],
            height=0.65,
            edgecolor="white",
            linewidth=0.8,
            zorder=3,
        )
        ax.invert_yaxis()
        ax.set_xlabel("Score composite")
        ax.set_title(titre_ctx("Top 10 — exposition pénalités"), pad=10)
        for bar in bars:
            ax.text(
                bar.get_width() + max(top["_score"]) * 0.01,
                bar.get_y() + bar.get_height() / 2,
                f"{bar.get_width():.0f}",
                va="center",
                fontsize=7,
                color=CHARTE["navy"],
            )
        return "top10_penalites", out_dir / "top10_penalites_appareil.png"

    def _pannes_par_appareil() -> Optional[tuple[str, Path]]:
        if synthese.empty or "nb_pannes_retenues" not in synthese.columns:
            return None
        syn = synthese.nlargest(18, "nb_pannes_retenues")
        fig, ax = _nouvelle_figure(7.5, 4.8)
        ax.bar(
            syn["ascenseur"].astype(str),
            syn["nb_pannes_retenues"].fillna(0),
            color=CHARTE["orange"],
            edgecolor="white",
            linewidth=0.6,
            zorder=3,
        )
        ax.set_ylabel("Pannes retenues")
        ax.set_title(titre_ctx("Pannes par appareil"), pad=10)
        plt.setp(ax.xaxis.get_majorticklabels(), rotation=40, ha="right")
        return "pannes_par_appareil", out_dir / "pannes_par_appareil.png"

    def _delta_maintenance() -> Optional[tuple[str, Path]]:
        if maintenance.empty or "delta_jours" not in maintenance.columns:
            return None
        m = maintenance.copy()
        m["delta_jours"] = pd.to_numeric(m["delta_jours"], errors="coerce")
        m = m.dropna(subset=["delta_jours"])
        if m.empty or "ascenseur" not in m.columns:
            return None
        m = m.nlargest(20, "delta_jours")
        fig, ax = _nouvelle_figure(7.5, 4.8)
        colors = [
            CHARTE["rouge"] if bool(r.get("ecart_signale")) else CHARTE["vert"]
            if str(r.get("statut_delta")) == "evalue"
            else CHARTE["gris"]
            for _, r in m.iterrows()
        ]
        ax.bar(
            m["ascenseur"].astype(str),
            m["delta_jours"],
            color=colors,
            edgecolor="white",
            linewidth=0.5,
            zorder=3,
        )
        seuil = float(params.get("seuil_maintenance_jours", 42))
        ax.axhline(y=seuil, color=CHARTE["navy"], linestyle="--", linewidth=1.5, label=f"Seuil {seuil} j")
        ax.set_ylabel("Δ jours")
        ax.set_title(titre_ctx("Écart entre visites maintenance"), pad=10)
        ax.legend(loc="upper right", fontsize=7, framealpha=0.9)
        plt.setp(ax.xaxis.get_majorticklabels(), rotation=40, ha="right")
        return "delta_maintenance", out_dir / "delta_maintenance.png"

    def _tranches_delai() -> Optional[tuple[str, Path]]:
        if interventions.empty or "tranche_delai" not in interventions.columns:
            return None
        vc = interventions["tranche_delai"].value_counts()
        ordre = ["< 1h", "1 à 2h", "2 à 4h", "> 4h", "inconnu"]
        labels = [k for k in ordre if k in vc.index] + [k for k in vc.index if k not in ordre]
        vals = [int(vc.get(l, 0)) for l in labels]
        if sum(vals) == 0:
            return None
        fig, ax = _nouvelle_figure(6.5, 4.5)
        bars = ax.bar(labels, vals, color=_couleurs_tranches(labels), edgecolor="white", linewidth=0.8, zorder=3)
        ax.set_ylabel("Interventions")
        ax.set_title(titre_ctx("Délais d'intervention"), pad=10)
        for bar, v in zip(bars, vals):
            ax.text(
                bar.get_x() + bar.get_width() / 2,
                bar.get_height() + 0.3,
                str(v),
                ha="center",
                fontsize=8,
                color=CHARTE["navy"],
            )
        plt.setp(ax.xaxis.get_majorticklabels(), rotation=25, ha="right")
        return "tranches_delai", out_dir / "tranches_delai.png"

    def _activite_quotidienne() -> Optional[tuple[str, Path]]:
        if interventions.empty or "datetime_appel" not in interventions.columns:
            return None
        inter = interventions.copy()
        inter["datetime_appel"] = pd.to_datetime(inter["datetime_appel"], errors="coerce")
        inter = inter.dropna(subset=["datetime_appel"])
        if inter.empty:
            return None
        par_jour = inter.groupby(inter["datetime_appel"].dt.date).size()
        fig, ax = _nouvelle_figure(7.5, 4.2)
        x = list(range(len(par_jour)))
        ax.fill_between(x, par_jour.values, alpha=0.2, color=CHARTE["orange"])
        ax.plot(
            x,
            par_jour.values,
            color=CHARTE["navy"],
            marker="o",
            markersize=5,
            markerfacecolor=CHARTE["orange"],
            markeredgecolor="white",
            markeredgewidth=1,
            linewidth=2,
            zorder=3,
        )
        ax.set_xticks(x[:: max(1, len(x) // 8)])
        ax.set_xticklabels([str(d) for d in par_jour.index][:: max(1, len(x) // 8)], rotation=35, ha="right")
        ax.set_ylabel("Interventions / jour")
        ax.set_title(titre_ctx("Activité quotidienne"), pad=10)
        ax.yaxis.set_major_locator(mticker.MaxNLocator(integer=True))
        return "interventions_journalieres", out_dir / "interventions_journalieres.png"

    def _exces_pannes_periode() -> Optional[tuple[str, Path]]:
        matrice = resultats.get("matrice_pannes", pd.DataFrame())
        if not isinstance(matrice, pd.DataFrame) or matrice.empty or "ascenseur" not in matrice.columns:
            return None
        mois_cols = [c for c in matrice.columns if c not in ("cle_appareil", "ascenseur", "client", "adresse")]
        if not mois_cols:
            return None
        totaux = matrice[mois_cols].sum(axis=1).sort_values(ascending=False).head(18)
        fig, ax = _nouvelle_figure(7.5, 4.8)
        ax.bar(
            totaux.index.astype(str),
            totaux.values,
            color=CHARTE["rouge"],
            edgecolor="white",
            linewidth=0.6,
            zorder=3,
        )
        ax.set_ylabel("Pannes (cumul période)")
        ax.set_title(titre_ctx("Excès de pannes par appareil"), pad=10)
        plt.setp(ax.xaxis.get_majorticklabels(), rotation=40, ha="right")
        return "pannes_cumul_periode", out_dir / "pannes_cumul_periode.png"

    def _heatmap_maintenance() -> Optional[tuple[str, Path]]:
        if maintenance.empty or "datetime_visite" not in maintenance.columns:
            return None
        m = maintenance.dropna(subset=["datetime_visite"]).copy()
        if m.empty or "ascenseur" not in m.columns:
            return None
        m["semaine"] = pd.to_datetime(m["datetime_visite"]).dt.isocalendar().week.astype(int)
        pivot = m.groupby(["ascenseur", "semaine"]).size().unstack(fill_value=0)
        if pivot.empty:
            return None
        pivot = pivot.iloc[:25]
        fig, ax = _nouvelle_figure(8, max(4.5, len(pivot) * 0.22))
        im = ax.imshow(pivot.values, aspect="auto", cmap="YlGn", vmin=0, vmax=max(1, pivot.values.max()))
        ax.set_yticks(range(len(pivot.index)))
        ax.set_yticklabels(pivot.index.astype(str), fontsize=7)
        ax.set_xticks(range(len(pivot.columns)))
        ax.set_xticklabels([f"S{c}" for c in pivot.columns], rotation=45, ha="right", fontsize=7)
        ax.set_title(titre_ctx("Calendrier maintenance"), pad=10)
        cbar = fig.colorbar(im, ax=ax, fraction=0.02, pad=0.02)
        cbar.set_label("Visite", fontsize=8)
        return "heatmap_maintenance", out_dir / "heatmap_maintenance.png"

    generateurs = (
        _penalites_donut,
        _top10_exposition,
        _pannes_par_appareil,
        _delta_maintenance,
        _tranches_delai,
        _activite_quotidienne,
        _exces_pannes_periode,
        _heatmap_maintenance,
    )
    for generer in generateurs:
        try:
            resultat = generer()
        except Exception as exc:
            logger.warning("Figure %s non générée : %s", generer.__name__, exc, exc_info=True)
            plt.close("all")
            continue
        if resultat is None:
            continue
        cle, chemin = resultat
        _savefig(chemin, plt.gcf())
        paths[cle] = str(chemin)

    try:
        from core.geocarte import generer_carte_penalites

        carte = generer_carte_penalites(resultats, params, penalites, out_dir)
        if carte:
            paths["carte_penalites"] = carte
    except Exception as exc:
        logger.info("Cartographie non générée : %s", exc)

    return paths
