"use client";

import { useState } from "react";
import { getApiBaseUrl } from "@/lib/config";
import { readClientToken, readClientContact, saveClientAccessToken, readClientRefreshToken } from "@/lib/token-storage";

export default function ClientProfilPage() {
  const contact = readClientContact();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOk(null);
    setErr(null);
    if (next !== confirm) {
      setErr("Les deux nouveaux mots de passe ne correspondent pas.");
      return;
    }
    if (next.length < 8) {
      setErr("Le nouveau mot de passe doit faire au moins 8 caractères.");
      return;
    }
    setBusy(true);
    try {
      const token = readClientToken();
      const refreshToken = readClientRefreshToken();
      const base = getApiBaseUrl();
      let res = await fetch(`${base}/api/client/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, Accept: "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (res.status === 401 && refreshToken) {
        const r = await fetch(`${base}/api/client-auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (r.ok) {
          const fresh = await r.json() as { token: string; refreshToken: string };
          saveClientAccessToken(fresh.token, fresh.refreshToken);
          res = await fetch(`${base}/api/client/change-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${fresh.token}`, Accept: "application/json" },
            body: JSON.stringify({ currentPassword: current, newPassword: next }),
          });
        }
      }
      const text = await res.text();
      if (!res.ok) {
        let msg = text;
        try { msg = (JSON.parse(text) as { error?: string }).error || msg; } catch { /* noop */ }
        throw new Error(msg);
      }
      setOk("Mot de passe modifié avec succès.");
      setCurrent(""); setNext(""); setConfirm("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur lors de la modification.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--navy)", marginBottom: 24 }}>Mon profil</h1>

      {/* Infos contact */}
      <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", marginBottom: 16, textTransform: "uppercase", letterSpacing: 1 }}>
          Informations
        </h2>
        <div style={{ display: "grid", gap: 10 }}>
          {[
            ["Nom", contact ? `${contact.prenom} ${contact.nom}` : "—"],
            ["Entreprise", contact?.entreprise || "—"],
          ].map(([label, value]) => (
            <div key={label} style={{ display: "flex", gap: 12, fontSize: 14 }}>
              <span style={{ color: "var(--smoke)", minWidth: 100 }}>{label}</span>
              <span style={{ fontWeight: 600, color: "var(--navy)" }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Changement de mot de passe */}
      <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, padding: 24 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", marginBottom: 16, textTransform: "uppercase", letterSpacing: 1 }}>
          Changer mon mot de passe
        </h2>
        {ok && (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", color: "#15803d", marginBottom: 16, fontSize: 13 }}>
            {ok}
          </div>
        )}
        {err && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", color: "#dc2626", marginBottom: 16, fontSize: 13 }}>
            {err}
          </div>
        )}
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Mot de passe actuel" id="current" type="password" value={current} onChange={setCurrent} autoComplete="current-password" />
          <Field label="Nouveau mot de passe" id="next" type="password" value={next} onChange={setNext} autoComplete="new-password" />
          <Field label="Confirmer le nouveau mot de passe" id="confirm" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
          <button
            type="submit"
            disabled={busy}
            style={{ background: "var(--orange)", color: "#fff", border: "none", borderRadius: 10, padding: "12px 24px", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: busy ? 0.7 : 1, alignSelf: "flex-start" }}
          >
            {busy ? "Enregistrement…" : "Enregistrer le nouveau mot de passe"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, id, type, value, onChange, autoComplete }: Readonly<{
  label: string; id: string; type: string; value: string;
  onChange: (v: string) => void; autoComplete?: string;
}>) {
  return (
    <div>
      <label htmlFor={id} style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--smoke)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required
        style={{ width: "100%", background: "var(--g50)", border: "1px solid var(--g200)", borderRadius: 8, padding: "10px 14px", fontSize: 14, color: "var(--navy)", outline: "none" }}
      />
    </div>
  );
}
