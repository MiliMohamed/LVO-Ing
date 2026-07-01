"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/espace-client/dashboard",      icon: "🏠", label: "Tableau de bord" },
  { href: "/espace-client/suivi",           icon: "⚙️", label: "Suivi des missions" },
  { href: "/espace-client/interventions",   icon: "🔧", label: "Interventions" },
  { href: "/espace-client/contrats",         icon: "📄", label: "Mes contrats" },
  { href: "/espace-client/offres",          icon: "📋", label: "Mes offres" },
  { href: "/espace-client/commandes",       icon: "📦", label: "Mes commandes" },
  { href: "/espace-client/factures",        icon: "🧾", label: "Mes factures" },
  { href: "/espace-client/recouvrement",   icon: "💶", label: "Recouvrement" },
  { href: "/espace-client/sites",           icon: "🏢", label: "Mes sites" },
];

const NAV_DEVIS = [
  { href: "/espace-client/appareils",       icon: "🛗", label: "Mes appareils" },
  { href: "/espace-client/appareils-arret", icon: "⛔", label: "Appareils à l'arrêt" },
  { href: "/espace-client/devis",           icon: "📑", label: "Mes devis" },
];

const NAV_SERVICES = [
  { href: "/espace-client/mms",             icon: "📊", label: "Analyse MMS" },
  { href: "/espace-client/reglementaire",   icon: "⚖️", label: "Réglementaire" },
  { href: "/espace-client/messagerie",      icon: "💬", label: "Messagerie" },
  { href: "/espace-client/documents",       icon: "📤", label: "Mes documents" },
  { href: "/espace-client/notifications",   icon: "🔔", label: "Notifications" },
];

const NAV_COMPTE = [
  { href: "/espace-client/alertes",         icon: "🔔", label: "Mes alertes" },
  { href: "/espace-client/profil",          icon: "👤", label: "Mon profil" },
];

export function ClientSidebar({ isOpen = false }: { isOpen?: boolean }) {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <aside className={`crm-sidebar${isOpen ? " sidebar-open" : ""}`} aria-label="Navigation espace client">
      <p className="sb-intro">
        Bienvenue dans votre espace client LVO — consultez vos sites, projets et factures.
      </p>

      <div>
        <div className="sb-lbl">Mon espace</div>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`sb-it${isActive(item.href) ? " active" : ""}`}
          >
            <span className="sb-ico" aria-hidden>{item.icon}</span>
            <span className="sb-txt">{item.label}</span>
          </Link>
        ))}
      </div>

      <div>
        <div className="sb-lbl">Devis ascenseurs</div>
        {NAV_DEVIS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`sb-it${isActive(item.href) ? " active" : ""}`}
          >
            <span className="sb-ico" aria-hidden>{item.icon}</span>
            <span className="sb-txt">{item.label}</span>
          </Link>
        ))}
      </div>

      <div>
        <div className="sb-lbl">Services</div>
        {NAV_SERVICES.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`sb-it${isActive(item.href) ? " active" : ""}`}
          >
            <span className="sb-ico" aria-hidden>{item.icon}</span>
            <span className="sb-txt">{item.label}</span>
          </Link>
        ))}
      </div>

      <div>
        <div className="sb-lbl">Mon compte</div>
        {NAV_COMPTE.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`sb-it${isActive(item.href) ? " active" : ""}`}
          >
            <span className="sb-ico" aria-hidden>{item.icon}</span>
            <span className="sb-txt">{item.label}</span>
          </Link>
        ))}
      </div>
    </aside>
  );
}
