"use client";

import { useEffect, useState } from "react";
import { clientApiFetch } from "@/lib/client-api";

type Appareil = {
  id: number;
  numero: string;
  label: string | null;
  siteNom: string | null;
  entreprise: string | null;
  enArret: boolean;
};

export default function AppareilsPage() {
  const [appareils, setAppareils] = useState<Appareil[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filtreArret, setFiltreArret] = useState<"" | "arret" | "service">("");

  useEffect(() => {
    void clientApiFetch<Appareil[]>("/api/client/appareils")
      .then((data) => {
        const sorted = [...data].sort((a, b) => {
          if (a.enArret && !b.enArret) return -1;
          if (!a.enArret && b.enArret) return 1;
          return a.numero.localeCompare(b.numero);
        });
        setAppareils(sorted);
      })
      .catch(() => setError("Impossible de charger vos appareils."));
  }, []);

  const displayed = (appareils ?? []).filter((a) => {
    const q = search.toLowerCase();
    const matchSearch = !q || a.numero.toLowerCase().includes(q) || (a.label ?? "").toLowerCase().includes(q) || (a.siteNom ?? "").toLowerCase().includes(q);
    const matchArret = filtreArret === "" || (filtreArret === "arret" && a.enArret) || (filtreArret === "service" && !a.enArret);
    return matchSearch && matchArret;
  });

  const nbArret = (appareils ?? []).filter((a) => a.enArret).length;
  const nbService = (appareils ?? []).filter((a) => !a.enArret).length;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--navy)", marginBottom: 4 }}>Mes appareils</h1>
        <p style={{ fontSize: 13, color: "var(--smoke)" }}>
          Liste de vos ascenseurs et équipements suivis par LVO Ingénierie
        </p>
      </div>

      {/* KPI */}
      {appareils !== null && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
          <KpiCard icon="🛗" value={appareils.length} label="Total appareils" color="var(--navy)" />
          <KpiCard icon="🟢" value={nbService} label="En service" color="#16a34a" />
          <KpiCard icon="🔴" value={nbArret} label="À l'arrêt" color={nbArret > 0 ? "#dc2626" : "#9ca3af"} />
        </div>
      )}

      {/* Alerte appareils à l'arrêt */}
      {nbArret > 0 && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20 }}>🚨</span>
          <div>
            <strong style={{ color: "#b91c1c", fontSize: 13 }}>
              {nbArret} appareil{nbArret > 1 ? "s" : ""} à l'arrêt
            </strong>
            <p style={{ margin: 0, fontSize: 12, color: "#7f1d1d" }}>
              Des devis de remise en service sont peut-être en attente de votre validation.{" "}
              <a href="/espace-client/devis" style={{ color: "#b91c1c", fontWeight: 700 }}>Consulter les devis →</a>
            </p>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un appareil…"
          style={{ border: "1px solid var(--g200)", borderRadius: 8, padding: "8px 14px", fontSize: 13, minWidth: 200, flex: 1 }}
        />
        <div style={{ display: "flex", gap: 6 }}>
          {(["", "service", "arret"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setFiltreArret(v)}
              style={{
                padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: filtreArret === v ? "2px solid var(--navy)" : "1px solid var(--g200)",
                background: filtreArret === v ? "var(--navy)" : "#fff",
                color: filtreArret === v ? "#fff" : "var(--g500)",
              }}
            >
              {v === "" ? "Tous" : v === "service" ? "En service" : "À l'arrêt"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", color: "#dc2626", marginBottom: 20 }}>
          {error}
        </div>
      )}

      {appareils === null && !error && (
        <div style={{ color: "var(--smoke)", padding: "40px 0", textAlign: "center" }}>Chargement…</div>
      )}

      {appareils !== null && appareils.length === 0 && (
        <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, padding: "60px 0", textAlign: "center", color: "var(--smoke)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🛗</div>
          Aucun appareil enregistré pour votre compte.<br />
          <span style={{ fontSize: 13 }}>Contactez LVO Ingénierie pour initialiser votre parc.</span>
        </div>
      )}

      {appareils !== null && appareils.length > 0 && displayed.length === 0 && (
        <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, padding: 40, textAlign: "center", color: "var(--smoke)" }}>
          Aucun appareil ne correspond à votre recherche.
        </div>
      )}

      {displayed.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
          {displayed.map((a) => (
            <div
              key={a.id}
              style={{
                background: "#fff",
                border: a.enArret ? "2px solid #fca5a5" : "1px solid var(--g200)",
                borderRadius: 12,
                padding: "18px 20px",
                position: "relative",
              }}
            >
              {a.enArret && (
                <span style={{
                  position: "absolute", top: 10, right: 12,
                  background: "#b91c1c", color: "#fff",
                  fontSize: 10, fontWeight: 800, borderRadius: 6, padding: "2px 8px",
                  textTransform: "uppercase", letterSpacing: 0.5,
                }}>
                  À l'arrêt
                </span>
              )}
              <div style={{ fontSize: 11, color: "var(--smoke)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                {a.entreprise ?? "—"}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--navy)", fontFamily: "monospace", marginBottom: 4 }}>
                {a.numero}
              </div>
              {a.label && (
                <div style={{ fontSize: 13, color: "#374151", marginBottom: 8 }}>{a.label}</div>
              )}
              {a.siteNom && (
                <div style={{ fontSize: 12, color: "var(--smoke)", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>🏢</span> {a.siteNom}
                </div>
              )}
              <div style={{ marginTop: 14 }}>
                <span style={{
                  display: "inline-block",
                  padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: a.enArret ? "#fef2f2" : "#f0fdf4",
                  color: a.enArret ? "#b91c1c" : "#16a34a",
                  border: `1px solid ${a.enArret ? "#fca5a5" : "#86efac"}`,
                }}>
                  {a.enArret ? "Hors service" : "En service"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, value, label, color }: { icon: string; value: number; label: string; color: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ fontSize: 18, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--smoke)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</div>
    </div>
  );
}
