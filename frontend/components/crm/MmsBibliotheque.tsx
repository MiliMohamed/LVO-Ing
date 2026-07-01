"use client";

import { useCallback, useEffect, useState } from "react";

import { exploitationApiFetch as apiFetch } from "@/lib/exploitation-api";
import { getApiBaseUrl } from "@/lib/config";
import { readExploitationToken as readToken } from "@/lib/token-storage";
import type { MmsRapportMeta } from "@/lib/types";

const moneyFr = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const TRIMESTRES = ["T1", "T2", "T3", "T4"] as const;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

async function downloadRapport(id: number, type: "excel" | "word" | "pdf", fileName: string) {
  const url = `${getApiBaseUrl()}/api/mms/rapports/${id}/download/${type}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${readToken()}` } });
  if (!res.ok) throw new Error(`${res.status}`);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(href);
}

type RapportRowProps = Readonly<{
  rapport: MmsRapportMeta;
  onDeleted: () => void;
}>;

function RapportRow({ rapport, onDeleted }: RapportRowProps) {
  const [busy, setBusy] = useState(false);

  async function supprimer() {
    if (!globalThis.confirm("Supprimer ce rapport archivé ?")) return;
    setBusy(true);
    try {
      await apiFetch(`/api/mms/rapports/${rapport.id}`, { token: readToken(), method: "DELETE" });
      onDeleted();
    } catch {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        background: "var(--g50)",
        borderRadius: 8,
        border: "1px solid var(--g200)",
      }}
    >
      <div style={{ flex: 1, minWidth: 160 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", margin: 0 }}>
          {rapport.prestataire} — {rapport.trimestre} {rapport.annee}
          {rapport.client ? <span style={{ fontWeight: 400, color: "var(--g600)" }}> · {rapport.client}</span> : null}
        </p>
        <p style={{ fontSize: 12, color: "var(--g500)", margin: "2px 0 0" }}>
          {new Date(rapport.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px 16px",
          fontSize: 12,
          color: "var(--g700)",
          minWidth: 200,
        }}
      >
        <span>{rapport.nbAppareils} appareils</span>
        <span>{rapport.nbPannes} pannes</span>
        <span>{rapport.nbVisites} visites</span>
        <span style={{ color: rapport.penaliteTotale > 0 ? "#b45309" : "var(--g500)", fontWeight: 600 }}>
          {moneyFr.format(rapport.penaliteTotale)}
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {rapport.hasExcel ? (
          <button
            type="button"
            className="cbtn cbtn-orange cbtn-sm"
            onClick={() => void downloadRapport(rapport.id, "excel", rapport.excelNom)}
            title={`Excel — ${formatBytes(rapport.excelSizeBytes)}`}
          >
            Excel
          </button>
        ) : null}
        {rapport.hasWord ? (
          <button
            type="button"
            className="cbtn cbtn-ghost cbtn-sm"
            onClick={() => void downloadRapport(rapport.id, "word", rapport.wordNom)}
            title={`Word — ${formatBytes(rapport.wordSizeBytes)}`}
          >
            Word
          </button>
        ) : null}
        {rapport.hasPdf && rapport.pdfNom ? (
          <button
            type="button"
            className="cbtn cbtn-ghost cbtn-sm"
            onClick={() => void downloadRapport(rapport.id, "pdf", rapport.pdfNom!)}
            title={`PDF — ${rapport.pdfSizeBytes ? formatBytes(rapport.pdfSizeBytes) : ""}`}
          >
            PDF
          </button>
        ) : null}
        <button
          type="button"
          className="cbtn cbtn-danger cbtn-sm"
          disabled={busy}
          onClick={() => void supprimer()}
        >
          {busy ? "…" : "Supprimer"}
        </button>
      </div>
    </div>
  );
}

type GroupMode = "prestataire" | "flat";

export function MmsBibliotheque() {
  const [rapports, setRapports] = useState<MmsRapportMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filterPrestataire, setFilterPrestataire] = useState("all");
  const [filterTrimestre, setFilterTrimestre] = useState("all");
  const [filterAnnee, setFilterAnnee] = useState("all");
  const [groupMode, setGroupMode] = useState<GroupMode>("prestataire");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterPrestataire !== "all") params.set("prestataire", filterPrestataire);
      if (filterTrimestre !== "all") params.set("trimestre", filterTrimestre);
      if (filterAnnee !== "all") params.set("annee", filterAnnee);
      const qs = params.toString();
      const data = (await apiFetch(`/api/mms/rapports${qs ? `?${qs}` : ""}`, {
        token: readToken(),
      })) as MmsRapportMeta[] | null;
      setRapports(Array.isArray(data) ? data : []);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [filterPrestataire, filterTrimestre, filterAnnee]);

  useEffect(() => {
    void load();
  }, [load, tick]);

  function toggleCollapse(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const prestataires = [...new Set(rapports.map((r) => r.prestataire))].sort();
  const annees = [...new Set(rapports.map((r) => r.annee))].sort((a, b) => b - a);

  function renderFlat(list: MmsRapportMeta[]) {
    if (list.length === 0) {
      return <p style={{ fontSize: 13, color: "var(--g500)", padding: "8px 0" }}>Aucun rapport archivé.</p>;
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {list.map((r) => (
          <RapportRow key={r.id} rapport={r} onDeleted={() => setTick((v) => v + 1)} />
        ))}
      </div>
    );
  }

  function renderGrouped(list: MmsRapportMeta[]) {
    if (list.length === 0) {
      return <p style={{ fontSize: 13, color: "var(--g500)", padding: "8px 0" }}>Aucun rapport archivé.</p>;
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {prestataires
          .filter((p) => list.some((r) => r.prestataire === p))
          .map((prest) => {
            const byPrest = list.filter((r) => r.prestataire === prest);
            const anneesForPrest = [...new Set(byPrest.map((r) => r.annee))].sort((a, b) => b - a);
            const prestKey = `p:${prest}`;
            const prestOpen = !collapsed.has(prestKey);

            return (
              <div
                key={prest}
                style={{ border: "1px solid var(--g200)", borderRadius: 10, overflow: "hidden" }}
              >
                <button
                  type="button"
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    background: "var(--navy)",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  onClick={() => toggleCollapse(prestKey)}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>
                    {prest}
                    <span style={{ fontWeight: 400, opacity: 0.75, marginLeft: 8 }}>
                      ({byPrest.length} rapport{byPrest.length > 1 ? "s" : ""})
                    </span>
                  </span>
                  <span style={{ fontSize: 12, opacity: 0.8 }}>{prestOpen ? "▲" : "▼"}</span>
                </button>

                {prestOpen ? (
                  <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
                    {anneesForPrest.map((annee) => {
                      const byAnnee = byPrest.filter((r) => r.annee === annee);
                      const anneeKey = `p:${prest}:a:${annee}`;
                      const anneeOpen = !collapsed.has(anneeKey);

                      return (
                        <div key={annee}>
                          <button
                            type="button"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              width: "100%",
                              background: "none",
                              border: "none",
                              borderBottom: "1px solid var(--g200)",
                              cursor: "pointer",
                              padding: "4px 0 6px",
                              marginBottom: 6,
                              textAlign: "left",
                            }}
                            onClick={() => toggleCollapse(anneeKey)}
                          >
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)" }}>
                              {annee}
                            </span>
                            <span style={{ fontSize: 12, color: "var(--g500)" }}>
                              ({byAnnee.length} rapport{byAnnee.length > 1 ? "s" : ""})
                            </span>
                            <span style={{ fontSize: 11, color: "var(--g400)", marginLeft: "auto" }}>
                              {anneeOpen ? "▲" : "▼"}
                            </span>
                          </button>

                          {anneeOpen ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {TRIMESTRES.filter((t) => byAnnee.some((r) => r.trimestre === t)).map((t) => {
                                const byTrimestre = byAnnee.filter((r) => r.trimestre === t);
                                return byTrimestre.map((r) => (
                                  <RapportRow key={r.id} rapport={r} onDeleted={() => setTick((v) => v + 1)} />
                                ));
                              })}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
      </div>
    );
  }

  return (
    <div className="fcard" style={{ marginTop: 24 }}>
      <div className="fcard-hdr" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ flex: 1, margin: 0 }}>Bibliothèque MMS</h2>
        <span style={{ fontSize: 12, color: "var(--g500)" }}>
          {rapports.length} rapport{rapports.length > 1 ? "s" : ""} archivé{rapports.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="fcard-body">
        {/* Filters */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 16,
            paddingBottom: 14,
            borderBottom: "1px solid var(--g200)",
          }}
        >
          <label className="crm-field" style={{ flex: "1 1 140px" }}>
            <span className="crm-label">Prestataire</span>
            <select
              className="crm-select"
              value={filterPrestataire}
              onChange={(e) => setFilterPrestataire(e.target.value)}
            >
              <option value="all">Tous</option>
              {prestataires.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="crm-field" style={{ flex: "1 1 110px" }}>
            <span className="crm-label">Trimestre</span>
            <select
              className="crm-select"
              value={filterTrimestre}
              onChange={(e) => setFilterTrimestre(e.target.value)}
            >
              <option value="all">Tous</option>
              {TRIMESTRES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="crm-field" style={{ flex: "1 1 110px" }}>
            <span className="crm-label">Année</span>
            <select
              className="crm-select"
              value={filterAnnee}
              onChange={(e) => setFilterAnnee(e.target.value)}
            >
              <option value="all">Toutes</option>
              {annees.map((a) => (
                <option key={a} value={String(a)}>
                  {a}
                </option>
              ))}
            </select>
          </label>

          <label className="crm-field" style={{ flex: "1 1 140px" }}>
            <span className="crm-label">Affichage</span>
            <select
              className="crm-select"
              value={groupMode}
              onChange={(e) => setGroupMode(e.target.value as GroupMode)}
            >
              <option value="prestataire">Par prestataire</option>
              <option value="flat">Liste simple</option>
            </select>
          </label>
        </div>

        {loading ? (
          <p style={{ fontSize: 13, color: "var(--g500)" }}>Chargement…</p>
        ) : err ? (
          <p className="crm-alert crm-alert--error">{err}</p>
        ) : groupMode === "flat" ? (
          renderFlat(rapports)
        ) : (
          renderGrouped(rapports)
        )}
      </div>
    </div>
  );
}
