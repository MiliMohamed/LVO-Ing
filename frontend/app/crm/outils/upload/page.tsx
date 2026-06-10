"use client";

import { useState } from "react";

import { CrmCreateButton } from "@/components/crm/CrmCreateButton";
import { apiFetch } from "@/lib/api";
import { getApiBaseUrl } from "@/lib/config";
import { readToken } from "@/lib/token-storage";

const QUOTA_MAX_MB = 250;
const USED_MB_MOCK = 42;

export default function UploadToolsPage() {
  const [msg, setMsg] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [category, setCategory] = useState("TECHNIQUE");
  const [offreRef, setOffreRef] = useState("");
  const [commandeRef, setCommandeRef] = useState("");

  async function onFile(file: File) {
    setMsg(null);
    const form = new FormData();
    form.append("file", file);
    const token = readToken();
    const res = await fetch(`${getApiBaseUrl()}/api/fichiers/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const text = await res.text();
    setMsg(
      res.ok
        ? `Upload OK : ${file.name} — catégorie « ${category} » (UI). Liens offre/commande : ${offreRef || "—"} / ${commandeRef || "—"}`
        : text || "Upload KO",
    );
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void onFile(f);
  }

  async function presign() {
    setMsg(null);
    try {
      const data = (await apiFetch("/api/fichiers/presign", {
        token: readToken(),
        method: "POST",
        body: JSON.stringify({ prefix: `crm/${category.toLowerCase()}/` }),
      })) as Record<string, unknown>;
      const note = typeof data.message === "string" ? data.message : JSON.stringify(data.message ?? "");
      const key = typeof data.objectKey === "string" ? data.objectKey : "";
      setMsg(`${note} — clé suggérée : ${key}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erreur");
    }
  }

  return (
    <>
      <header className="pg-hdr mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>Upload documents</h1>
          <p>Glisser-déposer, catégorie, rattachement offre/commande, quota — stockage objet MinIO en cible.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CrmCreateButton slug="offre" />
          <CrmCreateButton slug="commande" />
        </div>
      </header>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <div className="fcard md:col-span-2">
          <div className="fcard-body space-y-3">
            <div className="flex flex-wrap gap-4">
              <div className="crm-field min-w-[160px]">
                <span className="crm-label">Catégorie</span>
                <select className="crm-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="TECHNIQUE">Technique</option>
                  <option value="COMMERCIAL">Commercial</option>
                  <option value="REGLEMENTAIRE">Réglementaire</option>
                  <option value="RH">RH</option>
                </select>
              </div>
              <label className="crm-field min-w-[140px] flex-1">
                <span className="crm-label">
                  Réf. offre <span className="crm-opt">(optionnel)</span>
                </span>
                <input className="crm-input" value={offreRef} onChange={(e) => setOffreRef(e.target.value)} placeholder="OFF-…" />
              </label>
              <label className="crm-field min-w-[140px] flex-1">
                <span className="crm-label">
                  Réf. commande <span className="crm-opt">(optionnel)</span>
                </span>
                <input className="crm-input" value={commandeRef} onChange={(e) => setCommandeRef(e.target.value)} placeholder="CMD-…" />
              </label>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
              className={`rounded-xl border-2 border-dashed px-4 py-10 text-center transition ${
                drag ? "border-[var(--orange)] bg-orange-50/50" : "border-[var(--g300)] bg-white"
              }`}
              aria-label="Zone de dépôt de fichier"
            >
              <p className="text-sm font-semibold text-[var(--navy)]">Déposez un fichier ici</p>
              <p className="mt-1 text-xs text-neutral-600">ou choisissez un fichier classique</p>
              <input
                type="file"
                className="mt-4 text-sm"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onFile(f);
                }}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" className="cbtn cbtn-ghost cbtn-sm" onClick={() => void presign()}>
                Préparer clé objet (stub presign)
              </button>
              <span className="text-xs text-neutral-500">
                Console MinIO locale :{" "}
                <a className="text-[var(--orange)] underline" href="http://localhost:9001" target="_blank" rel="noreferrer">
                  localhost:9001
                </a>
              </span>
            </div>
          </div>
        </div>

        <div className="fcard">
          <div className="fcard-body space-y-2">
            <h2 className="text-sm font-bold text-[var(--navy)]">Quota agrégé (maquette)</h2>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--g200)]">
              <div
                className="h-full rounded-full bg-[var(--orange)]"
                style={{ width: `${Math.min(100, (USED_MB_MOCK / QUOTA_MAX_MB) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-neutral-600">
              {USED_MB_MOCK} / {QUOTA_MAX_MB} Mo utilisés — enforcement à brancher par tenant / agence.
            </p>
          </div>
        </div>
      </div>

      {msg ? <p className="fnote">{msg}</p> : null}
    </>
  );
}
