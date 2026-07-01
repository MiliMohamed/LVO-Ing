"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clientApiFetch } from "@/lib/client-api";
import { readClientContact } from "@/lib/token-storage";
import { useSelectedSite } from "@/lib/site-context";
import type { SiteRow, OffreRow, CommandeRow, FactureRow } from "@/lib/types";

type ClientNotif = { id: number; title: string; message: string; kind: string; href: string | null; read: boolean; createdAt: string };

const STATUT_PAY_COLOR: Record<string, string> = {
  PAYE: "#16a34a",
  EN_RETARD: "#dc2626",
  NON_PAYE: "#d97706",
  PARTIELLEMENT_PAYE: "#2563eb",
};
const STATUT_PAY_LABEL: Record<string, string> = {
  PAYE: "Payée",
  EN_RETARD: "En retard",
  NON_PAYE: "Non payée",
  PARTIELLEMENT_PAYE: "Part. payée",
};

function KpiCard({ label, value, icon, color, href, sub }: Readonly<{ label: string; value: number | string; icon: string; color: string; href?: string; sub?: string }>) {
  const inner = (
    <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, padding: "20px 22px", borderTop: `3px solid ${color}`, cursor: href ? "pointer" : "default", transition: "box-shadow 0.15s" }}>
      <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--smoke)", marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{sub}</div>}
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: "none" }}>{inner}</Link> : inner;
}

function Section({ title, icon, href, children }: Readonly<{ title: string; icon: string; href?: string; children: React.ReactNode }>) {
  return (
    <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, padding: 24, marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--navy)", display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
          <span>{icon}</span>{title}
        </h2>
        {href && <Link href={href} style={{ fontSize: 12, color: "var(--orange)", fontWeight: 600 }}>Voir tout →</Link>}
      </div>
      {children}
    </div>
  );
}

function AlertBanner({ children, color = "#d97706", bg = "#fffbf5", border = "#fed7aa" }: Readonly<{ children: React.ReactNode; color?: string; bg?: string; border?: string }>) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "12px 16px", color, fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
      {children}
    </div>
  );
}

