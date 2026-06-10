"use client";

import { useCallback, useState } from "react";

import {
  analyzeBatchStream,
  downloadBase64File,
  type MmsBatchResult,
  type MmsBatchStreamEvent,
  type MmsParams,
} from "@/lib/mms-api";

type Props = {
  parcFile: File | null;
  params: MmsParams;
  disabled?: boolean;
};

export function MaintenanceMmsBatchPanel({ parcFile, params, disabled }: Props) {
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [journal, setJournal] = useState<MmsBatchStreamEvent[]>([]);
  const [result, setResult] = useState<MmsBatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lancerLot = useCallback(async () => {
    if (batchFiles.length === 0) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setJournal([]);
    setProgress(0);
    setTotal(batchFiles.length);

    try {
      const finalResult = await analyzeBatchStream(
        batchFiles,
        parcFile,
        params,
        (event) => {
          if (event.type === "start") {
            setTotal(event.total ?? batchFiles.length);
          }
          if (event.type === "progress") {
            setProgress(event.index ?? 0);
            setCurrentFile(event.fichier ?? null);
            setJournal((prev) => {
              const rest = prev.filter((e) => e.type !== "progress" || e.fichier !== event.fichier);
              return [...rest, event];
            });
          }
          if (event.type === "journal_entry" && event.entry) {
            setJournal((prev) => [...prev, event]);
          }
        },
      );
      setResult(finalResult);
      setProgress(finalResult.nb_ok + finalResult.nb_erreur + (finalResult.nb_skipped ?? 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lot");
    } finally {
      setRunning(false);
      setCurrentFile(null);
    }
  }, [batchFiles, parcFile, params]);

  const pct = total > 0 ? Math.round((progress / total) * 100) : 0;

  return (
    <div className="fcard mt-4">
      <div className="fcard-hdr">
        <h2>Traitement par lot (tous les couples)</h2>
        <p className="fcard-hdr-sub">Multi-fichiers prestataires + parc</p>
      </div>
      <div className="fcard-body space-y-4">
        <p className="crm-hint">
          Sélectionnez plusieurs fichiers prestataires (+ parc recommandé). Un rapport par fichier et, si
          plusieurs prestataires GHER, un compte-rendu consolidé.
        </p>
        <label className="crm-field block">
          <span className="crm-label">Fichiers prestataires (multi-sélection)</span>
          <input
            type="file"
            accept=".xlsx,.xls"
            multiple
            className="crm-input"
            disabled={disabled || running}
            onChange={(e) => setBatchFiles(Array.from(e.target.files ?? []))}
          />
          {batchFiles.length > 0 ? (
            <ul className="mt-2 list-inside list-disc text-xs text-neutral-600">
              {batchFiles.map((f) => (
                <li key={f.name}>{f.name}</li>
              ))}
            </ul>
          ) : null}
        </label>

        {running || total > 0 ? (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-neutral-600">
              <span>
                {running ? `Analyse : ${currentFile ?? "…"}` : "Terminé"}
              </span>
              <span>
                {progress} / {total} ({pct} %)
              </span>
            </div>
            <div className="crm-progress">
              <div className="crm-progress-bar" style={{ width: `${pct}%` }} />
            </div>
          </div>
        ) : null}

        <button
          type="button"
          className="cbtn cbtn-orange cbtn-sm"
          disabled={disabled || running || batchFiles.length === 0}
          onClick={() => void lancerLot()}
        >
          {running ? "Traitement en cours…" : "Traiter tous les fichiers"}
        </button>

        {error ? <p className="crm-alert crm-alert--error">{error}</p> : null}

        {journal.length > 0 ? (
          <div className="tw max-h-40 overflow-y-auto">
            <table className="ct">
              <thead>
                <tr>
                  <th>Fichier</th>
                  <th className="text-center">Statut</th>
                  <th className="text-right">€</th>
                </tr>
              </thead>
              <tbody>
                {journal
                  .filter((e) => e.entry || (e.type === "progress" && e.statut !== "running"))
                  .map((e, i) => {
                    const entry = e.entry ?? e;
                    const statut = entry.statut ?? e.statut;
                    const fichier = entry.fichier ?? e.fichier ?? "—";
                    if (statut === "running") return null;
                    return (
                      <tr key={`${fichier}-${i}`}>
                        <td>{fichier}</td>
                        <td className="text-center">
                          <span
                            className={
                              statut === "ok"
                                ? "text-[var(--green-t)]"
                                : statut === "skipped"
                                  ? "text-[var(--g600)]"
                                  : "text-red-700"
                            }
                          >
                            {statut}
                          </span>
                        </td>
                        <td className="text-right">
                          {entry.penalite_totale != null
                            ? Number(entry.penalite_totale).toLocaleString("fr-FR")
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        ) : null}

        {result ? (
          <div className="space-y-3 border-t border-neutral-200 pt-3">
            <p className="text-sm font-semibold text-[var(--navy)]">
              Synthèse : {result.nb_ok} OK, {result.nb_erreur} erreur(s)
              {result.nb_skipped ? `, ${result.nb_skipped} ignoré(s)` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              {result.rapports.map((r) => (
                <div key={`${r.client}-${r.prestataire}`} className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="cbtn cbtn-ghost cbtn-sm"
                    onClick={() =>
                      downloadBase64File(
                        r.fichiers.excel_base64,
                        r.fichiers.excel_nom,
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                      )
                    }
                  >
                    Excel {r.prestataire}
                  </button>
                  <button
                    type="button"
                    className="cbtn cbtn-ghost cbtn-sm"
                    onClick={() =>
                      downloadBase64File(
                        r.fichiers.word_base64,
                        r.fichiers.word_nom,
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                      )
                    }
                  >
                    Word
                  </button>
                  {r.fichiers.pdf_base64 ? (
                    <button
                      type="button"
                      className="cbtn cbtn-ghost cbtn-sm"
                      onClick={() =>
                        downloadBase64File(
                          r.fichiers.pdf_base64!,
                          r.fichiers.pdf_nom ?? "rapport.pdf",
                          "application/pdf",
                        )
                      }
                    >
                      PDF
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            {result.gher_consolide ? (
              <div className="fnote">
                <p className="mb-2 text-sm font-bold text-[var(--navy)]">Rapport consolidé GHER</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="cbtn cbtn-orange cbtn-sm"
                    onClick={() =>
                      downloadBase64File(
                        result.gher_consolide!.word_base64,
                        result.gher_consolide!.word_nom,
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                      )
                    }
                  >
                    Word consolidé
                  </button>
                  {result.gher_consolide.pdf_base64 ? (
                    <button
                      type="button"
                      className="cbtn cbtn-ghost cbtn-sm"
                      onClick={() =>
                        downloadBase64File(
                          result.gher_consolide!.pdf_base64!,
                          result.gher_consolide!.pdf_nom ?? "GHER.pdf",
                          "application/pdf",
                        )
                      }
                    >
                      PDF consolidé
                    </button>
                  ) : result.gher_consolide.pdf_erreur ? (
                    <span className="text-xs text-amber-800">{result.gher_consolide.pdf_erreur}</span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
