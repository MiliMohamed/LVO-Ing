"use client";

import { useEffect, useRef, useState } from "react";
import { clientApiFetch, clientApiDelete } from "@/lib/client-api";
import { getApiBaseUrl } from "@/lib/config";
import { readClientToken } from "@/lib/token-storage";
import type { SiteRow } from "@/lib/types";

const TYPE_COLORS: Record<string, string> = {
  Tertiaire:   "#2563eb",
  Industriel:  "#16a34a",
  Résidentiel: "#d97706",
};

function SiteCard({ site, onImageUpdated }: { site: SiteRow; onImageUpdated: (id: number, dataUrl: string | null) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [hover, setHover] = useState(false);
  const accent = TYPE_COLORS[site.typeSite] ?? "var(--orange)";

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const base = getApiBaseUrl();
      const token = readClientToken();
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch(`${base}/api/client/sites/${site.id}/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}` },
        body: fd,
      });
      if (!res.ok) throw new Error();
      // Lire le dataUrl depuis un FileReader pour mise à jour UI immédiate
      const reader = new FileReader();
      reader.onload = (e) => onImageUpdated(site.id, e.target?.result as string | null);
      reader.readAsDataURL(file);
    } catch {
      alert("Erreur lors de l'upload de l'image.");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    if (!confirm("Supprimer l'image de ce site ?")) return;
    setUploading(true);
    try {
      await clientApiDelete(`/api/client/sites/${site.id}/image`);
      onImageUpdated(site.id, null);
    } catch {
      alert("Erreur lors de la suppression.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      style={{
        background: "#fff", border: "1px solid var(--g200)", borderRadius: 14,
        borderLeft: `4px solid ${accent}`, overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}
    >
      {/* Image zone */}
      <div
        style={{
          height: 160, background: site.imageDataUrl ? "transparent" : "var(--g50)",
          position: "relative", cursor: "pointer", flexShrink: 0,
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => fileRef.current?.click()}
      >
        {site.imageDataUrl ? (
          <img
            src={site.imageDataUrl}
            alt={site.nom}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{
            width: "100%", height: "100%", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", color: "var(--smoke)", gap: 8,
          }}>
            <span style={{ fontSize: 30 }}>🏢</span>
            <span style={{ fontSize: 12 }}>Ajouter une photo</span>
          </div>
        )}

        {/* Overlay upload */}
        {(hover || uploading) && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            color: "#fff", gap: 6, fontSize: 13, fontWeight: 700,
          }}>
            {uploading ? (
              <span>Chargement…</span>
            ) : (
              <>
                <span style={{ fontSize: 22 }}>📷</span>
                <span>{site.imageDataUrl ? "Changer la photo" : "Ajouter une photo"}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "16px 20px", flex: 1 }}>
        <div style={{ fontWeight: 700, color: "var(--navy)", fontSize: 15, marginBottom: 4 }}>{site.nom}</div>
        <div style={{ fontSize: 12, color: accent, fontWeight: 600 }}>{site.typeSite}</div>
      </div>

      {/* Actions */}
      <div style={{ padding: "0 20px 14px", display: "flex", gap: 8 }}>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          style={{
            flex: 1, background: "var(--g50)", border: "1px solid var(--g200)", borderRadius: 8,
            padding: "7px 0", fontSize: 12, fontWeight: 600, cursor: "pointer",
            color: "var(--navy)",
          }}
        >
          {site.imageDataUrl ? "Changer la photo" : "Ajouter une photo"}
        </button>
        {site.imageDataUrl && (
          <button
            onClick={() => void handleRemove()}
            disabled={uploading}
            style={{
              background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8,
              padding: "7px 12px", fontSize: 12, cursor: "pointer", color: "#dc2626",
            }}
          >
            Supprimer
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export default function ClientSitesPage() {
  const [sites, setSites] = useState<SiteRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void clientApiFetch<SiteRow[]>("/api/client/sites")
      .then(setSites)
      .catch(() => setError("Impossible de charger les sites."));
  }, []);

  function handleImageUpdated(id: number, dataUrl: string | null) {
    setSites((prev) => prev?.map((s) => s.id === id ? { ...s, imageDataUrl: dataUrl } : s) ?? prev);
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--navy)", marginBottom: 4 }}>Mes sites</h1>
        <p style={{ fontSize: 13, color: "var(--smoke)" }}>Gérez les photos de vos sites — cliquez sur une carte pour ajouter une image</p>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", color: "#dc2626", marginBottom: 24 }}>
          {error}
        </div>
      )}

      {sites === null && !error && (
        <div style={{ color: "var(--smoke)", padding: "40px 0", textAlign: "center" }}>Chargement…</div>
      )}

      {sites && sites.length === 0 && (
        <div style={{ color: "var(--smoke)", padding: "60px 0", textAlign: "center" }}>
          Aucun site associé à votre compte pour le moment.
        </div>
      )}

      {sites && sites.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {sites.map((s) => (
            <SiteCard key={s.id} site={s} onImageUpdated={handleImageUpdated} />
          ))}
        </div>
      )}
    </div>
  );
}
