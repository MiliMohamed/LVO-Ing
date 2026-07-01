"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { LVO_LOGO_ALT, LVO_LOGO_SRC } from "@/lib/branding";
import { clearClientSession, readClientContact } from "@/lib/token-storage";
import { ClientNotificationBell } from "./ClientNotificationBell";

type Props = { onToggleSidebar?: () => void };

function initials(prenom: string, nom: string) {
  return `${prenom[0] ?? ""}${nom[0] ?? ""}`.toUpperCase();
}

export function ClientTopNav({ onToggleSidebar }: Props) {
  const router = useRouter();
  const [contact] = useState(() => readClientContact());
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [menuOpen]);

  function logout() {
    clearClientSession();
    router.replace("/espace-client/login");
    router.refresh();
  }

  const ini = contact ? initials(contact.prenom ?? "?", contact.nom ?? "?") : "?";

  return (
    <header className="crm-topbar" id="crm-nav" style={{ gap: 8 }}>
      {/* Hamburger — mobile only */}
      <button type="button" className="ctb-hamburger" onClick={onToggleSidebar} aria-label="Menu navigation">
        <span /><span /><span />
      </button>

      {/* Brand */}
      <Link href="/espace-client/dashboard" className="ctb-logo shrink-0" style={{ gap: 10 }}>
        <Image src={LVO_LOGO_SRC} alt={LVO_LOGO_ALT} width={28} height={28} className="object-contain" />
        <span style={{ fontWeight: 700, letterSpacing: "0.06em" }}>Espace Client</span>
      </Link>

      {/* Separator */}
      <span className="ctb-sep-site hidden sm:block" aria-hidden />

      {/* Dashboard quick-link */}
      <Link
        href="/espace-client/dashboard"
        className="ctb-link hidden md:inline-flex shrink-0"
        style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12 }}
      >
        <span style={{ fontSize: 13 }}>🏠</span> Tableau de bord
      </Link>

      <div style={{ flex: 1 }} />

      {/* Action icons */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <ClientNotificationBell />

        <Link
          href="/espace-client/messagerie"
          title="Messagerie"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 34,
            height: 34,
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.85)",
            fontSize: 16,
            transition: "background 0.15s, border-color 0.15s",
          }}
        >
          💬
        </Link>

        {/* User menu */}
        <div ref={menuRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label="Mon compte"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 10px 4px 4px",
              borderRadius: 999,
              border: menuOpen
                ? "1px solid rgba(255,107,0,0.45)"
                : "1px solid rgba(255,255,255,0.14)",
              background: menuOpen
                ? "rgba(255,107,0,0.12)"
                : "rgba(255,255,255,0.06)",
              cursor: "pointer",
              transition: "all 0.15s",
              maxWidth: 220,
            }}
          >
            {/* Avatar */}
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "linear-gradient(135deg, var(--orange), #e85d00)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 10,
                flexShrink: 0,
              }}
            >
              {ini}
            </span>
            {/* Name — hidden on mobile */}
            {contact && (
              <span
                className="ctb-user-name"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.9)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 120,
                }}
              >
                {contact.prenom} {contact.nom}
              </span>
            )}
            <svg
              width="8"
              height="5"
              viewBox="0 0 8 5"
              fill="none"
              style={{
                flexShrink: 0,
                opacity: 0.6,
                transition: "transform 0.15s",
                transform: menuOpen ? "rotate(180deg)" : "none",
              }}
            >
              <path d="M1 1l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                minWidth: 240,
                background: "#fff",
                border: "1px solid var(--g200)",
                borderRadius: 12,
                boxShadow: "0 12px 40px rgba(26,43,76,0.18)",
                zIndex: 300,
                overflow: "hidden",
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  padding: "14px 14px 12px",
                  borderBottom: "1px solid var(--g100)",
                  background: "var(--g50)",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, var(--orange), #e85d00)",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 14,
                    flexShrink: 0,
                  }}
                >
                  {ini}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--navy)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {contact ? `${contact.prenom} ${contact.nom}` : "—"}
                  </div>
                  {contact?.entreprise && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--g600)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        marginTop: 1,
                      }}
                    >
                      {contact.entreprise}
                    </div>
                  )}
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: 4,
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: "var(--orange)",
                    }}
                  >
                    Espace Client
                  </span>
                </div>
              </div>

              {/* Menu items */}
              {[
                { href: "/espace-client/dashboard", icon: "🏠", label: "Tableau de bord" },
                { href: "/espace-client/profil",    icon: "👤", label: "Mon profil" },
                { href: "/espace-client/alertes",   icon: "🔔", label: "Mes alertes" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "11px 14px",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--navy)",
                    textDecoration: "none",
                    borderBottom: "1px solid var(--g50)",
                    transition: "background 0.1s",
                  }}
                >
                  <span style={{ fontSize: 15 }}>{item.icon}</span>
                  {item.label}
                </Link>
              ))}

              {/* Logout */}
              <button
                type="button"
                onClick={logout}
                style={{
                  display: "flex",
                  width: "100%",
                  alignItems: "center",
                  gap: 10,
                  padding: "11px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#7a1a24",
                  background: "none",
                  border: "none",
                  borderTop: "1px solid var(--g100)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.1s",
                }}
              >
                <span style={{ fontSize: 15 }}>🚪</span>
                Se déconnecter
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
