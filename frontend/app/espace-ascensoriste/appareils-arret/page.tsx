"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { LVO_LOGO_ALT, LVO_LOGO_SRC } from "@/lib/branding";
import { getApiBaseUrl } from "@/lib/config";
import { ascensoristeApiFetch, ascensoristeApiUpload } from "@/lib/ascensoriste-api";
import { clearAscensoristeSession, readAscensoristeProfile, readAscensoristeToken } from "@/lib/token-storage";

type Upload = {
  id: number;
  fileName: string;
  weekStart: string;
  weekEnd: string;
  rowsCount: number;
  rowsErrors: number;
  createdAt: string;
};

type UploadResult = {
  upload: Upload;
  rowsCount: number;
  rowsErrors: number;
  errors: string[];
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function EspaceAscensoristeAppareilsArretPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ReturnType<typeof readAscensoristeProfile>>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lastResult, setLastResult] = useState<UploadResult | null>(null);
  const [exporting, setExporting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await ascensoristeApiFetch<Upload[]>("/api/ascensoriste/appareils-arret");
      setUploads(Array.isArray(data) ? data : []);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { setProfile(readAscensoristeProfile()); void load(); }, []);

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setErr(null);
    setLastResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await ascensoristeApiUpload<UploadResult>("/api/ascensoriste/appareils-arret/upload", fd);
      setLastResult(result);
      setFile(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur lors du dépôt du fichier");
    } finally {
      setUploading(false);
    }
  }

  async function downloadUpload(u: Upload) {
    const res = await fetch(`${getApiBaseUrl()}/api/ascensoriste/appareils-arret/${u.id}/download`, {
      headers: { Authorization: `Bearer ${readAscensoristeToken() ?? ""}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = u.fileName;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(href);
  }

  async function downloadExcelReport() {
    setExporting(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/ascensoriste/appareils-arret/export-excel`, {
        headers: { Authorization: `Bearer ${readAscensoristeToken() ?? ""}` },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `appareils-arret-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(href);
    } finally {
      setExporting(false);
    }
  }

  function logout() {
    clearAscensoristeSession();
    router.replace("/espace-ascensoriste/login");
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--g50)" }}>
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 24px", background: "#fff", borderBottom: "1px solid var(--g200)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Image src={LVO_LOGO_SRC} alt={LVO_LOGO_ALT} width={32} height={32} className="object-contain" />
            <span style={{ fontWeight: 700, color: "var(--navy)" }}>Espace Ascensoriste</span>
          </div>
          <nav style={{ display: "flex", gap: 4 }}>
            <Link href="/espace-ascensoriste/devis" style={{ fontSize: 13, color: "var(--g500)", padding: "6px 10px", borderRadius: 6 }}>Devis</Link>
            <Link href="/espace-ascensoriste/appareils-arret" style={{ fontSize: 13, color: "var(--navy)", fontWeight: 700, padding: "6px 10px", borderRadius: 6, background: "var(--g100)" }}>Appareils à l&apos;arrêt</Link>
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {profile && (
            <span style={{ fontSize: 13, color: "var(--g500)" }}>{profile.entreprise} — {profile.prenom} {profile.nom}</span>
          )}
          <button type="button" className="cbtn cbtn-sm" onClick={logout}>Déconnexion</button>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px 60px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 4 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--navy)", margin: 0 }}>Suivi hebdomadaire des appareils à l&apos;arrêt</h1>
          <button type="button" className="cbtn cbtn-sm" onClick={() => void downloadExcelReport()} disabled={exporting}>
            {exporting ? "Génération…" : "⬇ Télécharger le rapport Excel"}
          </button>
        </div>
        <p style={{ color: "var(--g500)", fontSize: 13, marginBottom: 20 }}>
          Déposez chaque semaine le tableau Excel des appareils à l&apos;arrêt de vos clients. La semaine est détectée automatiquement à partir du fichier.
        </p>

        {err && <p className="crm-alert crm-alert--error mb-3">{err}</p>}

        <div className="fcard mb-4">
          <div className="fcard-body">
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)", marginBottom: 12 }}>Déposer le tableau de la semaine</h3>
            <form onSubmit={onUpload} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              <label className="crm-field" style={{ flex: "1 1 280px" }}>
                <span className="crm-label">Fichier Excel (.xlsx) *</span>
                <input
                  className="crm-input"
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  required
                />
              </label>
              <button type="submit" className="cbtn cbtn-orange cbtn-sm" disabled={!file || uploading}>
                {uploading ? "Envoi en cours…" : "Déposer le fichier"}
              </button>
            </form>

            {lastResult && (
              <div className="crm-alert crm-alert--success mt-3" style={{ fontSize: 13 }}>
                Semaine du {fmtDate(lastResult.upload.weekStart)} au {fmtDate(lastResult.upload.weekEnd)} — {lastResult.rowsCount} ligne(s) importée(s)
                {lastResult.rowsErrors > 0 && `, ${lastResult.rowsErrors} ligne(s) en erreur`}.
                {lastResult.errors.length > 0 && (
                  <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                    {lastResult.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <p style={{ color: "var(--g500)", fontSize: 13, padding: 16 }}>Chargement…</p>
        ) : uploads.length === 0 ? (
          <div className="fcard">
            <div className="fcard-body" style={{ textAlign: "center", padding: "40px 0", color: "var(--g500)", fontSize: 13 }}>
              Aucun fichier déposé pour le moment.
            </div>
          </div>
        ) : (
          <div style={{ border: "1px solid var(--g200)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 90px 90px 120px", gap: 0, background: "var(--g50)", borderBottom: "1px solid var(--g200)", padding: "8px 16px" }}>
              {["Fichier", "Semaine", "Lignes", "Erreurs", "Déposé le"].map((h) => (
                <span key={h} style={{ fontSize: 11, fontWeight: 700, color: "var(--g500)", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</span>
              ))}
            </div>
            {uploads.map((u) => (
              <div
                key={u.id}
                onClick={() => void downloadUpload(u)}
                style={{ display: "grid", gridTemplateColumns: "1fr 160px 90px 90px 120px", gap: 0, padding: "12px 16px", borderBottom: "1px solid var(--g100)", background: "#fff", cursor: "pointer" }}
                title="Cliquer pour télécharger le fichier original"
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)" }}>⬇ {u.fileName}</span>
                <span style={{ fontSize: 12, color: "var(--g700)", alignSelf: "center" }}>{fmtDate(u.weekStart)} – {fmtDate(u.weekEnd)}</span>
                <span style={{ fontSize: 13, color: "var(--navy)", alignSelf: "center" }}>{u.rowsCount}</span>
                <span style={{ fontSize: 13, color: u.rowsErrors > 0 ? "#b91c1c" : "var(--g500)", alignSelf: "center" }}>{u.rowsErrors}</span>
                <span style={{ fontSize: 11, color: "var(--g500)", alignSelf: "center" }}>{fmtDate(u.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
