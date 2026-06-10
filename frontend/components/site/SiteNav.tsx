"use client";

import Image from "next/image";
import Link from "next/link";

import { LVO_LOGO_ALT, LVO_LOGO_SRC } from "@/lib/branding";
import { useEffect, useState } from "react";

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav id="site-nav" className={scrolled ? "scrolled" : ""}>
      <Link href="/" className="nav-logo">
        <Image src={LVO_LOGO_SRC} alt={LVO_LOGO_ALT} width={40} height={40} className="object-contain" priority />
        LVO Ingénierie
      </Link>
      <div className="nav-links">
        <a href="#services">Services</a>
        <a href="#phases">Phases</a>
        <a href="#references">Références</a>
        <a href="#equipe">Équipe</a>
        <a href="#stats">Indicateurs</a>
        <a href="#contact">Contact</a>
      </div>
      <div className="nav-right">
        <Link href="/login" className="nav-crm">
          <span className="nav-crm-dot" aria-hidden />
          Espace CRM
        </Link>
        <a href="#contact" className="nav-cta">
          Nous contacter →
        </a>
      </div>
    </nav>
  );
}
