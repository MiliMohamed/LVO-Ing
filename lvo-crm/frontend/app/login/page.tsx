"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { LVO_LOGO_ALT, LVO_LOGO_SRC } from "@/lib/branding";
import type { LoginResponse } from "@/lib/types";
import { getApiBaseUrl } from "@/lib/config";
import { evaluateCrmRoute } from "@/lib/crm-route-access";
import { getCrmHomeHref, normalizeRole } from "@/lib/rbac";
import { saveSession } from "@/lib/token-storage";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@lvo-ing.fr");
  const [password, setPassword] = useState("lvo123");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const url = `${getApiBaseUrl()}/api/auth/login`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || `${res.status}`);
      }
      const data = JSON.parse(text) as LoginResponse;
      saveSession(data.token, data.refreshToken, data.email, data.role);
      const role = normalizeRole(data.role);
      const next =
        typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") : null;
      const fallback = getCrmHomeHref(role);
      let dest = fallback;
      if (next?.startsWith("/crm")) {
        const check = evaluateCrmRoute(next, data.role);
        dest = check.decision === "allow" ? next : check.decision === "redirect" ? check.href : fallback;
      }
      router.replace(dest);
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
        <div className="login-subtitle">Accès à l&apos;espace CRM — Collaborateurs</div>
        {error ? <div className="login-error">{error}</div> : null}
        <label className="login-label" htmlFor="email">
          Adresse email
        </label>
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
        <label className="login-label" htmlFor="password">
          Mot de passe
        </label>
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
          {busy ? "Connexion…" : "Accéder au CRM →"}
        </button>
        <Link href="/" className="login-back">
          ← Retour au site LVO Ingénierie
        </Link>
        <div className="login-demo">
          <strong>Comptes démo</strong> (mot de passe <code style={{ fontSize: 11 }}>lvo123</code>) :{" "}
          <code style={{ fontSize: 11 }}>admin@lvo-ing.fr</code> (Dashboard KPI),{" "}
          <code style={{ fontSize: 11 }}>manager@lvo-ing.fr</code>,{" "}
          <code style={{ fontSize: 11 }}>consultant@lvo-ing.fr</code>,{" "}
          <code style={{ fontSize: 11 }}>viewer@lvo-ing.fr</code> (accueil CRM sans KPI globaux).
        </div>
      </form>
    </div>
  );
}
