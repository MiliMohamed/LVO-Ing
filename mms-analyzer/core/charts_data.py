# -*- coding: utf-8 -*-
"""
Séries de données pour graphiques (Chart.js) à partir des résultats d'analyse.
"""

from __future__ import annotations

from typing import Any

import pandas as pd


def _df_records(df: pd.DataFrame, limit: int = 200) -> list[dict[str, Any]]:
    if df is None or df.empty:
        return []
    subset = df.head(limit).copy()
    for col in subset.columns:
        if pd.api.types.is_datetime64_any_dtype(subset[col]):
            subset[col] = subset[col].astype(str)
    return subset.where(pd.notna(subset), None).to_dict(orient="records")


def construire_graphiques(resultats: dict[str, Any], penalites: dict[str, Any]) -> dict[str, Any]:
    """Retourne un objet JSON pour alimenter les diagrammes du CRM."""
    interventions = resultats.get("interventions", pd.DataFrame())
    synthese = resultats.get("synthese_appareils", pd.DataFrame())
    maintenance = resultats.get("maintenance", pd.DataFrame())
    matrice = resultats.get("matrice_pannes", pd.DataFrame())

    if not isinstance(interventions, pd.DataFrame):
        interventions = pd.DataFrame()
    if not isinstance(synthese, pd.DataFrame):
        synthese = pd.DataFrame()
    if not isinstance(maintenance, pd.DataFrame):
        maintenance = pd.DataFrame()
    if not isinstance(matrice, pd.DataFrame):
        matrice = pd.DataFrame()

    graphiques: dict[str, Any] = {}

    # 1. Pannes retenues par appareil
    if not synthese.empty and "ascenseur" in synthese.columns:
        graphiques["pannes_par_appareil"] = {
            "type": "bar",
            "titre": "Pannes retenues par appareil",
            "labels": synthese["ascenseur"].astype(str).tolist(),
            "datasets": [
                {
                    "label": "Pannes retenues",
                    "data": synthese["nb_pannes_retenues"].fillna(0).astype(int).tolist(),
                },
                {
                    "label": "Interventions totales",
                    "data": synthese["nb_interventions"].fillna(0).astype(int).tolist(),
                },
            ],
        }

    # 2. Répartition des délais d'intervention
    if not interventions.empty and "tranche_delai" in interventions.columns:
        vc = interventions["tranche_delai"].value_counts()
        ordre = ["< 1h", "1 à 2h", "2 à 4h", "> 4h", "inconnu"]
        labels = [k for k in ordre if k in vc.index] + [k for k in vc.index if k not in ordre]
        data = [int(vc.get(l, 0)) for l in labels]
        graphiques["tranches_delai"] = {
            "type": "doughnut",
            "titre": "Répartition des délais d'intervention",
            "labels": labels,
            "datasets": [{"label": "Interventions", "data": data}],
        }

    # 3. Pénalités par poste
    graphiques["penalites_postes"] = {
        "type": "bar",
        "titre": "Montants des pénalités (€)",
        "labels": [
            "Maintenance",
            "Pannes",
            "Immobilisation",
            "Délai intervention",
        ],
        "datasets": [
            {
                "label": "€",
                "data": [
                    float(penalites.get("penalite_maintenance", 0)),
                    float(penalites.get("penalite_pannes", 0)),
                    float(penalites.get("penalite_immobilisation", 0)),
                    float(penalites.get("penalite_delai_intervention", 0)),
                ],
            }
        ],
    }

    # 4. Cumul heures d'intervention par appareil
    if not synthese.empty and "cumul_intervention_h" in synthese.columns:
        graphiques["heures_intervention"] = {
            "type": "bar",
            "titre": "Cumul heures de délai d'intervention",
            "labels": synthese["ascenseur"].astype(str).tolist(),
            "datasets": [
                {
                    "label": "Heures",
                    "data": synthese["cumul_intervention_h"].fillna(0).round(2).tolist(),
                }
            ],
        }

    # 5. Tranches de délai par appareil (empilé)
    if not synthese.empty:
        cols = ["tranche_<1h", "tranche_1_2h", "tranche_2_4h", "tranche_>4h"]
        if all(c in synthese.columns for c in cols):
            graphiques["tranches_par_appareil"] = {
                "type": "bar",
                "titre": "Délais par appareil (nombre d'interventions)",
                "labels": synthese["ascenseur"].astype(str).tolist(),
                "datasets": [
                    {"label": "< 1h", "data": synthese["tranche_<1h"].fillna(0).astype(int).tolist()},
                    {"label": "1 à 2h", "data": synthese["tranche_1_2h"].fillna(0).astype(int).tolist()},
                    {"label": "2 à 4h", "data": synthese["tranche_2_4h"].fillna(0).astype(int).tolist()},
                    {"label": "> 4h", "data": synthese["tranche_>4h"].fillna(0).astype(int).tolist()},
                ],
                "stacked": True,
            }

    # 6. Écarts maintenance (Δ jours) — visites avec delta > 0
    if not maintenance.empty and "delta_jours" in maintenance.columns:
        m = maintenance.dropna(subset=["delta_jours"]).copy()
        if not m.empty and "ascenseur" in m.columns:
            m = m.sort_values("delta_jours", ascending=False).head(25)
            labels = [
                f"{row.get('ascenseur', '')} ({int(row['delta_jours']) if pd.notna(row['delta_jours']) else '?'})"
                for _, row in m.iterrows()
            ]
            graphiques["delta_maintenance"] = {
                "type": "bar",
                "titre": "Écart entre visites (Δ jours) — top 25",
                "labels": labels,
                "datasets": [
                    {
                        "label": "Δ jours",
                        "data": m["delta_jours"].fillna(0).astype(float).tolist(),
                    }
                ],
            }

    # 7. Matrice pannes (heatmap simplifiée en barres par appareil si matrice non vide)
    if not matrice.empty and "ascenseur" in matrice.columns:
        mois_cols = [c for c in matrice.columns if c not in ("cle_appareil", "ascenseur", "client", "adresse")]
        if mois_cols:
            totaux = matrice[mois_cols].sum(axis=1)
            graphiques["pannes_par_mois_total"] = {
                "type": "bar",
                "titre": "Pannes retenues (cumul période par appareil)",
                "labels": matrice["ascenseur"].astype(str).tolist(),
                "datasets": [{"label": "Pannes", "data": totaux.fillna(0).astype(int).tolist()}],
            }

    # 8. Indisponibilité cumulée (heures)
    if not synthese.empty and "cumul_indisponibilite_h" in synthese.columns:
        graphiques["indisponibilite"] = {
            "type": "bar",
            "titre": "Cumul heures d'indisponibilité",
            "labels": synthese["ascenseur"].astype(str).tolist(),
            "datasets": [
                {
                    "label": "Heures",
                    "data": synthese["cumul_indisponibilite_h"].fillna(0).round(2).tolist(),
                }
            ],
        }

    return {
        "graphiques": graphiques,
        "tableaux": {
            "historique": _df_records(interventions, 100),
            "synthese": _df_records(synthese, 50),
            "maintenance": _df_records(maintenance, 80),
            "penalites_detail": penalites.get("detail", {}),
        },
    }
