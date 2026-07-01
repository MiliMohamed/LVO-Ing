"use client";

import { useEffect, useRef, useState } from "react";
import { clientApiFetch, clientApiPost } from "@/lib/client-api";
import { getApiBaseUrl } from "@/lib/config";
import { readClientToken } from "@/lib/token-storage";

type DevisStatut = "EN_ATTENTE" | "EN_NEGOCIATION" | "VALIDE" | "REFUSE" | "SIGNE" | "TERMINE";

type Devis = {
  id: number;
  numeroDevis: string;
  entreprise: string | null;
  dateDevis: string | null;
  objet: string | null;
  montantHt: number | null;
  tauxTva: number;
  montantTtc: number | null;
  montantNegocieHt: number | null;
  ascenseurArret: boolean;
  statut: DevisStatut;
  documentNom: string | null;
  motifRefus: string | null;
  avisLvo: string | null;
  numeroAppareil: string | null;
  batiment: string | null;
  adresse: string | null;
  createdAt: string;
  messages: NegociationMsg[];
  bonCommandeNom: string | null;
  bonCommandeUploadedAt: string | null;
  bonCommandeExtraction: BonCommandeExtraction | null;
};

type BonCommandeExtraction = {
  numero: string | null;
  adresse: string | null;
  fournisseur: string | null;
  client: string | null;
  montantTtc: number | null;
};

type NegociationMsg = {
  id: number;
  auteurRole: "ADMIN" | "CLIENT";
  auteurNom: string | null;
  message: string;
  prixPropose: number | null;
  createdAt: string;
};

const STATUT_CFG: Record<DevisStatut, { label: string; color: string; bg: string; border: string }> = {
  EN_ATTENTE:       { label: "En attente",       color: "#1e40af", bg: "#eff6ff", border: "#93c5fd" },
  EN_NEGOCIATION:   { label: "En négociation",    color: "#c2410c", bg: "#fff7ed", border: "#fdba74" },
  VALIDE:           { label: "Validé",            color: "#14532d", bg: "#f0fdf4", border: "#86efac" },
  REFUSE:           { label: "Refusé",            color: "#7f1d1d", bg: "#fef2f2", border: "#fca5a5" },
  SIGNE:            { label: "Signé",             color: "#1e1b4b", bg: "#f5f3ff", border: "#a5b4fc" },
  TERMINE:          { label: "Terminé",           color: "#065f46", bg: "#ecfdf5", border: "#6ee7b7" },
};

