"use client";

import { useEffect, useState } from "react";

import { CrmCreateButton } from "@/components/crm/CrmCreateButton";
import { apiFetch, apiFetchBlob } from "@/lib/api";
import { readToken } from "@/lib/token-storage";

export default function DocumentsToolsPage() {
  const [reference, setReference] = useState("LVO-MOE-26001");
  const [content, setContent] = useState("Contenu du document LVO — Phase 7–9 phases & N° commande client dans le PDF stub.");
  const [type, setType] = useState<"offre" | "commande" | "facture">("offre");
  const [format, setFormat] = useState<"pdf" | "docx">("pdf");
  const [msg, setMsg] = useState<string | null>(null);
  const [versions, setVersions] = useState<Record<string, unknown>[] | null>(null);
  const [vKey, setVKey] = useState(0);

  const docTypeParam = type === "offre" ? "OFFRE" : type === "commande" ? "COMMANDE" : "FACTURE";

  useEffect(() => {
    const token = readToken();
    let cancel = false;
    void (async () => {
      try {
        const data = (await apiFetch(
          `/api/documents/versions?reference=${encodeURIComponent(reference)}&docType=${docTypeParam}`,
          {
            token,
          },
        )) as Record<string, unknown>[] | null;
        if (!cancel) setVersions(Array.isArray(data) ? data : []);
      } catch {
        if (!cancel) setVersions([]);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [reference, docTypeParam, vKey]);

  async function generate() {
    setMsg(null);
    const token = readToken();
    const endpoint =
      type === "offre"
        ? "/api/documents/offre/generate"
        : type === "commande"
          ? "/api/documents/commande/generate"
          : "/api/documents/facture/generate";
    try {
      const blob = await apiFetchBlob(endpoint, {
        token,
        method: "POST",
        body: JSON.stringify({ reference, content, format }),
      });
      const ext = format === "docx" ? "docx" : "pdf";
      const fileName =
        type === "offre"
          ? `LVO_Offre_${reference}.${ext}`
          : type === "commande"
            ? `LVO_Commande_${reference}.${ext}`
            : `LVO_Facture_${reference}.${ext}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      setVKey((k) => k + 1);
      setMsg(`Téléchargement lancé (${fileName}). Version enregistrée — courant S3 stub, précédent archivé OneDrive (simulation).`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erreur");
    }
  }

  return (
    <>
      <header className="pg-hdr mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>Documents PDF / Word</h1>
          <p>Génération offre / commande / facture, nommage métier et pipeline de versions (stub).</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CrmCreateButton slug="offre" />
          <CrmCreateButton slug="commande" />
          <CrmCreateButton slug="facture" />
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="fcard lg:col-span-2">
          <div className="fcard-body flex flex-col gap-3">
            <label className="crm-field">
              <span className="crm-label">Référence document</span>
              <input className="crm-input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Référence métier" />
            </label>
            <label className="crm-field">
              <span className="crm-label">Contenu / variables</span>
              <textarea className="crm-textarea min-h-32" value={content} onChange={(e) => setContent(e.target.value)} />
            </label>
            <div className="flex flex-wrap items-end gap-3">
              <div className="crm-field min-w-[140px]">
                <span className="crm-label">Type</span>
                <select className="crm-select" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
                  <option value="offre">Offre</option>
                  <option value="commande">Commande</option>
                  <option value="facture">Facture</option>
                </select>
              </div>
              <div className="crm-field min-w-[120px]">
                <span className="crm-label">Format</span>
                <select className="crm-select" value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
                  <option value="pdf">PDF</option>
                  <option value="docx">Word (.docx)</option>
                </select>
              </div>
              <button type="button" className="cbtn cbtn-orange" onClick={() => void generate()}>
                Générer &amp; télécharger
              </button>
            </div>
            {msg ? <p className="fnote">{msg}</p> : null}
            <p className="crm-hint">
              Phase 8 : chaque génération pousse une version ; l&apos;ancienne passe en <code>ONEDRIVE_ARCHIVE_STUB</code> côté API mémoire.
            </p>
          </div>
        </div>

        <div className="fcard">
          <div className="fcard-body space-y-2">
            <h2 className="text-sm font-bold text-[var(--navy)]">Versions (aperçu)</h2>
            <p className="text-xs text-neutral-600">
              Pour la référence saisie — données stub jusqu&apos;à migration SQL + métadonnées objet.
            </p>
            <ul className="space-y-2 text-xs">
              {(versions ?? []).length === 0 && versions !== null ? (
                <li className="text-neutral-500">Aucune version enregistrée.</li>
              ) : null}
              {(versions ?? []).map((v, i) => (
                <li key={i} className="rounded border border-[var(--g200)] bg-[var(--g50)] px-2 py-1.5">
                  <span className="font-semibold text-[var(--navy)]">v{String(v.version ?? "")}</span> —{" "}
                  <span className="text-neutral-600">{String(v.docType ?? "")}</span> —{" "}
                  <span className="text-neutral-600">{String(v.createdAt)}</span>
                  <div className="truncate text-neutral-500">{String(v.storage ?? "")} · {String(v.storageKey ?? "")}</div>
                </li>
              ))}
            </ul>
            {!versions ? <p className="fnote">Chargement…</p> : null}
          </div>
        </div>
      </div>
    </>
  );
}
