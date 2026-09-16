"use client";

import { useEffect, useMemo, useState } from "react";

import { CrmDialog } from "@/components/crm/ui/CrmDialog";
import { apiFetch } from "@/lib/api";
import { addWeeksMonday, mondayOfIsoWeek, weekOffsetFromDate, yearSpansFromWeeks, type MonthSpan } from "@/lib/planning-modernisation-gantt";
import { readToken } from "@/lib/token-storage";
import type { EcheanceVueRow } from "@/lib/types";

const WEEK_W = 26;
const ROW_H = 32;
const LABEL_COL_W = 320;

const STATUT_COLOR: Record<EcheanceVueRow["statut"], string> = {
  A_VENIR: "#94a3b8",
  FACTUREE: "#f97316",
  PAYEE: "#16a34a",
  ANNULEE: "#dc2626",
};

const STATUT_LABEL: Record<EcheanceVueRow["statut"], string> = {
  A_VENIR: "À venir",
  FACTUREE: "Facturée",
  PAYEE: "Payée",
  ANNULEE: "Annulée",
};

function money(v: number): string {
  return v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

/** Référence à afficher — n° commande si liée, sinon n° offre (échéancier de facturation saisi
 * avant toute commande). */
function reference(e: EcheanceVueRow): string {
  return e.numeroCommande || e.numeroOffre || "";
}

/** Ligne "mois" avec année/mois numériques conservés (nécessaire pour le clic → modale trésorerie),
 * contrairement à monthNameSpansFromWeeks (planning chantier) qui ne garde que le libellé affiché. */
function monthSpansWithYm(anchorMonday: Date, weekCount: number): (MonthSpan & { year: number; month: number })[] {
  const spans: { year: number; month: number; label: string; weeks: number }[] = [];
  for (let w = 0; w < weekCount; w++) {
    const d = addWeeksMonday(anchorMonday, w);
    const year = d.getFullYear();
    const month = d.getMonth();
    const last = spans.at(-1);
    if (last && last.year === year && last.month === month) last.weeks += 1;
    else {
      const rawLabel = d.toLocaleDateString("fr-FR", { month: "long" });
      spans.push({ year, month, label: rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1), weeks: 1 });
    }
  }
  return spans;
}

export function PaiementEcheancierGantt() {
  const [rows, setRows] = useState<EcheanceVueRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [moisSelectionne, setMoisSelectionne] = useState<{ year: number; month: number; label: string } | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = (await apiFetch("/api/echeances-paiement", { token: readToken() })) as EcheanceVueRow[] | null;
        setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Erreur de chargement");
      }
    })();
  }, []);

