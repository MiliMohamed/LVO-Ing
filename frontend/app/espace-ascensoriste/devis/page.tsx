"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { LVO_LOGO_ALT, LVO_LOGO_SRC } from "@/lib/branding";
import { getApiBaseUrl } from "@/lib/config";
import { ascensoristeApiFetch, ascensoristeApiUpload } from "@/lib/ascensoriste-api";
import { clearAscensoristeSession, readAscensoristeProfile, readAscensoristeToken } from "@/lib/token-storage";

type DevisStatut = "EN_ATTENTE" | "EN_NEGOCIATION" | "VALIDE" | "REFUSE" | "SIGNE" | "TERMINE";

type PvFichier = {
  nom: string;
  url: string;
  sizeBytes: number;
  contentType: string;
};

type Devis = {
  id: number;
  numeroDevis: string;
  clientNom: string;
  numeroAppareil: string | null;
  adresse: string | null;
  dateDevis: string | null;
  objet: string | null;
  montantHt: number | null;
  montantTtc: number | null;
  statut: DevisStatut;
  avisLvo: string | null;
  motifRefus: string | null;
  documentNom: string | null;
  bonCommandeNom: string | null;
  bonCommandeUploadedAt: string | null;
  pvFichiers: PvFichier[];
  pvDate: string | null;
  pvCommentaire: string | null;
  pvUploadedAt: string | null;
  createdAt: string;
};

const STATUT_CFG: Record<DevisStatut, { label: string; color: string; bg: string; border: string; dot: string }> = {
  EN_ATTENTE:       { label: "En attente",    color: "#1e40af", bg: "#eff6ff", border: "#93c5fd", dot: "#3b82f6" },
  EN_NEGOCIATION:   { label: "En négociation", color: "#c2410c", bg: "#fff7ed", border: "#fdba74", dot: "#f97316" },
  VALIDE:           { label: "Validé",         color: "#14532d", bg: "#f0fdf4", border: "#86efac", dot: "#22c55e" },
  REFUSE:           { label: "Refusé",         color: "#7f1d1d", bg: "#fef2f2", border: "#fca5a5", dot: "#ef4444" },
  SIGNE:            { label: "Signé",          color: "#1e1b4b", bg: "#f5f3ff", border: "#a5b4fc", dot: "#6366f1" },
  TERMINE:          { label: "Terminé",        color: "#065f46", bg: "#ecfdf5", border: "#6ee7b7", dot: "#10b981" },
};

