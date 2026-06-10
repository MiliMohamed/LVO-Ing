import Image from "next/image";
import Link from "next/link";

import { LVO_LOGO_ALT, LVO_LOGO_SRC } from "@/lib/branding";

import { SiteContactForm } from "./SiteContactForm";
import { SiteNav } from "./SiteNav";
import { SiteReveal } from "./SiteReveal";

const MARQUEE = [
  "Audit & Diagnostic",
  "Mission Complète Neuf",
  "Mission Complète Modernisation",
  "Maintenance Management",
  "Étude de Trafic",
  "VISA · DET · AOR · GPA",
  "ESQ · APS · APD · PRO · DCE",
];

const REFS = [
  {
    client: "CHU de La Réunion",
    type: "Hôpital",
    site: "📍 Site Félix Guyon — Saint-Denis (97)",
    txt: "Suivi technique multi-missions : audit, modernisation et maintenance management du parc ascenseurs.",
    amt: "195 k€",
    tags: ["Audit", "MM", "MCM", "DET", "AOR"],
  },
  {
    client: "SIDR",
    type: "Bailleur social",
    site: "📍 Multisites La Réunion — Saint-Denis (97)",
    txt: "Partenaire stratégique : suivi du parc ascenseurs sur l’ensemble de La Réunion.",
    amt: "320 k€",
    tags: ["Audit", "DCE", "MS", "MM"],
  },
  {
    client: "BNP Paribas Real Estate",
    type: "Gestionnaire immo.",
    site: "📍 8 Av. de l'Europe — Sèvres 92310",
    txt: "Mission complète de modernisation de 4 ascenseurs — site occupé.",
    amt: "2 400 €",
    tags: ["MCM", "DCE", "DET", "AOR"],
  },
  {
    client: "25 Hours Hotel",
    type: "Hôtellerie",
    site: "📍 Terminus Nord — Paris 75010",
    txt: "Audit et conseil pour la rénovation des ascenseurs en milieu contraint.",
    amt: "4 800 €",
    tags: ["MCM", "Audit", "VISA"],
  },
];

const TEAM = [
  { initials: "HL", grad: "", name: "Hugues Lassauce", role: "Dir. Technique — La Réunion", s1: "312", s2: "892k€", s3: "RE" },
  { initials: "KM", grad: "linear-gradient(135deg,#2a1a4c,#1a1235)", name: "Karim Mouhib", role: "Ingénieur — Paris", s1: "198", s2: "487k€", s3: "IdF" },
  { initials: "JFQ", grad: "linear-gradient(135deg,#1a3a2c,#0b2018)", name: "Jean-François Quinot", role: "Expert Sénior — Paris", s1: "145", s2: "334k€", s3: "IdF" },
  { initials: "CB", grad: "linear-gradient(135deg,#3a2a10,#221805)", name: "Charline Bedouard", role: "Admin. & CRM", s1: "CRM", s2: "FR/RE", s3: "Support", badgeGold: true },
];

