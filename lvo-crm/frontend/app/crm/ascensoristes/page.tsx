"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { readToken } from "@/lib/token-storage";

type Ascensoriste = {
  id: number;
  entreprise: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  statut: "ACTIF" | "ARCHIVE";
  hasPassword: boolean;
};

export default function AscensoristesPage() {
  const [list, setList] = useState<Ascensoriste[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [entreprise, setEntreprise] = useState("");
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState<{ entreprise: string; password: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<Ascensoriste[]>("/api/ascensoristes", { token: readToken() });
      setList(Array.isArray(data) ? data : []);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function create() {
    if (!entreprise.trim() || !nom.trim() || !email.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch<{ id: number; defaultPassword: string }>("/api/ascensoristes", {
        token: readToken(),
        method: "POST",
        body: JSON.stringify({ entreprise: entreprise.trim(), nom: nom.trim(), prenom: prenom.trim(), email: email.trim(), telephone: telephone.trim() || undefined }),
      });
      setGeneratedPassword({ entreprise: entreprise.trim(), password: res?.defaultPassword ?? "" });
      setEntreprise(""); setNom(""); setPrenom(""); setEmail(""); setTelephone("");
      setShowForm(false);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(a: Ascensoriste) {
    if (!confirm(`Réinitialiser le mot de passe de ${a.entreprise} ?`)) return;
    try {
      const res = await apiFetch<{ newPassword: string }>(`/api/ascensoristes/${a.id}/reset-password`, { token: readToken(), method: "POST" });
      setGeneratedPassword({ entreprise: a.entreprise, password: res?.newPassword ?? "" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur lors de la réinitialisation");
    }
  }

  async function remove(a: Ascensoriste) {
    if (!confirm(`Supprimer le compte ascensoriste ${a.entreprise} ? Les devis déjà déposés sont conservés.`)) return;
    try {
      await apiFetch(`/api/ascensoristes/${a.id}`, { token: readToken(), method: "DELETE" });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur lors de la suppression");
    }
  }

  return (
    <div>
      <header className="pg-hdr mb-4" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1>Ascensoristes</h1>
          <p>Comptes prestataires habilités à déposer des devis via l&apos;espace ascensoriste.</p>
        </div>
        <button type="button" className="cbtn cbtn-orange cbtn-sm" onClick={() => setShowForm((v) => !v)}>
          + Créer un ascensoriste
        </button>
      </header>

      {err && <p className="crm-alert crm-alert--error mb-3">{err}</p>}

      {generatedPassword && (
        <div className="crm-alert mb-3" style={{ background: "#f0fdf4", border: "1px solid #86efac", color: "#14532d" }}>
          Mot de passe pour <strong>{generatedPassword.entreprise}</strong> : <code>{generatedPassword.password}</code>
          {" "}— communiquez-le maintenant, il ne sera plus affiché.
          <button type="button" onClick={() => setGeneratedPassword(null)} style={{ marginLeft: 12, border: "none", background: "none", cursor: "pointer", color: "#14532d", fontWeight: 700 }}>
            ✕
          </button>
        </div>
      )}

      {showForm && (
        <div className="fcard mb-4">
          <div className="fcard-body">
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)", marginBottom: 14 }}>Nouvel ascensoriste</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <label className="crm-field">
                <span className="crm-label">Entreprise *</span>
                <input className="crm-input" value={entreprise} onChange={(e) => setEntreprise(e.target.value)} placeholder="OTIS, CEGELEC, SCHINDLER…" />
              </label>
              <label className="crm-field">
                <span className="crm-label">Nom *</span>
                <input className="crm-input" value={nom} onChange={(e) => setNom(e.target.value)} />
              </label>
              <label className="crm-field">
                <span className="crm-label">Prénom</span>
                <input className="crm-input" value={prenom} onChange={(e) => setPrenom(e.target.value)} />
              </label>
              <label className="crm-field">
                <span className="crm-label">Email *</span>
                <input className="crm-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="crm-field">
                <span className="crm-label">Téléphone</span>
                <input className="crm-input" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
              </label>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="cbtn cbtn-orange cbtn-sm" onClick={() => void create()} disabled={!entreprise.trim() || !nom.trim() || !email.trim() || saving}>
                {saving ? "Création…" : "Créer"}
              </button>
              <button type="button" className="cbtn cbtn-sm" onClick={() => setShowForm(false)}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--g500)", fontSize: 13, padding: 16 }}>Chargement…</p>
      ) : list.length === 0 ? (
        <div className="fcard">
          <div className="fcard-body" style={{ textAlign: "center", padding: "40px 0", color: "var(--g500)", fontSize: 13 }}>
            Aucun ascensoriste enregistré.
          </div>
        </div>
      ) : (
        <div style={{ border: "1px solid var(--g200)", borderRadius: 10, overflow: "hidden" }}>
          {list.map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 16px", borderBottom: "1px solid var(--g100)", background: "#fff" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--navy)" }}>{a.entreprise}</div>
                <div style={{ fontSize: 12, color: "var(--g500)" }}>{a.prenom} {a.nom} — {a.email}{a.telephone ? ` — ${a.telephone}` : ""}</div>
              </div>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, border: `1px solid ${a.hasPassword ? "#86efac" : "#fca5a5"}`, background: a.hasPassword ? "#f0fdf4" : "#fef2f2", color: a.hasPassword ? "#166534" : "#b91c1c", fontWeight: 600 }}>
                {a.hasPassword ? "Accès actif" : "Sans accès"}
              </span>
              <button type="button" className="cbtn cbtn-sm" onClick={() => void resetPassword(a)}>Réinitialiser le mot de passe</button>
              <button type="button" className="cbtn cbtn-sm" onClick={() => void remove(a)} style={{ color: "#b91c1c" }}>Supprimer</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