/** Une commande (échéances réelles ou mode de paiement déjà saisi) ou, à défaut, une offre
 * (échéancier de facturation déjà saisi, avant toute commande) — même ligne dans le Gantt. */
  const parLigne = useMemo(() => {
    const map = new Map<string, EcheanceVueRow[]>();
    for (const r of rows ?? []) {
      const key = r.commandeId != null ? `c-${r.commandeId}` : `o-${r.offreId}`;
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => reference(a[1][0]).localeCompare(reference(b[1][0]), "fr"));
  }, [rows]);

  const { anchor, totalWeeks } = useMemo(() => {
    const dates = (rows ?? []).map((r) => r.dateEcheance).filter(Boolean);
    const today = new Date().toISOString().slice(0, 10);
    const minIso = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : today;
    const maxIso = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : today;
    const anchorMonday = mondayOfIsoWeek(minIso);
    const weeks = Math.max(weekOffsetFromDate(anchorMonday, maxIso) + 4, 12);
    return { anchor: anchorMonday, totalWeeks: weeks };
  }, [rows]);

  const yearSpans = useMemo(() => yearSpansFromWeeks(anchor, totalWeeks), [anchor, totalWeeks]);
  const monthSpans = useMemo(() => monthSpansWithYm(anchor, totalWeeks), [anchor, totalWeeks]);
  const timelineWidth = totalWeeks * WEEK_W;

  const echeancesDuMois = useMemo(() => {
    if (!moisSelectionne) return [];
    const { year, month } = moisSelectionne;
    return (rows ?? []).filter((r) => {
      const d = new Date(`${r.dateEcheance}T12:00:00`);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }, [rows, moisSelectionne]);

  const totauxMois = useMemo(() => {
    const totals: Record<EcheanceVueRow["statut"], number> = { A_VENIR: 0, FACTUREE: 0, PAYEE: 0, ANNULEE: 0 };
    for (const e of echeancesDuMois) totals[e.statut] += e.montantHt;
    return totals;
  }, [echeancesDuMois]);

  if (err) return <p className="crm-alert crm-alert--error">{err}</p>;
  if (!rows) return <p className="crm-hint">Chargement…</p>;
  if (rows.length === 0) {
    return (
      <p className="crm-hint">
        Aucune échéance pour l&apos;instant — apparaît dès qu&apos;une commande a un paiement échelonné (fiche commande,
        section Paiement), un échéancier de suivi généré, ou qu&apos;une offre a un échéancier de facturation renseigné.
      </p>
    );
  }

  return (
    <div className="fcard">
      <div className="fcard-body overflow-x-auto">
        <div style={{ display: "flex", flexDirection: "column", minWidth: LABEL_COL_W + timelineWidth }}>
          {/* En-tête années */}
          <div style={{ display: "flex", paddingLeft: LABEL_COL_W }}>
            {yearSpans.map((s, i) => (
              <div key={i} style={{ width: s.weeks * WEEK_W, fontWeight: 700, fontSize: 12, padding: "4px 0", borderBottom: "1px solid var(--g300)" }}>
                {s.label}
              </div>
            ))}
          </div>
          {/* En-tête mois — cliquable */}
          <div style={{ display: "flex", paddingLeft: LABEL_COL_W }}>
            {monthSpans.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setMoisSelectionne(s)}
                style={{
                  width: s.weeks * WEEK_W,
                  fontSize: 11,
                  padding: "4px 2px",
                  borderBottom: "2px solid var(--g300)",
                  background: "transparent",
                  cursor: "pointer",
                  textAlign: "center",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={`Voir la trésorerie de ${s.label} ${s.year}`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Lignes commande (ou offre, si pas encore de commande) */}
          {parLigne.map(([key, echeances]) => {
            const first = echeances[0];
            const estOffre = first.commandeId == null;
            return (
              <div key={key} style={{ display: "flex", alignItems: "center", height: ROW_H, borderBottom: "1px solid var(--g200)" }}>
                <div style={{ width: LABEL_COL_W, fontSize: 12, paddingRight: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {estOffre ? <span className="crm-hint">Offre </span> : null}
                  <strong>{reference(first)}</strong> — {first.clientNom} ({first.siteNom})
                </div>
                <div style={{ position: "relative", width: timelineWidth, height: ROW_H }}>
                  {echeances.map((e) => {
                    const offset = weekOffsetFromDate(anchor, e.dateEcheance) * WEEK_W;
                    const titre = `${e.libelle} — ${money(e.montantHt)} — ${STATUT_LABEL[e.statut]}${e.factureId ? ` — facture #${e.factureId}` : ""}`;
                    return (
                      <div
                        key={e.id}
                        title={titre}
                        style={{
                          position: "absolute",
                          left: offset,
                          top: ROW_H / 2 - 6,
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          background: STATUT_COLOR[e.statut],
                          border: "1px solid #fff",
                          boxShadow: "0 0 0 1px rgba(0,0,0,0.15)",
                          cursor: "default",
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 12 }}>
          {(Object.keys(STATUT_LABEL) as EcheanceVueRow["statut"][]).map((s) => (
            <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: STATUT_COLOR[s], display: "inline-block" }} />
              {STATUT_LABEL[s]}
            </span>
          ))}
        </div>
      </div>

      <CrmDialog
        visible={moisSelectionne != null}
        onHide={() => setMoisSelectionne(null)}
        header={moisSelectionne ? `Trésorerie — ${moisSelectionne.label} ${moisSelectionne.year}` : ""}
        width="42rem"
      >
        {moisSelectionne ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {(Object.keys(STATUT_LABEL) as EcheanceVueRow["statut"][]).map((s) => (
                <div key={s} className="crm-stack" style={{ flex: 1, minWidth: 140 }}>
                  <p className="crm-stack-title">
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: STATUT_COLOR[s], display: "inline-block", marginRight: 6 }} />
                    {STATUT_LABEL[s]}
                  </p>
                  <p style={{ fontSize: 18, fontWeight: 700 }}>{money(totauxMois[s])}</p>
                </div>
              ))}
            </div>
            <table className="ct">
              <thead>
                <tr>
                  <th>Réf.</th>
                  <th>Client</th>
                  <th>Échéance</th>
                  <th>Montant HT</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {echeancesDuMois.map((e) => (
                  <tr key={e.id}>
                    <td>{reference(e)}</td>
                    <td>{e.clientNom}</td>
                    <td>{e.libelle}</td>
                    <td>{money(e.montantHt)}</td>
                    <td>
                      <span style={{ color: STATUT_COLOR[e.statut], fontWeight: 600 }}>{STATUT_LABEL[e.statut]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </CrmDialog>
    </div>
  );
}