export function SiteHome() {
  const items = [...MARQUEE, ...MARQUEE];
  const y = new Date().getFullYear();

  return (
    <div className="lvo-site">
      <SiteNav />

      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-grid" aria-hidden />
        <div className="shaft" aria-hidden />
        <div className="hero-content">
          <div>
            <div className="hero-eyebrow">Bureau d&apos;Études Mobilité Verticale</div>
            <h1 className="hero-h1">
              EXPERTS
              <br />
              <em>MOBILITÉ</em>
              <br />
              VERTICALE
            </h1>
            <p className="hero-sub">
              <strong>LVO Ingénierie</strong> accompagne maîtres d&apos;ouvrage, promoteurs et gestionnaires dans tous
              leurs projets d&apos;<strong>ascenseurs</strong>, escaliers mécaniques et trottoirs roulants.
            </p>
            <div className="hero-actions">
              <a href="#contact" className="btn-hero">
                Demander un audit →
              </a>
              <a href="#services" className="btn-hero-ghost">
                Nos services
              </a>
            </div>
          </div>
          <div className="hero-card">
            <div className="hc-title">Activité {y}</div>
            <div style={{ marginBottom: 12 }}>
              <div className="hc-val">
                <span>Piloté</span>
              </div>
              <div className="hc-lbl">De l&apos;esquisse (ESQ) à la garantie parfait achèvement (GPA)</div>
            </div>
            <div className="hc-divider" />
            <div className="hc-tags">
              <div className="hc-tag">Ascenseurs</div>
              <div className="hc-tag">Escaliers méca.</div>
              <div className="hc-tag">Trottoirs roulants</div>
              <div className="hc-tag">PMR</div>
            </div>
            <div className="hc-badges">
              <div className="hc-badge">
                <div className="n">France</div>
                <div className="l">National &amp; DOM-TOM</div>
              </div>
              <div className="hc-badge">
                <div className="n">15+</div>
                <div className="l">Années d&apos;expertise</div>
              </div>
            </div>
            <Link href="/login" className="hero-crm-teaser">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span className="nav-crm-dot" />
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--orange)", letterSpacing: 1 }}>
                  Espace CRM
                </span>
                <span style={{ color: "var(--orange)", marginLeft: "auto" }}>→</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Accéder au tableau de bord</div>
              <div style={{ fontSize: 12, color: "var(--smoke)", marginTop: 4 }}>
                Connexion JWT — données PostgreSQL Spring Boot
              </div>
            </Link>
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

      <div className="stats-section" id="stats">
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-num">
              DOM<span className="acc">-</span>TOM
            </div>
            <div className="stat-label">Couverture</div>
            <div className="stat-desc">La Réunion, Paris, PACA</div>
          </div>
          <div className="stat-item">
            <div className="stat-num">
              EN<span className="acc">81</span>
            </div>
            <div className="stat-label">Référentiels</div>
            <div className="stat-desc">Normes &amp; indépendance constructeurs</div>
          </div>
          <div className="stat-item">
            <div className="stat-num">
              MO<span className="acc">E</span>
            </div>
            <div className="stat-label">Coordination</div>
            <div className="stat-desc">Phases études et exécution</div>
          </div>
          <div className="stat-item">
            <div className="stat-num">
              24<span className="acc">h</span>
            </div>
            <div className="stat-label">Premier retour</div>
            <div className="stat-desc">Objectif sous 24h ouvrées (contact mail)</div>
          </div>
        </div>
      </div>

      <section className="services-bg" id="services">
        <div className="site-section">
          <SiteReveal>
            <div className="label-pill">Nos Services</div>
            <h2 className="section-title">
              CE QUE NOUS
              <br />
              <span className="o">FAISONS</span>
            </h2>
            <p className="section-sub">
              De l&apos;audit initial à la réception des travaux — une couverture complète de vos enjeux de mobilité
              verticale.
            </p>
          </SiteReveal>
          <div className="services-grid">
            {[
              { icon: "🔍", t: "Audit & Diagnostic", d: "Évaluation technique avec préconisations chiffrées." },
              { icon: "🏗️", t: "Mission complète Neuf", d: "MOE ESQ→GPA pour installations neuves." },
              { icon: "🔄", t: "Modernisation", d: "Rénovation, mise aux normes et dossier marchés." },
              { icon: "📊", t: "Maintenance Management", d: "Supervision prestataires, reporting et optimisation." },
              { icon: "📈", t: "Étude de trafic", d: "Analyse et dimensionnement des flux verticaux." },
              { icon: "📋", t: "Mission spéciale", d: "Expertise, conseil ponctuel et litiges techniques." },
            ].map((s) => (
              <div key={s.t} className="svc-card">
                <div className="svc-icon">{s.icon}</div>
                <h3 className="svc-title">{s.t}</h3>
                <p className="svc-desc">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="site-section" id="expertise">
        <div className="exp-grid">
          <SiteReveal>
            <div className="exp-visual-box">
              <div className="ev-wrap">
                <div className="ev-rail" />
                <div className="ev-rail2" />
                <div className="ev-floor" style={{ bottom: "10%" }} />
                <div className="ev-floor" style={{ bottom: "35%" }} />
                <div className="ev-floor" style={{ bottom: "62%" }} />
                <div className="ev-floor" style={{ top: "10%" }} />
                <div className="ev-cabin" aria-hidden />
              </div>
            </div>
          </SiteReveal>
          <div>
            <SiteReveal>
              <div className="label-pill">Notre expertise</div>
              <h2 className="section-title">
                POURQUOI
                <br />
                CHOISIR
                <br />
                <span className="o">LVO ?</span>
              </h2>
            </SiteReveal>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 28 }}>
              {[
                { i: "⚖️", t: "Indépendance", d: "Préconisations dictées uniquement par l’intérêt du maître d’ouvrage." },
                { i: "🗺️", t: "National & DOM-TOM", d: "Paris, Sophia-Antipolis et La Réunion — présence terrain complète." },
                { i: "📐", t: "Toutes technologies", d: "Hydraulique, électrique, escaliers, trottoirs roulants, PMR — toutes marques." },
                { i: "🏆", t: "Références majeures", d: "CHU, bailleurs (SIDR), gestionnaires (BNRP REPM), hôtellerie, promoteurs." },
              ].map((x) => (
                <SiteReveal key={x.t}>
                  <div style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: 16, border: "1px solid var(--line)", borderRadius: 14 }}>
                    <span style={{ fontSize: 22 }}>{x.i}</span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{x.t}</div>
                      <div style={{ fontSize: 12, color: "var(--smoke)", marginTop: 4, lineHeight: 1.55 }}>{x.d}</div>
                    </div>
                  </div>
                </SiteReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="phases-bg" id="phases">
        <div className="phases-inner">
          <SiteReveal style={{ textAlign: "center" }}>
            <div style={{ margin: "0 auto 16px" }} className="label-pill">
              Méthodologie
            </div>
            <h2 className="section-title" style={{ justifySelf: "center" }}>
              NOS <span className="o">PHASES</span> DE MISSION
            </h2>
          </SiteReveal>
          <div style={{ marginTop: 40 }}>
            <div className="phase-grp-lbl">CONCEPTION</div>
            <div className="phases-row">
              {[
                ["✏️", "Préalable", "ESQ", "Esquisse"],
                ["📐", "Conception", "APS", "APS"],
                ["📋", "Conception", "APD", "APD"],
                ["📊", "Technique", "PRO", "Projet"],
                ["📑", "Consultation", "DCE", "DCE"],
                ["🤝", "Marchés", "AMT/ACT", "Assistance"],
              ].map(([dot, grp, nm, dsc]) => (
                <div key={nm as string} className="ph-step">
                  <div className="ph-dot">{dot}</div>
                  <div className="ph-grp">{grp}</div>
                  <div className="ph-name">{nm}</div>
                  <div className="ph-desc">{dsc}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 32 }}>
            <div className="phase-grp-lbl">EXÉCUTION</div>
            <div className="phases-row">
              {[
                ["✅", "Suivi", "VISA", "Visa exe"],
                ["🔧", "Chantier", "DET", "DET"],
                ["🏁", "Réception", "AOR", "AOR"],
                ["🛡️", "Garantie", "GPA", "GPA"],
              ].map(([dot, grp, nm, dsc]) => (
                <div key={nm as string} className="ph-step">
                  <div className="ph-dot">{dot}</div>
                  <div className="ph-grp">{grp}</div>
                  <div className="ph-name">{nm}</div>
                  <div className="ph-desc">{dsc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="site-section" id="references">
        <SiteReveal>
          <div className="label-pill">Références</div>
          <h2 className="section-title">
            ILS NOUS
            <br />
            <span className="o">FONT CONFIANCE</span>
          </h2>
          <p className="section-sub">Donneurs d&apos;ordre publics et privés nous confient leurs projets sensibles.</p>
        </SiteReveal>
        <div className="refs-grid">
          {REFS.map((r) => (
            <SiteReveal key={r.client}>
              <article className="ref-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span className="rc-client">{r.client}</span>
                  <span className="rc-type">{r.type}</span>
                </div>
                <div className="rc-site">{r.site}</div>
                <p style={{ fontSize: 12, color: "var(--smoke)", lineHeight: 1.65, marginBottom: 10 }}>{r.txt}</p>
                <div className="rc-amount">{r.amt}</div>
                <div className="rc-phases">
                  {r.tags.map((t) => (
                    <span key={t} className="rc-phase">
                      {t}
                    </span>
                  ))}
                </div>
              </article>
            </SiteReveal>
          ))}
        </div>
      </section>

      <section className="proc-bg">
        <div className="proc-inner">
          <SiteReveal style={{ textAlign: "center" }}>
            <div style={{ margin: "0 auto 16px", display: "inline-flex" }} className="label-pill">
              Processus
            </div>
            <h2 className="section-title">
              COMMENT NOUS
              <br />
              <span className="o">TRAVAILLONS</span>
            </h2>
          </SiteReveal>
          <div className="proc-steps">
            {[
              ["01", "Prise de contact", "Échange initial sur vos besoins et vos délais."],
              ["02", "Visite de site", "Inspection réalisée par un ingénieur spécialisé."],
              ["03", "Offre chiffrée", "Proposition détaillée avec planning transparent."],
              ["04", "Mission", "Pilotage, reporting et coordination."],
              ["05", "Livraison", "Réception, rapport et suivi post-livraison."],
            ].map(([num, title, txt]) => (
              <SiteReveal key={num as string} className="proc-step">
                <div className="proc-num">{num}</div>
                <div className="proc-title">{title}</div>
                <div className="proc-desc">{txt}</div>
              </SiteReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="site-section" id="equipe">
        <SiteReveal>
          <div className="label-pill">L&apos;équipe</div>
          <h2 className="section-title">
            NOS <span className="o">CONSULTANTS</span>
          </h2>
          <p className="section-sub">Ingénieurs spécialisés et experts métier — chiffres indicatifs (maquette).</p>
        </SiteReveal>
        <div className="team-grid">
          {TEAM.map((m) => (
            <SiteReveal key={m.initials}>
              <article className="team-card">
                <div className="tc-avatar" style={m.grad ? { background: m.grad } : undefined}>
                  <div className="tc-initial">{m.initials}</div>
                  <div className="tc-badge" style={m.badgeGold ? { background: "var(--gold)", color: "#111" } : undefined}>
                    {m.initials}
                  </div>
                </div>
                <div className="tc-info">
                  <div className="tc-name">{m.name}</div>
                  <div className="tc-role">{m.role}</div>
                  <div className="tc-stats">
                    <div className="tc-stat">
                      <div className="n">{m.s1}</div>
                      <div className="l">Charge</div>
                    </div>
                    <div className="tc-stat">
                      <div className="n">{m.s2}</div>
                      <div className="l">Zone / CA*</div>
                    </div>
                    <div className="tc-stat">
                      <div className="n">{m.s3}</div>
                      <div className="l">Réf.</div>
                    </div>
                  </div>
                </div>
              </article>
            </SiteReveal>
          ))}
        </div>
      </section>

      <section className="cta-bg">
        <div className="cta-inner">
          <SiteReveal style={{ justifySelf: "center" }}>
            <div style={{ margin: "0 auto 16px", display: "inline-flex" }} className="label-pill">
              Prêt à démarrer ?
            </div>
          </SiteReveal>
          <h2 className="section-title" style={{ textAlign: "center" }}>
            VOTRE PROJET
            <br />
            <span className="o">COMMENCE ICI</span>
          </h2>
          <p className="section-sub" style={{ margin: "14px auto 0", textAlign: "center", maxWidth: 520 }}>
            Contactez-nous pour un premier échange.
          </p>
          <div className="cta-actions">
            <a href="#contact" className="btn-hero">
              Demander un devis gratuit →
            </a>
            <Link href="/login" className="btn-hero-ghost">
              🖥 Accéder au CRM
            </Link>
          </div>
          <div className="cta-info">
            <div className="cta-info-item">✅ Réponse sous 24h</div>
            <div className="cta-info-item">✅ Bureau indépendant</div>
            <div className="cta-info-item">✅ National &amp; DOM-TOM</div>
          </div>
        </div>
      </section>

      <section className="site-section" id="contact">
        <div className="contact-grid">
          <SiteReveal>
            <div className="label-pill">Contact</div>
            <h2 className="section-title">
              PARLEZ-NOUS
              <br />
              DE VOTRE
              <br />
              <span className="o">PROJET</span>
            </h2>
            <p className="section-sub">
              Rénovation, neuf ou expertise : décrivez-nous vos contraintes et nous revenons vers vous rapidement.
            </p>
            <div style={{ marginTop: 24 }}>
              {[
                ["📍", "Agences", "Paris · Sophia-Antipolis · La Réunion"],
                ["📧", "Email", "contact@lvo-ingenierie.fr"],
                ["📞", "Paris", "+33 1 55 69 43 61"],
                ["🕐", "Horaires", "Lun–Ven : 8h30 – 18h00"],
              ].map(([ic, lbl, val]) => (
                <div key={lbl as string} className="cd-item">
                  <div className="cd-icon">{ic}</div>
                  <div>
                    <div className="cd-label">{lbl}</div>
                    <div className="cd-val">{val}</div>
                  </div>
                </div>
              ))}
            </div>
          </SiteReveal>
          <SiteReveal>
            <SiteContactForm />
          </SiteReveal>
        </div>
      </section>

      <footer className="site-footer" id="contact-footer">
        <div className="footer-grid">
          <div>
            <Link href="/" className="footer-logo">
              <Image src={LVO_LOGO_SRC} alt={LVO_LOGO_ALT} width={36} height={36} className="object-contain" /> LVO Ingénierie
            </Link>
            <p className="footer-tagline">
              Bureau d&apos;études — mobilité verticale. Ascenseurs, escaliers mécaniques et trottoirs roulants au
              service des maîtres d&apos;ouvrage.
            </p>
          </div>
          <div>
            <div className="ft-col-title">Services</div>
            <Link className="ft-link" href="#services">
              Audit &amp; Diagnostic
            </Link>
            <Link className="ft-link" href="#services">
              Mission neuve / modernisation
            </Link>
            <Link className="ft-link" href="#services">
              Étude de trafic / MM
            </Link>
          </div>
          <div>
            <div className="ft-col-title">Entreprise</div>
            <Link className="ft-link" href="#expertise">
              Notre expertise
            </Link>
            <Link className="ft-link" href="#references">
              Références
            </Link>
            <Link className="ft-link" href="#equipe">
              Équipe
            </Link>
            <Link className="ft-link" href="#contact">
              Contact
            </Link>
            <Link className="ft-link" href="/login" style={{ color: "var(--orange)" }}>
              🖥 Espace CRM →
            </Link>
          </div>
          <div>
            <div className="ft-col-title">Zones</div>
            <span className="ft-link">Paris · PACA · La Réunion</span>
            <div style={{ marginTop: 14 }} className="ft-col-title">
              Légal
            </div>
            <span className="ft-link">Mentions légales (placeholder)</span>
          </div>
        </div>
        <div className="footer-bottom">
          <div>
            © {y} LVO Ingénierie — Tous droits réservés
          </div>
          <div>
            Développement CRM : Spring Boot · Next.js ({y})
          </div>
        </div>
      </footer>
    </div>
  );
}