function fmtMontant(v: number | null) {
  if (v == null) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(v);
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function DevisClientPage() {
  const [devis, setDevis] = useState<Devis[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Devis | null>(null);
  const [selectedMessages, setSelectedMessages] = useState<NegociationMsg[]>([]);

  // Négociation
  const [negMsg, setNegMsg] = useState("");
  const [negPrix, setNegPrix] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  // Signature client
  const [signing, setSigning] = useState(false);
  const [signErr, setSignErr] = useState<string | null>(null);

  // Bon de commande
  const [bcFile, setBcFile] = useState<File | null>(null);
  const [bcUploading, setBcUploading] = useState(false);
  const [bcErr, setBcErr] = useState<string | null>(null);
  const bcInputRef = useRef<HTMLInputElement>(null);

  async function loadDevis() {
    try {
      const data = await clientApiFetch<Devis[]>("/api/client/devis-groupement");
      setDevis(data);
    } catch {
      setError("Impossible de charger vos devis.");
    }
  }

  useEffect(() => {
    void loadDevis();
  }, []);

  async function loadMessagesForDevis(devisId: number) {
    try {
      const neg = await clientApiFetch<{ messages: NegociationMsg[] }>(`/api/client/devis-groupement/${devisId}/negociation`);
      setSelectedMessages(neg?.messages ?? []);
    } catch { /* non bloquant */ }
  }

  async function selectDevis(d: Devis) {
    setSelected(d);
    setSelectedMessages([]);
    await loadMessagesForDevis(d.id);
  }

  async function sendNegMsg(devisId: number) {
    if (!negMsg.trim()) return;
    setSendingMsg(true);
    try {
      await clientApiPost(`/api/client/devis-groupement/${devisId}/negociation`, {
        message: negMsg,
        prixPropose: negPrix || undefined,
      });
      setNegMsg(""); setNegPrix("");
      await loadMessagesForDevis(devisId);
      await loadDevis();
    } finally {
      setSendingMsg(false);
    }
  }

  async function signDevis(devisId: number) {
    setSigning(true);
    setSignErr(null);
    try {
      await clientApiPost(`/api/client/devis-groupement/${devisId}/signer`, { signatureDataUrl: "" });
      await loadDevis();
      const updated = (await clientApiFetch<Devis[]>("/api/client/devis-groupement"))?.find((d) => d.id === devisId);
      if (updated) setSelected(updated);
    } catch (e) {
      setSignErr(e instanceof Error ? e.message : "Erreur lors de la signature");
    } finally {
      setSigning(false);
    }
  }

  async function uploadBonCommande(devisId: number) {
    if (!bcFile) return;
    setBcUploading(true);
    setBcErr(null);
    try {
      const form = new FormData();
      form.append("file", bcFile);
      const res = await fetch(`${getApiBaseUrl()}/api/client/devis-groupement/${devisId}/bon-commande`, {
        method: "POST",
        headers: { Authorization: `Bearer ${readClientToken() ?? ""}` },
        body: form,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(j.error ?? "Erreur lors de l'envoi");
      }
      setBcFile(null);
      if (bcInputRef.current) bcInputRef.current.value = "";
      await loadDevis();
    } catch (e) {
      setBcErr(e instanceof Error ? e.message : "Erreur d'envoi");
    } finally {
      setBcUploading(false);
    }
  }

  async function downloadDevis(id: number, nom: string | null) {
    const res = await fetch(`${getApiBaseUrl()}/api/client/devis-groupement/${id}/download`, {
      headers: { Authorization: `Bearer ${readClientToken() ?? ""}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nom ?? "devis.pdf";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const nbArret = (devis ?? []).filter((d) => d.ascenseurArret).length;
  const nbNegoEnCours = (devis ?? []).filter((d) => d.statut === "EN_NEGOCIATION").length;

  if (selected) {
    const sc = STATUT_CFG[selected.statut];
    const refreshedSelected = (devis ?? []).find((d) => d.id === selected.id) ?? selected;
    const msgs = selectedMessages;
    return (
      <div>
        <button
          type="button"
          onClick={() => setSelected(null)}
          style={{ background: "none", border: "none", color: "var(--smoke)", fontSize: 13, cursor: "pointer", padding: "0 0 16px", display: "flex", alignItems: "center", gap: 6 }}
        >
          ← Retour à mes devis
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--navy)", margin: 0 }}>{refreshedSelected.numeroDevis}</h1>
          {refreshedSelected.ascenseurArret && (
            <span style={{ background: "#b91c1c", color: "#fff", borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>APPAREIL À L'ARRÊT</span>
          )}
          <span style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{sc.label}</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {refreshedSelected.documentNom && (
              <button type="button" onClick={() => void downloadDevis(refreshedSelected.id, refreshedSelected.documentNom)}
                style={{ background: "var(--navy)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Télécharger le PDF
              </button>
            )}
            {refreshedSelected.statut === "VALIDE" && (
              <button type="button" onClick={() => void signDevis(refreshedSelected.id)} disabled={signing}
                style={{ background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: signing ? 0.6 : 1 }}>
                {signing ? "Signature en cours…" : "✍ Signer le devis"}
              </button>
            )}
            {signErr && <p style={{ color: "#dc2626", fontSize: 12, margin: 0 }}>{signErr}</p>}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Infos devis */}
            <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 12, padding: "20px 24px" }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)", marginBottom: 16 }}>Informations</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <InfoField label="N° devis" value={refreshedSelected.numeroDevis} mono />
                <InfoField label="Date devis" value={fmtDate(refreshedSelected.dateDevis)} />
                <InfoField label="Prestataire" value={refreshedSelected.entreprise ?? "—"} />
                <InfoField label="N° appareil" value={refreshedSelected.numeroAppareil ?? "—"} mono />
                {refreshedSelected.adresse && <InfoField label="Adresse" value={refreshedSelected.adresse} />}
                {refreshedSelected.batiment && <InfoField label="Bâtiment" value={refreshedSelected.batiment} />}
                <InfoField label="Montant HT" value={fmtMontant(refreshedSelected.montantHt)} bold />
                <InfoField label="Montant TTC" value={fmtMontant(refreshedSelected.montantTtc)} bold />
                {refreshedSelected.montantNegocieHt != null && (
                  <InfoField label="Montant négocié HT" value={fmtMontant(refreshedSelected.montantNegocieHt)} bold />
                )}
              </div>
              {refreshedSelected.objet && (
                <div style={{ marginTop: 14 }}>
                  <span style={{ fontSize: 11, color: "var(--smoke)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, display: "block", marginBottom: 4 }}>Objet</span>
                  <p style={{ fontSize: 13, color: "var(--navy)", margin: 0 }}>{refreshedSelected.objet}</p>
                </div>
              )}
              {refreshedSelected.avisLvo && (
                <div style={{ marginTop: 14, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "12px 16px" }}>
                  <span style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, display: "block", marginBottom: 4 }}>Avis LVO Ingénierie</span>
                  <p style={{ fontSize: 13, color: "#1e3a8a", margin: 0 }}>{refreshedSelected.avisLvo}</p>
                </div>
              )}
              {refreshedSelected.motifRefus && (
                <div style={{ marginTop: 14, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px" }}>
                  <span style={{ fontSize: 11, color: "#dc2626", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, display: "block", marginBottom: 4 }}>Motif de refus</span>
                  <p style={{ fontSize: 13, color: "#7f1d1d", margin: 0 }}>{refreshedSelected.motifRefus}</p>
                </div>
              )}
            </div>

            {/* Bon de commande */}
            {(refreshedSelected.statut === "VALIDE" || refreshedSelected.statut === "SIGNE") && (
              <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 12, padding: "20px 24px" }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)", marginBottom: 4 }}>Bon de commande</h2>
                <p style={{ fontSize: 12, color: "var(--smoke)", marginBottom: 14 }}>
                  Le devis a été validé par LVO Ingénierie. Vous pouvez déposer votre bon de commande pour lancer les travaux.
                </p>
                {refreshedSelected.bonCommandeNom ? (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "12px 16px" }}>
                      <span style={{ fontSize: 20 }}>📄</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#15803d" }}>{refreshedSelected.bonCommandeNom}</div>
                        {refreshedSelected.bonCommandeUploadedAt && (
                          <div style={{ fontSize: 11, color: "#16a34a" }}>Déposé le {fmtDate(refreshedSelected.bonCommandeUploadedAt)}</div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const a = document.createElement("a");
                          a.href = `${getApiBaseUrl()}/api/client/devis-groupement/${refreshedSelected.id}/bon-commande/download`;
                          a.download = refreshedSelected.bonCommandeNom ?? "bon-commande.pdf";
                          const headers = new Headers({ Authorization: `Bearer ${readClientToken() ?? ""}` });
                          void fetch(a.href, { headers }).then(r => r.blob()).then(blob => {
                            const url = URL.createObjectURL(blob);
                            a.href = url; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
                          });
                        }}
                        style={{ background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      >
                        Télécharger
                      </button>
                    </div>
                    {refreshedSelected.bonCommandeExtraction && (
                      <dl style={{ marginTop: 12, fontSize: 12, color: "var(--g700)", display: "grid", gridTemplateColumns: "120px 1fr", rowGap: 6 }}>
                        <dt style={{ color: "var(--g500)" }}>N° commande</dt>
                        <dd>{refreshedSelected.bonCommandeExtraction.numero ?? "—"}</dd>
                        <dt style={{ color: "var(--g500)" }}>Fournisseur</dt>
                        <dd>{refreshedSelected.bonCommandeExtraction.fournisseur ?? "—"}</dd>
                        <dt style={{ color: "var(--g500)" }}>Client</dt>
                        <dd>{refreshedSelected.bonCommandeExtraction.client ?? "—"}</dd>
                        <dt style={{ color: "var(--g500)" }}>Adresse</dt>
                        <dd>{refreshedSelected.bonCommandeExtraction.adresse ?? "—"}</dd>
                        {refreshedSelected.bonCommandeExtraction.montantTtc != null && (
                          <>
                            <dt style={{ color: "var(--g500)" }}>Montant TTC</dt>
                            <dd>{fmtMontant(refreshedSelected.bonCommandeExtraction.montantTtc)}</dd>
                          </>
                        )}
                      </dl>
                    )}
                  </div>
                ) : (
                  <div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <input
                        ref={bcInputRef}
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => setBcFile(e.target.files?.[0] ?? null)}
                        style={{ fontSize: 13 }}
                      />
                      <button
                        type="button"
                        onClick={() => void uploadBonCommande(refreshedSelected.id)}
                        disabled={!bcFile || bcUploading}
                        style={{ background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: !bcFile ? 0.5 : 1 }}
                      >
                        {bcUploading ? "Envoi…" : "Déposer le bon de commande"}
                      </button>
                    </div>
                    {bcErr && <p style={{ color: "#dc2626", fontSize: 12, marginTop: 8 }}>{bcErr}</p>}
                    <p style={{ fontSize: 11, color: "var(--smoke)", marginTop: 8 }}>PDF uniquement · max 30 Mo</p>
                  </div>
                )}
              </div>
            )}

            {/* Canal de négociation */}
            {(refreshedSelected.statut === "EN_NEGOCIATION" || msgs.length > 0) && (
              <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 12, padding: "20px 24px" }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)", marginBottom: 16 }}>Négociation</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16, maxHeight: 300, overflowY: "auto" }}>
                  {msgs.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        background: m.auteurRole === "CLIENT" ? "#f0f7ff" : "#f9f9f9",
                        border: `1px solid ${m.auteurRole === "CLIENT" ? "#bfdbfe" : "#e5e7eb"}`,
                        borderRadius: 10, padding: "10px 14px",
                        alignSelf: m.auteurRole === "CLIENT" ? "flex-end" : "flex-start",
                        maxWidth: "85%",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: m.auteurRole === "CLIENT" ? "#1d4ed8" : "var(--navy)" }}>
                          {m.auteurRole === "CLIENT" ? "Vous" : "LVO Ingénierie"}
                        </span>
                        <span style={{ fontSize: 11, color: "#9ca3af" }}>{fmtDateTime(m.createdAt)}</span>
                      </div>
                      <p style={{ fontSize: 13, color: "var(--navy)", margin: 0 }}>{m.message}</p>
                      {m.prixPropose != null && (
                        <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: "#059669" }}>
                          Prix proposé : {fmtMontant(m.prixPropose)} HT
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {refreshedSelected.statut === "EN_NEGOCIATION" && (
                  <div style={{ borderTop: "1px solid var(--g100)", paddingTop: 14 }}>
                    <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 12, color: "var(--smoke)", display: "block", marginBottom: 4 }}>Votre message</label>
                        <textarea
                          value={negMsg}
                          onChange={(e) => setNegMsg(e.target.value)}
                          placeholder="Votre réponse à LVO…"
                          style={{ width: "100%", border: "1px solid var(--g200)", borderRadius: 8, padding: "9px 12px", fontSize: 13, resize: "vertical", minHeight: 70, boxSizing: "border-box" }}
                        />
                      </div>
                      <div style={{ width: 130 }}>
                        <label style={{ fontSize: 12, color: "var(--smoke)", display: "block", marginBottom: 4 }}>Prix contre-proposé</label>
                        <input
                          type="number"
                          value={negPrix}
                          onChange={(e) => setNegPrix(e.target.value)}
                          placeholder="€ HT (optionnel)"
                          style={{ width: "100%", border: "1px solid var(--g200)", borderRadius: 8, padding: "9px 12px", fontSize: 13, boxSizing: "border-box" }}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void sendNegMsg(refreshedSelected.id)}
                      disabled={!negMsg.trim() || sendingMsg}
                      style={{ background: "var(--navy)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: !negMsg.trim() ? 0.5 : 1 }}
                    >
                      {sendingMsg ? "Envoi…" : "Envoyer"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Statut timeline */}
          <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 12, padding: "20px 20px" }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)", marginBottom: 16 }}>Statut du dossier</h2>
            <StatusTimeline current={refreshedSelected.statut} />
            {refreshedSelected.statut === "SIGNE" && (
              <div style={{ marginTop: 16, textAlign: "center" }}>
                <div style={{ fontSize: 28 }}>✅</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#16a34a", marginTop: 6 }}>Devis approuvé et signé</div>
              </div>
            )}
            {refreshedSelected.statut === "TERMINE" && (
              <div style={{ marginTop: 16, textAlign: "center" }}>
                <div style={{ fontSize: 28 }}>🏁</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#065f46", marginTop: 6 }}>Intervention terminée</div>
              </div>
            )}
            {refreshedSelected.statut === "REFUSE" && (
              <div style={{ marginTop: 16, textAlign: "center" }}>
                <div style={{ fontSize: 28 }}>❌</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#dc2626", marginTop: 6 }}>Devis refusé</div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--navy)", marginBottom: 4 }}>Mes devis</h1>
          <p style={{ fontSize: 13, color: "var(--smoke)" }}>
            Devis de travaux et remises en service soumis par vos prestataires, analysés par LVO Ingénierie
          </p>
        </div>
      </div>

      {/* KPI */}
      {devis !== null && devis.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 20 }}>
          {(Object.entries(STATUT_CFG) as [DevisStatut, typeof STATUT_CFG[DevisStatut]][]).map(([s, cfg]) => {
            const n = devis.filter((d) => d.statut === s).length;
            if (n === 0) return null;
            return (
              <div key={s} style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: cfg.color }}>{n}</div>
                <div style={{ fontSize: 11, color: cfg.color, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{cfg.label}</div>
              </div>
            );
          })}
        </div>
      )}

      {nbArret > 0 && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "12px 18px", marginBottom: 16, fontSize: 13, color: "#7f1d1d" }}>
          🚨 <strong>{nbArret} devis</strong> concernent un appareil à l'arrêt — action urgente requise.
        </div>
      )}

      {nbNegoEnCours > 0 && (
        <div style={{ background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 12, padding: "12px 18px", marginBottom: 16, fontSize: 13, color: "#92400e" }}>
          💬 <strong>{nbNegoEnCours} devis</strong> sont en cours de négociation — votre réponse est attendue.
        </div>
      )}

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", color: "#dc2626", marginBottom: 20 }}>
          {error}
        </div>
      )}

      {devis === null && !error && (
        <div style={{ color: "var(--smoke)", padding: "40px 0", textAlign: "center" }}>Chargement…</div>
      )}

      {devis !== null && devis.length === 0 && (
        <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, padding: "60px 0", textAlign: "center", color: "var(--smoke)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📑</div>
          Aucun devis enregistré pour le moment.<br />
          <span style={{ fontSize: 13 }}>Déposez un devis prestataire via le bouton ci-dessus.</span>
        </div>
      )}

      {devis !== null && devis.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  {["N° devis", "Prestataire", "Appareil", "Montant HT", "Déposé le", "Statut", "Action"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: 11, color: "var(--smoke)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {devis.map((d) => {
                  const sc = STATUT_CFG[d.statut];
                  return (
                    <tr key={d.id} style={{ borderTop: "1px solid var(--g100)", background: d.ascenseurArret ? "#fff8f8" : undefined }}>
                      <td style={{ padding: "14px 16px", fontWeight: 700, fontSize: 13, color: "var(--navy)", whiteSpace: "nowrap" }}>
                        {d.ascenseurArret && <span style={{ marginRight: 6, fontSize: 11, background: "#fecaca", color: "#b91c1c", borderRadius: 4, padding: "1px 6px", fontWeight: 800 }}>ARRÊT</span>}
                        {d.numeroDevis}
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 13 }}>{d.entreprise ?? "—"}</td>
                      <td style={{ padding: "14px 16px", fontSize: 13, fontFamily: "monospace" }}>{d.numeroAppareil ?? "—"}</td>
                      <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: 600 }}>{fmtMontant(d.montantHt)}</td>
                      <td style={{ padding: "14px 16px", fontSize: 13, whiteSpace: "nowrap" }}>{fmtDate(d.createdAt)}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                          {sc.label}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <button
                          type="button"
                          onClick={() => void selectDevis(d)}
                          style={{ background: "none", border: "1px solid var(--g200)", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--navy)", whiteSpace: "nowrap" }}
                        >
                          Voir le dossier
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const STATUT_ORDER: DevisStatut[] = ["EN_ATTENTE", "EN_NEGOCIATION", "VALIDE", "SIGNE", "TERMINE"];

function StatusTimeline({ current }: { current: DevisStatut }) {
  const isRefused = current === "REFUSE";
  const steps = isRefused
    ? [{ s: "EN_ATTENTE", label: "Reçu" }, { s: "REFUSE", label: "Refusé" }]
    : [
        { s: "EN_ATTENTE",       label: "Reçu" },
        { s: "EN_NEGOCIATION",   label: "Négociation" },
        { s: "VALIDE",           label: "Validé" },
        { s: "SIGNE",            label: "Signé" },
        { s: "TERMINE",          label: "Terminé" },
      ];

  const currentIdx = isRefused
    ? steps.findIndex((s) => s.s === current)
    : STATUT_ORDER.indexOf(current);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {steps.map((step, i) => {
        const done = i < currentIdx;
        const active = step.s === current;
        const future = i > currentIdx;
        return (
          <div key={step.s} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                background: active ? "var(--navy)" : done ? "#16a34a" : "#e5e7eb",
                border: active ? "3px solid var(--navy)" : done ? "2px solid #16a34a" : "2px solid #e5e7eb",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, color: (active || done) ? "#fff" : "#9ca3af", fontWeight: 700,
              }}>
                {done ? "✓" : active ? "●" : ""}
              </div>
              {i < steps.length - 1 && (
                <div style={{ width: 2, height: 24, background: done ? "#16a34a" : "#e5e7eb", margin: "0 auto" }} />
              )}
            </div>
            <div style={{ paddingBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: active ? 700 : done ? 600 : 400, color: active ? "var(--navy)" : done ? "#374151" : "#9ca3af", lineHeight: "22px" }}>
                {step.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InfoField({ label, value, bold, mono }: { label: string; value: string; bold?: boolean; mono?: boolean }) {
  return (
    <div>
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--smoke)", textTransform: "uppercase", letterSpacing: 0.4, display: "block", marginBottom: 3 }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--navy)", fontWeight: bold ? 700 : 400, fontFamily: mono ? "monospace" : undefined }}>{value}</span>
    </div>
  );
}