export default function ClientDashboardPage() {
  const contact = readClientContact();
  const { selectedSite, sites } = useSelectedSite();

  const [allOffres, setAllOffres] = useState<OffreRow[]>([]);
  const [allCommandes, setAllCommandes] = useState<CommandeRow[]>([]);
  const [allFactures, setAllFactures] = useState<FactureRow[]>([]);
  const [notifs, setNotifs] = useState<ClientNotif[]>([]);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [o, c, f, n] = await Promise.all([
          clientApiFetch<OffreRow[]>("/api/client/offres"),
          clientApiFetch<CommandeRow[]>("/api/client/commandes"),
          clientApiFetch<FactureRow[]>("/api/client/factures"),
          clientApiFetch<{ notifications: ClientNotif[]; unreadCount: number }>("/api/client/notifications"),
        ]);
        setAllOffres(o);
        setAllCommandes(c);
        setAllFactures(f);
        setNotifs(n.notifications.slice(0, 4));
        setUnreadNotifs(n.unreadCount);
      } catch {
        setError("Impossible de charger les données. Vérifiez votre connexion.");
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Filter everything by selected site
  const siteNom = selectedSite?.nom ?? null;
  const offres = siteNom ? allOffres.filter((o) => o.siteNom === siteNom) : allOffres;
  const commandes = siteNom ? allCommandes.filter((c) => c.siteNom === siteNom) : allCommandes;
  const siteCommandeIds = new Set(commandes.map((c) => c.id));
  const factures = siteNom
    ? allFactures.filter((f) => f.commandeId != null && siteCommandeIds.has(f.commandeId))
    : allFactures;

  // KPIs
  const offresPending = offres.filter((o) => o.statut === "ENVOYEE");
  const commandesActive = commandes.filter((c) => !["CLOTUREE", "ANNULEE"].includes(c.statut ?? ""));
  const facturesRetard = factures.filter((f) => f.statutPaiement === "EN_RETARD");
  const facturesImpayees = factures.filter((f) => ["NON_PAYE", "EN_RETARD", "PARTIELLEMENT_PAYE"].includes(f.statutPaiement ?? ""));
  const totalImpaye = facturesImpayees.reduce((sum, f) => sum + (f.montantHt - (f.montantPaye ?? 0)), 0);
  const totalCA = commandes.reduce((sum, c) => sum + c.montantHt, 0);

  return (
    <div>
      {/* Welcome header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--navy)", marginBottom: 4 }}>
          Bonjour{contact ? `, ${contact.prenom} ${contact.nom}` : ""} 👋
        </h1>
        <p style={{ fontSize: 14, color: "var(--smoke)", margin: 0 }}>
          {contact?.entreprise}
          {siteNom ? (
            <> · <strong style={{ color: "var(--navy)" }}>{siteNom}</strong></>
          ) : sites.length > 1 ? (
            <> · <span style={{ color: "var(--g400)" }}>Tous les sites ({sites.length})</span></>
          ) : null}
        </p>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", color: "#dc2626", marginBottom: 24 }}>
          {error}
        </div>
      )}

      {/* Alert banners */}
      {loaded && offresPending.length > 0 && (
        <AlertBanner>
          📋 <strong>{offresPending.length} offre{offresPending.length > 1 ? "s" : ""}</strong> en attente de votre décision.{" "}
          <Link href="/espace-client/offres" style={{ color: "var(--orange)", fontWeight: 700, marginLeft: 4 }}>Consulter →</Link>
        </AlertBanner>
      )}
      {loaded && facturesRetard.length > 0 && (
        <AlertBanner color="#dc2626" bg="#fef2f2" border="#fecaca">
          🧾 <strong>{facturesRetard.length} facture{facturesRetard.length > 1 ? "s" : ""}</strong> en retard de paiement.{" "}
          <Link href="/espace-client/factures" style={{ color: "#dc2626", fontWeight: 700, marginLeft: 4 }}>Voir →</Link>
        </AlertBanner>
      )}
      {loaded && unreadNotifs > 0 && (
        <AlertBanner color="#2563eb" bg="#eff6ff" border="#bfdbfe">
          🔔 <strong>{unreadNotifs}</strong> nouvelle{unreadNotifs > 1 ? "s" : ""} notification{unreadNotifs > 1 ? "s" : ""}.{" "}
          <Link href="/espace-client/notifications" style={{ color: "#2563eb", fontWeight: 700, marginLeft: 4 }}>Voir →</Link>
        </AlertBanner>
      )}

      {/* KPI grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))", gap: 14, marginBottom: 32 }}>
        <KpiCard label="Offres" value={offres.length} icon="📋" color="#ff6b00" href="/espace-client/offres"
          sub={offresPending.length > 0 ? `${offresPending.length} en attente` : undefined} />
        <KpiCard label="Missions actives" value={commandesActive.length} icon="⚙️" color="#7c3aed" href="/espace-client/suivi" />
        <KpiCard label="CA total" value={`${(totalCA / 1000).toFixed(0)} k€`} icon="💶" color="#0891b2"
          sub="montant HT engagé" />
        <KpiCard label="Factures" value={factures.length} icon="🧾" color="#16a34a" href="/espace-client/factures"
          sub={facturesRetard.length > 0 ? `${facturesRetard.length} en retard` : undefined} />
        {totalImpaye > 0 && (
          <KpiCard label="Solde à régler" value={`${totalImpaye.toLocaleString("fr-FR")} €`} icon="⚠️" color="#dc2626" href="/espace-client/factures" />
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        {/* Missions en cours */}
        <Section title="Missions en cours" icon="⚙️" href="/espace-client/suivi">
          {commandesActive.length === 0 && <p style={{ color: "var(--smoke)", fontSize: 13 }}>Aucune mission active{siteNom ? ` pour ce site` : ""}.</p>}
          {commandesActive.slice(0, 4).map((c) => {
            const STEPS = ["EN_ATTENTE", "SIGNATURE", "EN_COURS", "LIVRE", "FACTURE_PARTIELLE", "FACTUREE", "CLOTUREE"];
            const idx = STEPS.indexOf(c.statut ?? "");
            const pct = idx < 0 ? 0 : Math.round(((idx + 1) / STEPS.length) * 100);
            return (
              <div key={c.id} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: "var(--navy)" }}>{c.numeroCommande}</span>
                  <span style={{ fontSize: 12, color: "var(--smoke)" }}>{c.siteNom}</span>
                </div>
                <div style={{ height: 5, background: "var(--g100)", borderRadius: 99 }}>
                  <div style={{ height: 5, background: pct === 100 ? "#16a34a" : "var(--orange)", borderRadius: 99, width: `${pct}%` }} />
                </div>
                <div style={{ fontSize: 11, color: "var(--smoke)", marginTop: 2 }}>{c.statut?.replaceAll("_", " ")} · {pct}%</div>
              </div>
            );
          })}
        </Section>

        {/* Factures récentes */}
        <Section title="Dernières factures" icon="🧾" href="/espace-client/factures">
          {factures.length === 0 && <p style={{ color: "var(--smoke)", fontSize: 13 }}>Aucune facture{siteNom ? ` pour ce site` : ""}.</p>}
          {factures.slice(0, 5).map((f) => (
            <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: "var(--navy)" }}>{f.numeroFacture}</div>
                <div style={{ fontSize: 11, color: "var(--smoke)" }}>{f.dateEcheance ? `Éch. ${f.dateEcheance}` : "Pas d'échéance"}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{f.montantHt.toLocaleString("fr-FR")} €</div>
                <div style={{ fontSize: 11, color: STATUT_PAY_COLOR[f.statutPaiement ?? ""] ?? "var(--smoke)", fontWeight: 600 }}>
                  {STATUT_PAY_LABEL[f.statutPaiement ?? ""] ?? f.statutPaiement}
                </div>
              </div>
            </div>
          ))}
        </Section>
      </div>

      {/* Sites (only show if no site selected and multiple sites) */}
      {!siteNom && sites.length > 1 && (
        <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--navy)", marginBottom: 16 }}>
            🏢 Mes sites ({sites.length})
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
            {sites.map((s: SiteRow) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "var(--g50)", borderRadius: 10 }}>
                <span style={{ fontSize: 20 }}>🏗️</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--navy)" }}>{s.nom}</div>
                  <div style={{ fontSize: 11, color: "var(--smoke)" }}>{s.typeSite}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notifications récentes */}
      <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, padding: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--navy)", display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
            🔔 Notifications récentes
          </h2>
          <Link href="/espace-client/notifications" style={{ fontSize: 12, color: "var(--orange)", fontWeight: 600 }}>Voir tout →</Link>
        </div>
        {notifs.length === 0 && <p style={{ color: "var(--smoke)", fontSize: 13 }}>Aucune notification.</p>}
        {notifs.map((n) => (
          <div key={n.id} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--g100)" }}>
            <span style={{ fontSize: 16 }}>{n.kind === "MESSAGE" ? "💬" : n.kind === "OFFRE_UPDATE" ? "📋" : n.kind === "FACTURE" ? "🧾" : "ℹ️"}</span>
            <div>
              <div style={{ fontWeight: n.read ? 500 : 700, fontSize: 12, color: "var(--navy)" }}>{n.title}</div>
              <div style={{ fontSize: 11, color: "var(--smoke)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>{n.message}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, padding: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)", marginBottom: 16 }}>Actions rapides</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            { href: "/espace-client/messagerie", icon: "💬", label: "Envoyer un message" },
            { href: "/espace-client/documents", icon: "📤", label: "Déposer un document" },
            { href: "/espace-client/offres", icon: "📋", label: "Mes offres" },
            { href: "/espace-client/suivi", icon: "⚙️", label: "Suivi missions" },
            { href: "/espace-client/factures", icon: "🧾", label: "Mes factures" },
          ].map(({ href, icon, label }) => (
            <Link
              key={href}
              href={href}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", background: "var(--g50)", border: "1px solid var(--g200)", borderRadius: 10, fontSize: 13, color: "var(--navy)", fontWeight: 500, textDecoration: "none" }}
            >
              <span>{icon}</span> {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
