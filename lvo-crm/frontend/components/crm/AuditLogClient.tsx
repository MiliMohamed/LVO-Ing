"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch, apiFetchText } from "@/lib/api";
import { readToken } from "@/lib/token-storage";
import type { AuditLogRow } from "@/lib/types";

export function AuditLogClient() {
  const [rows, setRows] = useState<AuditLogRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    const token = readToken();
    void (async () => {
      try {
        const d = (await apiFetch("/api/audit-log", { token })) as AuditLogRow[] | null;
        setRows(Array.isArray(d) ? d : []);
        setErr(null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Erreur");
        setRows(null);
      }
    })();
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function downloadCsv() {
    const token = readToken();
    const text = await apiFetchText("/api/audit-log/export.csv", { token });
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-lvo-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {err ? (
        <p className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">{err}</p>
      ) : null}
      <div className="mb-3 flex gap-2">
        <button type="button" className="cbtn cbtn-ghost cbtn-sm" onClick={load}>
          Actualiser
        </button>
        <button type="button" className="cbtn cbtn-primary cbtn-sm" disabled={!!err} onClick={() => void downloadCsv()}>
          Télécharger CSV
        </button>
      </div>
      <div className="tw overflow-x-auto">
        <table className="ct text-sm">
          <thead>
            <tr>
              <th>Date</th>
              <th>Action</th>
              <th>Entité</th>
              <th>Id</th>
              <th>Par</th>
              <th>Changements</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap">{a.performed_at}</td>
                <td>{a.action}</td>
                <td>{a.entity_type}</td>
                <td>{a.entity_id}</td>
                <td>{a.performed_by}</td>
                <td className="max-w-md truncate font-mono text-xs" title={JSON.stringify(a.changes)}>
                  {a.changes ? JSON.stringify(a.changes) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
