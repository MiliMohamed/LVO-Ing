"use client";

import { useEffect, useRef, useState } from "react";
import { clientApiFetch, clientApiDelete, clientApiUpload } from "@/lib/client-api";
import { getApiBaseUrl } from "@/lib/config";
import { readClientToken } from "@/lib/token-storage";

type ClientDocStatut = "EN_ATTENTE" | "VALIDE" | "REJETE";

type ClientDocument = {
  id: number;
  nom: string;
  type: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
  uploadedAt: string;
  statut: ClientDocStatut;
  motifRejet?: string | null;
  notes: string | null;
  /** Multi-sites : id du site associé au document */
  siteId?: number | null;
};

const STATUT_BADGE: Record<ClientDocStatut, { label: string; color: string; bg: string; border: string }> = {
  EN_ATTENTE: { label: "En attente de validation", color: "#92400e", bg: "#fef3c7", border: "#fcd34d" },
  VALIDE: { label: "Validé", color: "#14532d", bg: "#f0fdf4", border: "#86efac" },
  REJETE: { label: "Rejeté", color: "#7f1d1d", bg: "#fef2f2", border: "#fca5a5" },
};

const TYPE_LABELS: Record<string, string> = {
  DEVIS: "Devis",
  BON_COMMANDE: "Bon de commande",
  PLAN: "Plan",
  RAPPORT: "Rapport",
  CERTIFICAT: "Certificat",
  AUTRE: "Autre",
};

const TYPE_COLORS: Record<string, string> = {
  DEVIS: "#2563eb",
  BON_COMMANDE: "#7c3aed",
  PLAN: "#0891b2",
  RAPPORT: "#d97706",
  CERTIFICAT: "#16a34a",
  AUTRE: "#6b7280",
};

