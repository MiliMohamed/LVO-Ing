"use client";

import { useEffect, useState } from "react";

import { CrmCreateButton } from "@/components/crm/CrmCreateButton";
import { PlanningModernisationGantt } from "@/components/crm/PlanningModernisationGantt";
import { apiFetch } from "@/lib/api";
import { readToken } from "@/lib/token-storage";

type Jalon = {
  id: string;
  label: string;
  period: string;
  dueAt: string;
  alertLevel: string;
};

const periodLabel: Record<string, string> = {
  MONTH: "Mensuel",
  QUARTER: "Trimestriel",
  PHASE_END: "Fin de phase",
};

type TabId = "jalons" | "gantt";

export default function PlanningPage() {
  const [tab, setTab] = useState<TabId>("gantt");
  const [rows, setRows] = useState<Jalon[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = (await apiFetch("/api/planning/jalons", { token: readToken() })) as Jalon[] | null;
        setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Erreur");
      }
    })();
  }, []);

  return (
    <>
      <header className="pg-hdr mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>Planning &amp; échéancier</h1>
          <p>
            Diagramme Gantt : plusieurs projets enregistrés localement (un fichier par projet), frise avec années et mois.
            Jalons CRM via API. Persistance navigateur jusqu&apos;à branchement serveur.
          </p>
        </div>
        <CrmCreateButton slug="offre" />
      </header>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-[var(--g300)]">
        <button type="button" className={`rpt-tab ${tab === "gantt" ? "act" : ""}`} onClick={() => setTab("gantt")}>
          Planning Gantt (chantier)
        </button>
        <button type="button" className={`rpt-tab ${tab === "jalons" ? "act" : ""}`} onClick={() => setTab("jalons")}>
          Jalons CRM (API)
        </button>
      </div>

      {tab === "gantt" ? (
        <PlanningModernisationGantt />
      ) : (
        <>
          {err ? (
            <p className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{err}</p>
          ) : null}

          <div className="fcard">
            <div className="fcard-body overflow-x-auto">
              <table className="ct">
                <thead>
                  <tr>
                    <th>Période</th>
                    <th>Jalon</th>
                    <th>Échéance</th>
                    <th>Alerte</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows ?? []).map((r) => (
                    <tr key={r.id}>
                      <td>{periodLabel[r.period] ?? r.period}</td>
                      <td>{r.label}</td>
                      <td>
                        {r.dueAt && !Number.isNaN(Date.parse(r.dueAt))
                          ? new Date(r.dueAt).toLocaleString("fr-FR")
                          : "—"}
                      </td>
                      <td>
                        <span
                          className={
                            r.alertLevel === "critical"
                              ? "rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-900"
                              : r.alertLevel === "warn"
                                ? "rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900"
                                : "rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-900"
                          }
                        >
                          {r.alertLevel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows ? <p className="fnote mt-2">Chargement…</p> : null}
              {rows && rows.length === 0 ? (
                <p className="fnote mt-2 text-neutral-600">
                  Aucun jalon renvoyé par l&apos;API. En démo Node, des exemples sont fournis ; avec Spring Boot, vérifiez
                  que le proxy pointe sur le backend Java.
                </p>
              ) : null}
            </div>
          </div>
        </>
      )}
    </>
  );
}