function fmtMontant(v: number | null) {
  if (v == null) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(v);
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function EspaceAscensoristeDevisPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ReturnType<typeof readAscensoristeProfile>>(null);
  const [devis, setDevis] = useState<Devis[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Devis | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Redépôt d'un devis refusé
  const [redeposeFile, setRedeposeFile] = useState<File | null>(null);
  const [redeposing, setRedeposing] = useState(false);

  // Dépôt du PV
  const [pvDate, setPvDate] = useState("");
  const [pvCommentaire, setPvCommentaire] = useState("");
  const [pvFiles, setPvFiles] = useState<FileList | null>(null);
  const [pvUploading, setPvUploading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const d = await ascensoristeApiFetch<Devis[]>("/api/ascensoriste/devis-groupement");
      setDevis(Array.isArray(d) ? d : []);
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
    try {
      const fd = new FormData();
      fd.append("file", file);
      await ascensoristeApiUpload("/api/ascensoriste/devis-groupement", fd);
      setFile(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur lors du dépôt du devis");
    } finally {
      setUploading(false);
    }
  }

  async function downloadFile(url: string, filename: string) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${readAscensoristeToken() ?? ""}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(href);
  }

  async function downloadPdf(d: Devis) {
    await downloadFile(`${getApiBaseUrl()}/api/ascensoriste/devis-groupement/${d.id}/download`, d.documentNom ?? "devis.pdf");
  }

  async function downloadPv(d: Devis, pv: PvFichier) {
    await downloadFile(`${getApiBaseUrl()}/api/ascensoriste/devis-groupement/${d.id}/pv/download?file=${encodeURIComponent(pv.url)}`, pv.nom);
  }

  async function refreshSelected() {
    const data = await ascensoristeApiFetch<Devis[]>("/api/ascensoriste/devis-groupement");
    const list = Array.isArray(data) ? data : [];
    setDevis(list);
    setSelected((prev) => (prev ? list.find((d) => d.id === prev.id) ?? null : null));
  }

  async function onRedepose(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !redeposeFile) return;
    setRedeposing(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", redeposeFile);
      await ascensoristeApiUpload(`/api/ascensoriste/devis-groupement/${selected.id}/redeposer`, fd);
      setRedeposeFile(null);
      await refreshSelected();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur lors du redépôt du devis");
    } finally {
      setRedeposing(false);
    }
  }

  async function onPvSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !pvFiles || pvFiles.length === 0) return;
    setPvUploading(true);
    setErr(null);
    try {
      const fd = new FormData();
      if (pvDate) fd.append("date", pvDate);
      fd.append("commentaire", pvCommentaire);
      for (const f of Array.from(pvFiles)) fd.append("files", f);
      await ascensoristeApiUpload(`/api/ascensoriste/devis-groupement/${selected.id}/pv`, fd);
      setPvDate(""); setPvCommentaire(""); setPvFiles(null);
      await refreshSelected();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur lors du dépôt du PV");
    } finally {
      setPvUploading(false);
    }
  }

  function logout() {
    clearAscensoristeSession();
    router.replace("/espace-ascensoriste/login");
  }

  const counts = Object.fromEntries(
    (Object.keys(STATUT_CFG) as DevisStatut[]).map((s) => [s, devis.filter((d) => d.statut === s).length])
  ) as Record<DevisStatut, number>;

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
            <Link href="/espace-ascensoriste/devis" style={{ fontSize: 13, color: "var(--navy)", fontWeight: 700, padding: "6px 10px", borderRadius: 6, background: "var(--g100)" }}>Devis</Link>
            <Link href="/espace-ascensoriste/appareils-arret" style={{ fontSize: 13, color: "var(--g500)", padding: "6px 10px", borderRadius: 6 }}>Appareils à l&apos;arrêt</Link>
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
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--navy)", marginBottom: 4 }}>Mes devis déposés</h1>
        <p style={{ color: "var(--g500)", fontSize: 13, marginBottom: 20 }}>
          Déposez vos devis : l&apos;adresse du destinataire est extraite automatiquement du PDF. LVO Ingénierie les valide puis le client final dépose le bon de commande.
        </p>

        {err && <p className="crm-alert crm-alert--error mb-3">{err}</p>}

        {/* Dépôt d'un devis */}
        <div className="fcard mb-4">
          <div className="fcard-body">
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)", marginBottom: 12 }}>Déposer un nouveau devis</h3>
            <form onSubmit={onUpload} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              <label className="crm-field" style={{ flex: "1 1 240px" }}>
                <span className="crm-label">Devis (PDF) *</span>
                <input
                  className="crm-input"
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  required
                />
              </label>
              <button type="submit" className="cbtn cbtn-orange cbtn-sm" disabled={!file || uploading}>
                {uploading ? "Dépôt en cours…" : "Déposer le devis"}
              </button>
            </form>
            <p style={{ fontSize: 12, color: "var(--g500)", marginTop: 10 }}>
              L&apos;adresse du destinataire est automatiquement extraite du PDF déposé.
            </p>
          </div>
        </div>

        {/* KPI */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {(Object.entries(STATUT_CFG) as [DevisStatut, typeof STATUT_CFG[DevisStatut]][]).map(([s, cfg]) => (
            <div key={s} style={{
              display: "flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 8,
              border: `1.5px solid ${cfg.border}`, background: cfg.bg, color: cfg.color, fontSize: 12, fontWeight: 600,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.dot, display: "inline-block" }} />
              {cfg.label}
              <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 11, opacity: 0.8 }}>{counts[s]}</span>
            </div>
          ))}
        </div>

        {/* Liste */}
        {loading ? (
          <p style={{ color: "var(--g500)", fontSize: 13, padding: 16 }}>Chargement…</p>
        ) : devis.length === 0 ? (
          <div className="fcard">
            <div className="fcard-body" style={{ textAlign: "center", padding: "40px 0", color: "var(--g500)", fontSize: 13 }}>
              Aucun devis déposé pour le moment.
            </div>
          </div>
        ) : (
          <div style={{ border: "1px solid var(--g200)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 120px 110px 90px", gap: 0, background: "var(--g50)", borderBottom: "1px solid var(--g200)", padding: "8px 16px" }}>
              {["Devis / Appareil", "Client", "Montant HT", "Date", "Statut"].map((h) => (
                <span key={h} style={{ fontSize: 11, fontWeight: 700, color: "var(--g500)", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</span>
              ))}
            </div>
            {devis.map((d) => {
              const sc = STATUT_CFG[d.statut];
              return (
                <div
                  key={d.id}
                  onClick={() => { setSelected(d); setRedeposeFile(null); setPvDate(""); setPvCommentaire(""); setPvFiles(null); }}
                  style={{ display: "grid", gridTemplateColumns: "1fr 110px 120px 110px 90px", gap: 0, padding: "12px 16px", borderBottom: "1px solid var(--g100)", background: "#fff", cursor: "pointer" }}
                >
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)" }}>{d.numeroDevis}</span>
                    {d.adresse && <div style={{ fontSize: 11, color: "var(--g500)" }}>{d.adresse}</div>}
                  </div>
                  <span style={{ fontSize: 12, color: "var(--g700)", alignSelf: "center" }}>{d.clientNom}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", alignSelf: "center" }}>{fmtMontant(d.montantHt)}</span>
                  <span style={{ fontSize: 11, color: "var(--g500)", alignSelf: "center" }}>{fmtDate(d.dateDevis)}</span>
                  <div style={{ alignSelf: "center" }}>
                    <span style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                      {sc.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Détail */}
        {selected && (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
            onClick={() => setSelected(null)}
          >
            <div className="fcard" style={{ width: 480, maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
              <div className="fcard-body">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--navy)" }}>{selected.numeroDevis}</h3>
                  <button type="button" onClick={() => setSelected(null)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 18, color: "var(--g500)" }}>×</button>
                </div>
                <dl style={{ fontSize: 13, color: "var(--g700)", display: "grid", gridTemplateColumns: "120px 1fr", rowGap: 8 }}>
                  <dt style={{ color: "var(--g500)" }}>Client</dt><dd>{selected.clientNom}</dd>
                  <dt style={{ color: "var(--g500)" }}>Adresse</dt><dd>{selected.adresse ?? "—"}</dd>
                  <dt style={{ color: "var(--g500)" }}>Objet</dt><dd>{selected.objet ?? "—"}</dd>
                  <dt style={{ color: "var(--g500)" }}>Montant HT</dt><dd>{fmtMontant(selected.montantHt)}</dd>
                  <dt style={{ color: "var(--g500)" }}>Montant TTC</dt><dd>{fmtMontant(selected.montantTtc)}</dd>
                  <dt style={{ color: "var(--g500)" }}>Déposé le</dt><dd>{fmtDate(selected.createdAt)}</dd>
                  <dt style={{ color: "var(--g500)" }}>Statut</dt>
                  <dd>
                    <span style={{
                      background: STATUT_CFG[selected.statut].bg, color: STATUT_CFG[selected.statut].color,
                      border: `1px solid ${STATUT_CFG[selected.statut].border}`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700,
                    }}>
                      {STATUT_CFG[selected.statut].label}
                    </span>
                  </dd>
                  {selected.avisLvo && (<><dt style={{ color: "var(--g500)" }}>Avis LVO</dt><dd>{selected.avisLvo}</dd></>)}
                  {selected.motifRefus && (<><dt style={{ color: "var(--g500)" }}>Motif refus</dt><dd>{selected.motifRefus}</dd></>)}
                  <dt style={{ color: "var(--g500)" }}>Bon de commande</dt>
                  <dd>
                    {selected.bonCommandeNom
                      ? `${selected.bonCommandeNom} (déposé le ${fmtDate(selected.bonCommandeUploadedAt)} par le client)`
                      : "Pas encore déposé par le client"}
                  </dd>
                </dl>
                <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
                  <button type="button" className="cbtn cbtn-orange cbtn-sm" onClick={() => void downloadPdf(selected)}>
                    ⬇ Télécharger le devis
                  </button>
                </div>

                {/* Redépôt si refusé */}
                {selected.statut === "REFUSE" && (
                  <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--g200)" }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)", marginBottom: 8 }}>Redéposer ce devis</h4>
                    <form onSubmit={onRedepose} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <input
                        className="crm-input"
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => setRedeposeFile(e.target.files?.[0] ?? null)}
                        required
                      />
                      <button type="submit" className="cbtn cbtn-orange cbtn-sm" disabled={!redeposeFile || redeposing}>
                        {redeposing ? "Envoi…" : "Redéposer"}
                      </button>
                    </form>
                  </div>
                )}

                {/* PV — disponible une fois le bon de commande déposé par le client */}
                {selected.bonCommandeNom && (
                  <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--g200)" }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)", marginBottom: 8 }}>Procès-verbal (PV)</h4>

                    {selected.pvFichiers.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        {selected.pvDate && <div style={{ fontSize: 12, color: "var(--g500)" }}>Date du PV : {fmtDate(selected.pvDate)}</div>}
                        {selected.pvCommentaire && <div style={{ fontSize: 12, color: "var(--g700)", marginTop: 4 }}>{selected.pvCommentaire}</div>}
                        <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                          {selected.pvFichiers.map((pv, i) => (
                            <li key={i}>
                              <button
                                type="button"
                                onClick={() => void downloadPv(selected, pv)}
                                style={{ border: "none", background: "none", color: "var(--navy)", textDecoration: "underline", cursor: "pointer", fontSize: 12, padding: 0 }}
                              >
                                ⬇ {pv.nom}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <form onSubmit={onPvSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <label className="crm-field">
                        <span className="crm-label">Date du PV</span>
                        <input className="crm-input" type="date" value={pvDate} onChange={(e) => setPvDate(e.target.value)} />
                      </label>
                      <label className="crm-field">
                        <span className="crm-label">Commentaire</span>
                        <textarea className="crm-input" rows={3} value={pvCommentaire} onChange={(e) => setPvCommentaire(e.target.value)} />
                      </label>
                      <label className="crm-field">
                        <span className="crm-label">Fichiers (PDF, image, Word…)</span>
                        <input
                          className="crm-input"
                          type="file"
                          multiple
                          accept="application/pdf,image/*,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          onChange={(e) => setPvFiles(e.target.files)}
                        />
                      </label>
                      <button type="submit" className="cbtn cbtn-orange cbtn-sm" disabled={!pvFiles || pvFiles.length === 0 || pvUploading} style={{ alignSelf: "flex-start" }}>
                        {pvUploading ? "Envoi…" : "Déposer le PV"}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
