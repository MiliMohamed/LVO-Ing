import Image from "next/image";
import Link from "next/link";

import { LVO_LOGO_ALT, LVO_LOGO_SRC } from "@/lib/branding";

const MODULES = [
  "Clients & Contacts",
  "Pipeline commercial",
  "Offres & Devis",
  "Commandes",
  "Facturation",
  "Recouvrement",
  "Sites & Équipements",
  "Messagerie client",
  "Rapports & KPI",
];

const FEATURES = [
  { icon: "🧭", t: "Pipeline commercial", d: "Suivez chaque affaire de la prospection à la signature, sans perdre le fil d'une opportunité." },
  { icon: "📄", t: "Offres & devis", d: "Générez des offres multi-missions, éditables et versionnées, directement liées au client et au site." },
  { icon: "🧾", t: "Commandes & facturation", d: "Du bon de commande à l'échéancier de paiement, avec facturation automatique et suivi des règlements." },
  { icon: "🏢", t: "Sites & équipements", d: "Arborescence documentaire par site, inventaire des équipements et gestionnaires associés." },
  { icon: "📬", t: "Messagerie client", d: "Échangez avec vos clients depuis le CRM — messages, documents et notifications centralisés." },
  { icon: "📊", t: "Rapports & tableaux de bord", d: "KPI d'activité, recouvrement, tâches et audit — une vision claire pour chaque rôle." },
];

export default function CrmLandingPage() {
  const y = new Date().getFullYear();
  const items = [...MODULES, ...MODULES];

  return (
    <div className="lvo-site">
      <nav id="site-nav">
        <Link href="/" className="nav-logo">
          <Image src={LVO_LOGO_SRC} alt={LVO_LOGO_ALT} width={30} height={30} className="object-contain" priority />
          LVO CRM
        </Link>
        <div className="nav-right">
          <Link href="/login" className="nav-cta">
            Se connecter →
          </Link>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-grid" aria-hidden />
        <div className="shaft" aria-hidden />
        <div className="hero-content">
          <div>
            <div className="hero-eyebrow">Plateforme interne — LVO Ingénierie</div>
            <h1 className="hero-h1">
              PILOTEZ
              <br />
              VOTRE <em>ACTIVITÉ</em>
              <br />
              COMMERCIALE
            </h1>
            <p className="hero-sub">
              <strong>LVO CRM</strong> centralise clients, offres, commandes, facturation et suivi de sites — pour
              piloter chaque mission de l&apos;audit à la garantie de parfait achèvement.
            </p>
            <div className="hero-actions">
              <Link href="/login" className="btn-hero">
                Accéder au CRM →
              </Link>
            </div>
          </div>
          <div className="hero-card">
            <div className="hc-title">Modules disponibles</div>
            <div className="hc-tags">
              {MODULES.map((m) => (
                <div key={m} className="hc-tag">
                  {m}
                </div>
              ))}
            </div>
            <div className="hc-divider" />
            <div className="hc-badges">
              <div className="hc-badge">
                <div className="n">Temps réel</div>
                <div className="l">Données partagées par toute l&apos;équipe</div>
              </div>
              <div className="hc-badge">
                <div className="n">Sécurisé</div>
                <div className="l">Accès par rôle (Admin, Manager, Consultant)</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="marquee-section" aria-hidden>
        <div className="marquee-track">
          {items.map((t, i) => (
            <div key={i} className="marquee-item">
              <span className="marquee-dot" />
              {t}
            </div>
          ))}
        </div>
      </div>

      <section className="services-bg" id="fonctionnalites">
        <div className="site-section">
          <div className="label-pill">Fonctionnalités</div>
          <h2 className="section-title">
            CE QUE FAIT
            <br />
            <span className="o">LVO CRM</span>
          </h2>
          <p className="section-sub">
            Un outil unique pour l&apos;équipe commerciale, technique et administrative — connecté à l&apos;espace
            client.
          </p>
          <div className="services-grid">
            {FEATURES.map((f) => (
              <div key={f.t} className="svc-card">
                <div className="svc-icon">{f.icon}</div>
                <h3 className="svc-title">{f.t}</h3>
                <p className="svc-desc">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="site-section" style={{ textAlign: "center" }}>
        <div className="label-pill" style={{ margin: "0 auto 16px", display: "inline-flex" }}>
          Accès
        </div>
        <h2 className="section-title">
          VOTRE ESPACE
          <br />
          <span className="o">VOUS ATTEND</span>
        </h2>
        <p className="section-sub" style={{ margin: "14px auto 32px", textAlign: "center", maxWidth: 480 }}>
          Connectez-vous avec vos identifiants LVO Ingénierie pour retrouver votre tableau de bord.
        </p>
        <Link href="/login" className="btn-hero" style={{ display: "inline-flex" }}>
          Se connecter →
        </Link>
      </section>

      <footer className="site-footer-lite">
        <div>© {y} LVO Ingénierie — Usage interne</div>
        <Link href="/login" style={{ color: "var(--orange)" }}>
          🖥 Accéder au CRM →
        </Link>
      </footer>
    </div>
  );
}
