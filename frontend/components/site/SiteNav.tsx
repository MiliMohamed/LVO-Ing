"use client";

import Image from "next/image";
import Link from "next/link";

import { LVO_LOGO_ALT, LVO_LOGO_SRC } from "@/lib/branding";
import { useEffect, useState } from "react";

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <nav id="site-nav" className={scrolled ? "scrolled" : ""}>
      <Link href="/" className="nav-logo">
        <Image src={LVO_LOGO_SRC} alt={LVO_LOGO_ALT} width={40} height={40} className="object-contain" priority />
        LVO Ingénierie
      </Link>
      <div className={`nav-links${menuOpen ? " nav-open" : ""}`}>
        <a href="#services" onClick={closeMenu}>Services</a>
        <a href="#phases" onClick={closeMenu}>Phases</a>
        <a href="#references" onClick={closeMenu}>Références</a>
        <a href="#equipe" onClick={closeMenu}>Équipe</a>
        <a href="#stats" onClick={closeMenu}>Indicateurs</a>
        <a href="#contact" onClick={closeMenu}>Contact</a>
      </div>
      <div className="nav-right">
        <Link href="/espace-client/login" className="nav-client">
          <span className="nav-crm-dot" aria-hidden />{" "}Espace Client
        </Link>
        <Link href="/espace-ascensoriste/login" className="nav-client">
          <span className="nav-crm-dot" aria-hidden />{" "}Espace Ascensoriste
        </Link>
        <Link href="/login" className="nav-crm">
          <span className="nav-crm-dot" aria-hidden />{" "}Espace CRM
        </Link>
        <a href="#contact" className="nav-cta">
          Nous contacter →
        </a>
        <button
          type="button"
          className="nav-hamburger"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>
    </nav>
  );
}
