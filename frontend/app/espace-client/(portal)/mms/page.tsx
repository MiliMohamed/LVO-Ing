"use client";

import { useEffect, useState, useCallback } from "react";
import { clientApiFetch } from "@/lib/client-api";
import { getApiBaseUrl } from "@/lib/config";
import { readClientToken } from "@/lib/token-storage";

type MmsRow = {
  id: number;
  prestataire: string;
  trimestre: string;
  annee: number;
  nbAppareils: number;
  nbInterventions: number;
  nbPannes: number;
  nbVisites: number;
  penaliteTotale: number;
  createdAt: string;
  scoreMms: number | null;
  hasExcel: boolean;
  hasWord: boolean;
  hasPdf: boolean;
  excelNom: string | null;
  wordNom: string | null;
  pdfNom: string | null;
};

type SiteSimple = { id: number; nom: string };

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span style={{ color: "var(--smoke)", fontSize: 12 }}>—</span>;
  const color = score >= 80 ? "#16a34a" : score >= 60 ? "#d97706" : "#dc2626";
  const bg    = score >= 80 ? "#f0fdf4" : score >= 60 ? "#fffbeb" : "#fef2f2";
  return (
    <span style={{
      fontWeight: 800, fontSize: 16, color,
      background: bg, borderRadius: 8,
      padding: "3px 10px", display: "inline-block",
    }}>
      {score}/100
    </span>
  );
}

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return null;
  const color = score >= 80 ? "#16a34a" : score >= 60 ? "#d97706" : "#dc2626";
  return (
    <div style={{ height: 6, background: "var(--g200)", borderRadius: 3, overflow: "hidden", width: "100%", minWidth: 80 }}>
      <div style={{ height: "100%", width: `${score}%`, background: color, borderRadius: 3, transition: "width 0.4s" }} />
    </div>
  );
}

