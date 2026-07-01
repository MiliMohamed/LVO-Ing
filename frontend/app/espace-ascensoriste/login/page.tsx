"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { LVO_LOGO_ALT, LVO_LOGO_SRC } from "@/lib/branding";
import { getApiBaseUrl } from "@/lib/config";
import { saveAscensoristeSession, type AscensoristeSession } from "@/lib/token-storage";

export default function EspaceAscensoristeLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/ascensoriste-auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const text = await res.text();
      if (!res.ok) {
        let msg = text || `${res.status}`;
        try { msg = (JSON.parse(text) as { error?: string }).error || msg; } catch { /* noop */ }
        throw new Error(msg);
      }
      const data = JSON.parse(text) as AscensoristeSession;
      saveAscensoristeSession(data);
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next?.startsWith("/espace-ascensoriste") ? next : "/espace-ascensoriste/devis");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la connexion");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-logo">
          <Image src={LVO_LOGO_SRC} alt={LVO_LOGO_ALT} width={52} height={52} className="object-contain" priority />
          <div className="login-logo-text">LVO Ingénierie</div>
        </div>
        <div className="login-subtitle">Espace Ascensoriste — Dépôt de vos devis</div>
        {error ? <div className="login-error">{error}</div> : null}
        <label className="login-label" htmlFor="email">Adresse email</label>
        <input
          id="email"
          name="email"
          className="login-input"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <label className="login-label" htmlFor="password">Mot de passe</label>
        <input
          id="password"
          name="password"
          className="login-input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className="login-btn" type="submit" disabled={busy}>
          {busy ? "Connexion…" : "Accéder à mon espace →"}
        </button>
        <Link href="/" className="login-back">← Retour au site LVO Ingénierie</Link>
        <div className="login-demo" style={{ marginTop: 16, fontSize: 12, color: "var(--smoke)" }}>
          Vos identifiants vous ont été communiqués par LVO Ingénierie.
        </div>
        <div style={{ marginTop: 10, textAlign: "center" }}>
          <Link href="/espace-client/login" style={{ fontSize: 12, color: "var(--navy)", textDecoration: "underline" }}>
            Vous êtes client ? Accéder à votre espace →
          </Link>
        </div>
      </form>
    </div>
  );
}