function formatBytes(b: number) {
  if (b < 1024) return `${b} o`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} Ko`;
  return `${(b / 1024 / 1024).toFixed(1)} Mo`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<ClientDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [nom, setNom] = useState("");
  const [type, setType] = useState("AUTRE");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem("lvo_client_selected_site_id");
    const n = raw ? Number(raw) : null;
    setSelectedSiteId(Number.isFinite(n as number) ? n : null);

    const handler = () => {
      const raw2 = window.localStorage.getItem("lvo_client_selected_site_id");
      const n2 = raw2 ? Number(raw2) : null;
      setSelectedSiteId(Number.isFinite(n2 as number) ? n2 : null);
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  async function load(siteId: number | null) {
    try {
      const url = siteId != null ? `/api/client/documents?siteId=${siteId}` : `/api/client/documents`;
      const data = await clientApiFetch<ClientDocument[]>(url);
      setDocs(data);
    } catch {
      setError("Impossible de charger les documents.");
    }
  }

  useEffect(() => {
    void load(selectedSiteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSiteId]);


  async function upload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("nom", nom || file.name);
      fd.append("type", type);
      if (notes) fd.append("notes", notes);
      if (selectedSiteId != null) fd.append("siteId", String(selectedSiteId));
      await clientApiUpload("/api/client/documents", fd);
      setSuccess("Document déposé avec succès.");
      setFile(null);
      setNom("");
      setNotes("");
      if (fileRef.current) fileRef.current.value = "";
      await load(selectedSiteId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors du dépôt.");
    } finally {
      setUploading(false);
    }
  }

  async function deleteDoc(id: number, nom: string) {
    if (!confirm(`Supprimer « ${nom} » ?`)) return;
    try {
      await clientApiDelete(`/api/client/documents/${id}`);
      await load(selectedSiteId);
    } catch {
      setError("Suppression impossible.");
    }
  }

  function download(id: number) {
    const base = getApiBaseUrl();
    const token = readClientToken();
    const a = document.createElement("a");
    a.href = `${base}/api/client/documents/${id}/download`;
    a.setAttribute("data-token", token ?? "");
    window.open(`${base}/api/client/documents/${id}/download?token=${token ?? ""}`, "_blank");
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--navy)", marginBottom: 24 }}>Mes documents</h1>

      {/* Upload zone */}
      <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--navy)", marginBottom: 16 }}>Déposer un document</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--smoke)", display: "block", marginBottom: 4 }}>Nom du document</label>
            <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. : Devis rénovation ascenseur" style={{ width: "100%", border: "1px solid var(--g200)", borderRadius: 8, padding: "9px 12px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--smoke)", display: "block", marginBottom: 4 }}>Type de document</label>
            <select value={type} onChange={(e) => setType(e.target.value)} style={{ width: "100%", border: "1px solid var(--g200)", borderRadius: 8, padding: "9px 12px", fontSize: 13, outline: "none", background: "#fff", boxSizing: "border-box" }}>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: "var(--smoke)", display: "block", marginBottom: 4 }}>Notes (optionnel)</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Commentaire ou référence interne…" style={{ width: "100%", border: "1px solid var(--g200)", borderRadius: 8, padding: "9px 12px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: "var(--smoke)", display: "block", marginBottom: 4 }}>Fichier <span style={{ color: "#dc2626" }}>*</span></label>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ fontSize: 13 }} />
          <div style={{ fontSize: 11, color: "var(--smoke)", marginTop: 4 }}>PDF, Word, Excel, images — max 20 Mo</div>
        </div>
        {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", color: "#dc2626", marginBottom: 12, fontSize: 13 }}>{error}</div>}
        {success && <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", color: "#16a34a", marginBottom: 12, fontSize: 13 }}>{success}</div>}
        <button onClick={upload} disabled={!file || uploading} style={{ background: "var(--orange)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: !file || uploading ? 0.6 : 1 }}>
          {uploading ? "Dépôt en cours…" : "Déposer le document"}
        </button>
      </div>

      {/* Document list */}
      <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--g100)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: "var(--navy)" }}>Documents déposés</span>
          <span style={{ fontSize: 12, color: "var(--smoke)" }}>{docs.length} fichier{docs.length > 1 ? "s" : ""}</span>
        </div>
        {docs.length === 0 && (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--smoke)", fontSize: 13 }}>Aucun document déposé pour le moment.</div>
        )}
        {docs.map((d) => (
          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: "1px solid var(--g100)" }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: TYPE_COLORS[d.type] ?? "#6b7280", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
              📄
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "var(--navy)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.nom}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
                <span style={{ background: `${TYPE_COLORS[d.type] ?? "#6b7280"}18`, color: TYPE_COLORS[d.type] ?? "#6b7280", borderRadius: 4, padding: "1px 6px", fontSize: 11, fontWeight: 600 }}>{TYPE_LABELS[d.type] ?? d.type}</span>
                <span
                  style={{
                    background: STATUT_BADGE[d.statut]?.bg ?? "#f3f4f6",
                    color: STATUT_BADGE[d.statut]?.color ?? "#6b7280",
                    border: `1px solid ${STATUT_BADGE[d.statut]?.border ?? "#e5e7eb"}`,
                    borderRadius: 999,
                    padding: "1px 8px",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {STATUT_BADGE[d.statut]?.label ?? d.statut}
                </span>
                <span style={{ fontSize: 11, color: "var(--smoke)" }}>{formatBytes(d.sizeBytes)}</span>
                <span style={{ fontSize: 11, color: "var(--smoke)" }}>{formatDate(d.uploadedAt)}</span>
                {d.statut === "REJETE" && d.motifRejet && (
                  <span style={{ fontSize: 11, color: "var(--smoke)", fontStyle: "italic" }}>
                    Motif : {d.motifRejet}
                  </span>
                )}
                {d.notes && <span style={{ fontSize: 11, color: "var(--smoke)", fontStyle: "italic" }}>{d.notes}</span>}

              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => download(d.id)} style={{ background: "var(--g50)", border: "1px solid var(--g200)", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer", color: "var(--navy)" }}>Télécharger</button>
              <button onClick={() => deleteDoc(d.id, d.nom)} style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer", color: "#dc2626" }}>Supprimer</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