function DownloadBtn({ rapportId, type, label, fileName }: {
  rapportId: number; type: "excel" | "word" | "pdf"; label: string; fileName: string | null;
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const base = getApiBaseUrl();
      const token = readClientToken();
      const res = await fetch(`${base}/api/client/mms/${rapportId}/download/${type}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Fichier non disponible.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName ?? `rapport-${type}.${type === "excel" ? "xlsx" : type === "word" ? "docx" : "pdf"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Erreur lors du téléchargement du fichier.");
    } finally {
      setLoading(false);
    }
  }

  const colors: Record<string, { bg: string; text: string }> = {
    excel: { bg: "#f0fdf4", text: "#16a34a" },
    word:  { bg: "#eff6ff", text: "#2563eb" },
    pdf:   { bg: "#fef2f2", text: "#dc2626" },
  };
  const c = colors[type];

  return (
    <button
      onClick={() => void handleClick()}
      disabled={loading}
      title={fileName ?? label}
      style={{
        background: c.bg, color: c.text, border: `1px solid ${c.text}33`,
        borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700,
        cursor: loading ? "wait" : "pointer", whiteSpace: "nowrap",
      }}
    >
      {loading ? "…" : label}
    </button>
  );
}

function FilterSelect({
  label, value, options, onChange,
}: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
      <span style={{ color: "var(--smoke)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          border: "1px solid var(--g200)", borderRadius: 8, padding: "7px 10px",
          fontSize: 13, background: "#fff", minWidth: 130,
        }}
      >
        <option value="">Tous</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export default function MmsPage() {
  const [allRapports, setAllRapports] = useState<MmsRow[] | null>(null);
  const [sites, setSites] = useState<SiteSimple[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [filtreAnnee, setFiltreAnnee]         = useState("");
  const [filtreTrimestre, setFiltreTrimestre] = useState("");
  const [filtrePrestataire, setFiltrePrestataire] = useState("");
  const [filtreSite, setFiltreSite]           = useState("");

  const buildQuery = useCallback(() => {
    const p = new URLSearchParams();
    if (filtreAnnee)       p.set("annee", filtreAnnee);
    if (filtreTrimestre)   p.set("trimestre", filtreTrimestre);
    if (filtrePrestataire) p.set("prestataire", filtrePrestataire);
    if (filtreSite)        p.set("siteId", filtreSite);
    return p.toString() ? `?${p.toString()}` : "";
  }, [filtreAnnee, filtreTrimestre, filtrePrestataire, filtreSite]);

  useEffect(() => {
    void clientApiFetch<MmsRow[]>("/api/client/mms")
      .then(setAllRapports)
      .catch(() => setError("Impossible de charger les analyses MMS."));
    void clientApiFetch<SiteSimple[]>("/api/client/sites").then(setSites).catch(() => null);
  }, []);

  const [rapports, setRapports] = useState<MmsRow[] | null>(null);
  useEffect(() => {
    if (allRapports === null) return;
    void clientApiFetch<MmsRow[]>(`/api/client/mms${buildQuery()}`)
      .then(setRapports)
      .catch(() => setRapports([]));
  }, [allRapports, buildQuery]);

  const displayed = rapports ?? allRapports ?? [];

  const scoreMoyen = displayed.length > 0
    ? Math.round(displayed.filter((r) => r.scoreMms !== null).reduce((s, r) => s + (r.scoreMms ?? 0), 0) / Math.max(1, displayed.filter((r) => r.scoreMms !== null).length))
    : null;
  const totalPannes    = displayed.reduce((s, r) => s + r.nbPannes, 0);
  const totalPenalites = displayed.reduce((s, r) => s + r.penaliteTotale, 0);

  // Options de filtres construites depuis tous les rapports
  const annees = [...new Set((allRapports ?? []).map((r) => String(r.annee)))].sort((a, b) => Number(b) - Number(a));
  const prestataires = [...new Set((allRapports ?? []).map((r) => r.prestataire))].sort();

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--navy)", marginBottom: 4 }}>Analyse MMS</h1>
        <p style={{ fontSize: 13, color: "var(--smoke)" }}>
          Manquements, Mises en Sécurité — suivi de performance de vos prestataires de maintenance
        </p>
      </div>

      {/* KPI */}
      {allRapports !== null && allRapports.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Score MMS moyen", value: scoreMoyen !== null ? `${scoreMoyen}/100` : "—", color: scoreMoyen !== null ? (scoreMoyen >= 80 ? "#16a34a" : scoreMoyen >= 60 ? "#d97706" : "#dc2626") : "var(--navy)", icon: "📊" },
            { label: "Rapports", value: displayed.length, color: "var(--navy)", icon: "📋" },
            { label: "Total pannes", value: totalPannes, color: totalPannes > 10 ? "#dc2626" : "#d97706", icon: "🔴" },
            { label: "Pénalités cumulées", value: `${totalPenalites.toLocaleString("fr-FR")} €`, color: totalPenalites > 0 ? "#dc2626" : "#16a34a", icon: "💶" },
          ].map((k) => (
            <div key={k.label} style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ fontSize: 18, marginBottom: 6 }}>{k.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 11, color: "var(--smoke)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6 }}>{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filtres */}
      {allRapports !== null && allRapports.length > 0 && (
        <div style={{
          background: "#fff", border: "1px solid var(--g200)", borderRadius: 12,
          padding: "16px 20px", marginBottom: 20,
          display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end",
        }}>
          <FilterSelect
            label="Année"
            value={filtreAnnee}
            options={annees.map((a) => ({ value: a, label: a }))}
            onChange={setFiltreAnnee}
          />
          <FilterSelect
            label="Trimestre"
            value={filtreTrimestre}
            options={[
              { value: "1", label: "T1 (Jan–Mar)" },
              { value: "2", label: "T2 (Avr–Jun)" },
              { value: "3", label: "T3 (Jul–Sep)" },
              { value: "4", label: "T4 (Oct–Déc)" },
            ]}
            onChange={setFiltreTrimestre}
          />
          <FilterSelect
            label="Prestataire"
            value={filtrePrestataire}
            options={prestataires.map((p) => ({ value: p, label: p }))}
            onChange={setFiltrePrestataire}
          />
          {sites.length > 0 && (
            <FilterSelect
              label="Site"
              value={filtreSite}
              options={sites.map((s) => ({ value: String(s.id), label: s.nom }))}
              onChange={setFiltreSite}
            />
          )}
          {(filtreAnnee || filtreTrimestre || filtrePrestataire || filtreSite) && (
            <button
              onClick={() => { setFiltreAnnee(""); setFiltreTrimestre(""); setFiltrePrestataire(""); setFiltreSite(""); }}
              style={{ background: "none", border: "1px solid var(--g200)", borderRadius: 8, padding: "7px 14px", fontSize: 12, cursor: "pointer", color: "var(--smoke)" }}
            >
              Réinitialiser
            </button>
          )}
        </div>
      )}

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", color: "#dc2626", marginBottom: 24 }}>
          {error}
        </div>
      )}

      {allRapports === null && !error && (
        <div style={{ color: "var(--smoke)", padding: "40px 0", textAlign: "center" }}>Chargement…</div>
      )}

      {allRapports !== null && allRapports.length === 0 && (
        <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, padding: "60px 0", textAlign: "center", color: "var(--smoke)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
          Aucun rapport MMS disponible pour le moment.<br />
          <span style={{ fontSize: 13 }}>LVO Ingénierie publie les rapports après chaque période de suivi.</span>
        </div>
      )}

      {allRapports !== null && allRapports.length > 0 && displayed.length === 0 && (
        <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, padding: "40px", textAlign: "center", color: "var(--smoke)" }}>
          Aucun rapport ne correspond aux filtres sélectionnés.
        </div>
      )}

      {displayed.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "var(--g50)" }}>
                <tr>
                  {["Période", "Prestataire", "Appareils", "Visites", "Pannes", "Score MMS", "Pénalités", "Fichiers"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: 11, color: "var(--smoke)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--g100)" }}>
                    <td style={{ padding: "14px 16px", fontWeight: 700, fontSize: 13, color: "var(--navy)", whiteSpace: "nowrap" }}>
                      T{r.trimestre} {r.annee}
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 13 }}>{r.prestataire}</td>
                    <td style={{ padding: "14px 16px", fontSize: 13, textAlign: "center" }}>{r.nbAppareils}</td>
                    <td style={{ padding: "14px 16px", fontSize: 13, textAlign: "center" }}>{r.nbVisites}</td>
                    <td style={{ padding: "14px 16px", fontSize: 13, textAlign: "center", fontWeight: r.nbPannes > 0 ? 700 : 400, color: r.nbPannes > 3 ? "#dc2626" : "inherit" }}>
                      {r.nbPannes}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <ScoreBadge score={r.scoreMms} />
                        <ScoreBar score={r.scoreMms} />
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: r.penaliteTotale > 0 ? 700 : 400, color: r.penaliteTotale > 0 ? "#dc2626" : "#16a34a", whiteSpace: "nowrap" }}>
                      {r.penaliteTotale > 0 ? `${r.penaliteTotale.toLocaleString("fr-FR")} €` : "Aucune"}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {r.hasExcel && <DownloadBtn rapportId={r.id} type="excel" label="Excel" fileName={r.excelNom} />}
                        {r.hasWord  && <DownloadBtn rapportId={r.id} type="word"  label="Word"  fileName={r.wordNom} />}
                        {r.hasPdf   && <DownloadBtn rapportId={r.id} type="pdf"   label="PDF"   fileName={r.pdfNom} />}
                        {!r.hasExcel && !r.hasWord && !r.hasPdf && (
                          <span style={{ fontSize: 11, color: "var(--smoke)" }}>—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {allRapports !== null && allRapports.length === 0 && (
        <div style={{ marginTop: 20, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "16px 20px", fontSize: 13, color: "#92400e" }}>
          <strong>Info :</strong> Les rapports MMS sont générés par LVO Ingénierie après analyse de vos données de maintenance.
          Contactez votre chargé de projet pour obtenir votre premier bilan.
        </div>
      )}
    </div>
  );
}
