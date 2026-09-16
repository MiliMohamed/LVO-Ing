"use client";

import { useEffect, useRef, useState } from "react";

import { apiFetch } from "@/lib/api";
import { getOnlyofficeUrl } from "@/lib/config";
import { readToken } from "@/lib/token-storage";

type Props = {
  offreId: number;
  version: number;
  onClose: () => void;
};

// Minimal shape of the ONLYOFFICE DocsAPI global injected by api.js — no official TS types published.
type DocEditorInstance = { destroyEditor: () => void };
type DocsApiGlobal = { DocEditor: new (elementId: string, config: unknown) => DocEditorInstance };

declare global {
  interface Window {
    DocsAPI?: DocsApiGlobal;
  }
}

let scriptLoadPromise: Promise<void> | null = null;

function loadOnlyofficeScript(): Promise<void> {
  if (window.DocsAPI) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;
  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${getOnlyofficeUrl()}/web-apps/apps/api/documents/api.js`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Impossible de charger l'éditeur ONLYOFFICE — le service est-il démarré ?"));
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

// La topbar CRM (z-index 200) et la sidebar (z-index 100, largeur 268px) sont en position fixed
// et passaient par-dessus l'éditeur (z-index 60) — l'éditeur doit passer au-dessus des deux pour
// un vrai plein écran ; le bouton "Afficher le menu CRM" permet de les faire réapparaître ponctuellement.
const CRM_TOPBAR_HEIGHT = 50;
const CRM_SIDEBAR_WIDTH = 268;

export function OffreDocumentEditorModal({ offreId, version, onClose }: Props) {
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCrmChrome, setShowCrmChrome] = useState(false);
  const editorRef = useRef<DocEditorInstance | null>(null);
  const containerId = "offre-document-editor-container";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = (await apiFetch(`/api/offres/${offreId}/documents/${version}/edit-session`, {
          token: readToken(),
          method: "POST",
        })) as { token: string; config: unknown } | null;
        if (!result) throw new Error("Session d'édition invalide");
        await loadOnlyofficeScript();
        if (cancelled) return;
        if (!window.DocsAPI) throw new Error("Éditeur ONLYOFFICE indisponible");
        editorRef.current = new window.DocsAPI.DocEditor(containerId, result.config);
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Échec de l'ouverture de l'éditeur");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      try {
        editorRef.current?.destroyEditor();
      } catch {
        /* déjà détruit / conteneur retiré */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offreId, version]);

  return (
    <div
      style={{
        position: "fixed",
        top: showCrmChrome ? CRM_TOPBAR_HEIGHT : 0,
        left: showCrmChrome ? CRM_SIDEBAR_WIDTH : 0,
        right: 0,
        bottom: 0,
        zIndex: 300,
        background: "#fff",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          borderBottom: "1px solid var(--border, #e2e8f0)",
        }}
      >
        <strong>Modifier le document (version {version})</strong>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="cbtn cbtn-ghost cbtn-sm" onClick={() => setShowCrmChrome((v) => !v)}>
            {showCrmChrome ? "Masquer le menu CRM" : "Afficher le menu CRM"}
          </button>
          <button type="button" className="cbtn cbtn-ghost cbtn-sm" onClick={onClose}>
            ✕ Fermer
          </button>
        </div>
      </div>
      {err ? (
        <div style={{ padding: 24 }}>
          <p className="crm-alert crm-alert--error">{err}</p>
        </div>
      ) : (
        <>
          {loading ? <p className="crm-hint" style={{ padding: 16 }}>Ouverture de l&apos;éditeur…</p> : null}
          <div id={containerId} style={{ flex: 1, minHeight: 0 }} />
        </>
      )}
    </div>
  );
}
