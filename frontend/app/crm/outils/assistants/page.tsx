"use client";

import { useState } from "react";

import { CrmCreateButton } from "@/components/crm/CrmCreateButton";
import { apiFetch } from "@/lib/api";
import { readToken } from "@/lib/token-storage";

export default function AssistantsOutilsPage() {
  const [pdfText, setPdfText] = useState("");
  const [ocrOut, setOcrOut] = useState<unknown>(null);
  const [iaOut, setIaOut] = useState<unknown>(null);
  const [sigOffreId, setSigOffreId] = useState("1");
  const [sigOut, setSigOut] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);

  async function runOcr() {
    setErr(null);
    const token = readToken();
    try {
      const j = await apiFetch("/api/ocr/bon-commande", {
        token,
        method: "POST",
        body: JSON.stringify({ pdfText: pdfText.trim() || undefined }),
      });
      setOcrOut(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur OCR");
    }
  }

  async function runIa() {
    setErr(null);
    const token = readToken();
    try {
      const j = await apiFetch("/api/ia/suggerer-configuration", {
        token,
        method: "POST",
        body: JSON.stringify({ typeMission: "MS", nombreAppareils: 12, typeBatiment: "Hôpital" }),
      });
      setIaOut(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur IA");
    }
  }

  async function demanderSignature() {
    setErr(null);
    const token = readToken();
    const id = Number(sigOffreId);
    if (!Number.isFinite(id)) {
      setErr("ID offre invalide.");
      return;
    }
    try {
      const j = await apiFetch(`/api/offres/${id}/demander-signature`, { token, method: "POST", body: "{}" });
      setSigOut(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur signature");
    }
  }

  return (
    <>
      <header className="pg-hdr mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>Assistants — OCR &amp; configuration</h1>
          <p>
            Phase 10 : extraction texte bon de commande (stub), suggestion de phases par règles métier, e-signature
            Yousign (stub API).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CrmCreateButton slug="offre" />
          <CrmCreateButton slug="commande" />
        </div>
      </header>

      {err ? <p className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{err}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="fcard">
          <div className="fcard-body space-y-2">
            <h2 className="text-sm font-bold text-[var(--navy)]">OCR bon de commande</h2>
            <p className="text-xs text-neutral-600">
              Collez le texte extrait d&apos;un PDF (pas de fichier binaire en démo). Champ vide = jeu de données factice.
            </p>
            <label className="crm-field">
              <span className="crm-label">Texte extrait</span>
              <textarea className="crm-textarea min-h-36" value={pdfText} onChange={(e) => setPdfText(e.target.value)} placeholder="Bon de commande n° … Montant HT …" />
            </label>
            <button type="button" className="cbtn cbtn-orange cbtn-sm" onClick={() => void runOcr()}>
              Analyser
            </button>
            {ocrOut ? (
              <pre className="max-h-48 overflow-auto rounded border border-[var(--g200)] bg-[var(--g50)] p-2 text-xs">
                {JSON.stringify(ocrOut, null, 2)}
              </pre>
            ) : null}
          </div>
        </div>

        <div className="fcard">
          <div className="fcard-body space-y-2">
            <h2 className="text-sm font-bold text-[var(--navy)]">Suggestion configuration (règles)</h2>
            <p className="text-xs text-neutral-600">
              Appelle <code className="text-[11px]">POST /api/ia/suggerer-configuration</code> avec un scénario MS /
              hôpital / 12 appareils.
            </p>
            <button type="button" className="cbtn cbtn-orange cbtn-sm" onClick={() => void runIa()}>
              Générer suggestion
            </button>
            {iaOut ? (
              <pre className="max-h-48 overflow-auto rounded border border-[var(--g200)] bg-[var(--g50)] p-2 text-xs">
                {JSON.stringify(iaOut, null, 2)}
              </pre>
            ) : null}
          </div>
        </div>

        <div className="fcard lg:col-span-2">
          <div className="fcard-body space-y-2">
            <h2 className="text-sm font-bold text-[var(--navy)]">E-signature (Yousign stub)</h2>
            <p className="text-xs text-neutral-600">
              <code>POST /api/offres/:id/demander-signature</code> — webhook public{" "}
              <code>/api/webhooks/yousign</code> sans JWT.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="crm-field min-w-[120px]">
                <span className="crm-label">ID offre</span>
                <input className="crm-input" value={sigOffreId} onChange={(e) => setSigOffreId(e.target.value)} placeholder="ex. 12" inputMode="numeric" />
              </label>
              <button type="button" className="cbtn cbtn-orange cbtn-sm" onClick={() => void demanderSignature()}>
                Demander signature
              </button>
            </div>
            {sigOut ? (
              <pre className="max-h-40 overflow-auto rounded border border-[var(--g200)] bg-[var(--g50)] p-2 text-xs">
                {JSON.stringify(sigOut, null, 2)}
              </pre>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
