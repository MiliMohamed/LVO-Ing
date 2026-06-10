"use client";

import { useCallback, useMemo } from "react";

import {
  type EcheancierExecutionRow,
  parseExecutionRows,
  propagateFromFirst,
  rowsToJson,
  templateForMissionType,
} from "@/lib/echeancier-execution";

type Props = {
  value: string;
  typeMission: string;
  onChange: (json: string) => void;
};

export function PlanningExecutionEditor({ value, typeMission, onChange }: Props) {
  const rows = useMemo(() => parseExecutionRows(value), [value]);

  const setRows = useCallback(
    (next: EcheancierExecutionRow[]) => {
      onChange(rowsToJson(next));
    },
    [onChange],
  );

  const applyTemplate = () => {
    setRows(templateForMissionType(typeMission));
  };

  const recalc = () => {
    setRows(propagateFromFirst(rows));
  };

  const updateRow = (i: number, patch: Partial<EcheancierExecutionRow>) => {
    const next = rows.map((r, j) => (j === i ? { ...r, ...patch } : r));
    setRows(next);
  };

  const addRow = () => {
    setRows([...rows, { libelle: "Nouveau jalon", datePrevue: "", ecartSemaines: 2 }]);
  };

  const removeRow = (i: number) => {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, j) => j !== i));
  };

  const firstDate = rows[0]?.datePrevue?.trim() ?? "";

  return (
    <div className="space-y-3 rounded-lg border border-[var(--g200)] bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="crm-stack-title mb-0">Échéancier d&apos;exécution (planning)</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="cbtn cbtn-ghost cbtn-sm" onClick={applyTemplate}>
            Charger le modèle ({typeMission || "—"})
          </button>
          <button
            type="button"
            className="cbtn cbtn-orange cbtn-sm"
            onClick={recalc}
            disabled={!/^\d{4}-\d{2}-\d{2}$/.test(firstDate)}
            title="Renseigner la date du 1er jalon, puis appliquer les écarts en semaines"
          >
            Recalculer à partir de la 1re date
          </button>
        </div>
      </div>
      <p className="text-[11px] leading-snug text-neutral-600">
        Indiquez la <strong>date du premier jalon</strong>, ajustez les <strong>écarts (semaines)</strong> entre jalons si besoin,
        puis « Recalculer ». Chaque date reste modifiable à la main jusqu&apos;à validation du formulaire.
      </p>

      <div className="overflow-x-auto rounded-md border border-[var(--g300)]">
        <table className="w-full min-w-[520px] border-collapse text-left text-xs">
          <thead>
            <tr className="bg-[var(--g50)] text-[11px] uppercase tracking-wide text-neutral-600">
              <th className="border-b border-[var(--g300)] px-2 py-2">#</th>
              <th className="border-b border-[var(--g300)] px-2 py-2">Jalon</th>
              <th className="border-b border-[var(--g300)] px-2 py-2">Écart (sem.) après le précédent</th>
              <th className="border-b border-[var(--g300)] px-2 py-2">Date prévue</th>
              <th className="border-b border-[var(--g300)] px-2 py-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-[var(--g200)] last:border-b-0">
                <td className="px-2 py-1.5 text-neutral-500">{i + 1}</td>
                <td className="px-2 py-1.5">
                  <input
                    className="crm-input crm-input--sm min-w-[140px]"
                    value={r.libelle}
                    onChange={(e) => updateRow(i, { libelle: e.target.value })}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className="crm-input crm-input--sm w-24"
                    disabled={i === 0}
                    value={i === 0 ? 0 : r.ecartSemaines ?? ""}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      updateRow(i, { ecartSemaines: Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0 });
                    }}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="date"
                    className="crm-input crm-input--sm"
                    value={r.datePrevue}
                    onChange={(e) => updateRow(i, { datePrevue: e.target.value })}
                  />
                </td>
                <td className="px-1 py-1.5">
                  <button
                    type="button"
                    className="text-red-600 hover:underline disabled:opacity-30"
                    disabled={rows.length <= 1}
                    onClick={() => removeRow(i)}
                    aria-label="Supprimer la ligne"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="cbtn cbtn-ghost cbtn-sm" onClick={addRow}>
        + Ajouter un jalon
      </button>
    </div>
  );
}
