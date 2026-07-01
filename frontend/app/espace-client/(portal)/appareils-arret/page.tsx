"use client";

import { useEffect, useState } from "react";
import { clientApiFetch, clientApiBlob } from "@/lib/client-api";

type AppareilArretRow = {
  id: number;
  numeroAppareil: string;
  adresse: string | null;
  dateArret: string | null;
  cause: string | null;
  etape: string | null;
  piecesEnStock: boolean | null;
  devisNumero: string | null;
  devisDate: string | null;
  osNumero: string | null;
  executionDate: string | null;
  remiseDate: string | null;
  commentaire: string | null;
  entreprise: string;
};

type ApiResponse = {
  weeks: string[];
  weekStart: string | null;
  rows: AppareilArretRow[];
};

function fmtDate(v: string | null) {
  if (!v) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return new Date(`${v}T12:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  }
  return v;
}

export default function AppareilsArretPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [weekStart, setWeekStart] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await clientApiBlob(
        `/api/client/appareils-arret/export-excel${weekStart ? `?weekStart=${encodeURIComponent(weekStart)}` : ""}`
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `appareils-arret-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Impossible de générer l'export Excel.");
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    void clientApiFetch<ApiResponse>("/api/client/appareils-arret")
      .then((d) => { setData(d); setWeekStart(d.weekStart ?? ""); })
      .catch(() => setError("Impossible de charger les appareils à l'arrêt."));
  }, []);

  useEffect(() => {
    if (!weekStart) return;
    void clientApiFetch<ApiResponse>(`/api/client/appareils-arret?weekStart=${encodeURIComponent(weekStart)}`)
      .then(setData)
      .catch(() => setError("Impossible de charger les appareils à l'arrêt."));
  }, [weekStart]);

  const rows = data?.rows ?? [];
  const weeks = data?.weeks ?? [];

  return (
    <div>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--navy)", marginBottom: 4 }}>Appareils à l&apos;arrêt</h1>
          <p style={{ fontSize: 13, color: "var(--smoke)" }}>
            Suivi hebdomadaire transmis par votre ascensoriste — un appareil à l&apos;arrêt apparaît tant qu&apos;il n&apos;a pas été remis en service.
          </p>
        </div>
        {rows.length > 0 && (
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting}
            style={{
              background: "var(--navy)", color: "#fff", border: "none", borderRadius: 8,
              padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: exporting ? "default" : "pointer",
              opacity: exporting ? 0.6 : 1, whiteSpace: "nowrap",
            }}
          >
            {exporting ? "Génération…" : "⬇ Télécharger en Excel"}
          </button>
        )}
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", color: "#dc2626", marginBottom: 24 }}>
          {error}
        </div>
      )}

      {data !== null && weeks.length > 0 && (
        <div style={{
          background: "#fff", border: "1px solid var(--g200)", borderRadius: 12,
          padding: "16px 20px", marginBottom: 20, display: "flex", gap: 16, alignItems: "flex-end",
        }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
            <span style={{ color: "var(--smoke)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6 }}>Semaine</span>
            <select
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              style={{ border: "1px solid var(--g200)", borderRadius: 8, padding: "7px 10px", fontSize: 13, background: "#fff", minWidth: 220 }}
            >
              {weeks.map((w) => (
                <option key={w} value={w}>Semaine du {fmtDate(w)}</option>
              ))}
            </select>
          </label>
          <span style={{ fontSize: 12, color: "var(--smoke)" }}>{rows.length} appareil(s) à l&apos;arrêt cette semaine</span>
        </div>
      )}

      {data === null && !error && (
        <div style={{ color: "var(--smoke)", padding: "40px 0", textAlign: "center" }}>Chargement…</div>
      )}

      {data !== null && weeks.length === 0 && (
        <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, padding: "60px 0", textAlign: "center", color: "var(--smoke)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🛗</div>
          Aucun appareil à l&apos;arrêt signalé pour le moment.
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "var(--g50)" }}>
                <tr>
                  {["Appareil", "Adresse", "Date d'arrêt", "Cause / Étape", "Devis", "Validation / OS", "Remise en service", "Commentaire"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: 11, color: "var(--smoke)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--g100)" }}>
                    <td style={{ padding: "14px 16px", fontWeight: 700, fontSize: 13, color: "var(--navy)", whiteSpace: "nowrap" }}>{r.numeroAppareil}</td>
                    <td style={{ padding: "14px 16px", fontSize: 13 }}>{r.adresse ?? "—"}</td>
                    <td style={{ padding: "14px 16px", fontSize: 13, whiteSpace: "nowrap" }}>{fmtDate(r.dateArret)}</td>
                    <td style={{ padding: "14px 16px", fontSize: 13 }}>{r.etape ?? r.cause ?? "—"}</td>
                    <td style={{ padding: "14px 16px", fontSize: 13 }}>
                      {r.devisNumero ?? "—"}
                      {r.devisDate && <div style={{ fontSize: 11, color: "var(--smoke)" }}>{fmtDate(r.devisDate)}</div>}
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 13 }}>{r.osNumero ?? "—"}</td>
                    <td style={{ padding: "14px 16px", fontSize: 13, whiteSpace: "nowrap" }}>{fmtDate(r.remiseDate)}</td>
                    <td style={{ padding: "14px 16px", fontSize: 12, color: "var(--smoke)", maxWidth: 280 }}>{r.commentaire ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
