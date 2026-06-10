"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { apiFetch } from "@/lib/api";
import { canAnonymizeRgpd, getCrmHomeHref, normalizeRole } from "@/lib/rbac";
import { readRole, readToken } from "@/lib/token-storage";

type PolicyRow = {
  domaine: string;
  dureeAns: number;
  baseLegale: string;
};

export default function RgpdPage() {
  const role = normalizeRole(readRole());
  const [email, setEmail] = useState("");
  const [contactId, setContactId] = useState("");
  const [policies, setPolicies] = useState<PolicyRow[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = (await apiFetch("/api/rgpd/politiques-retention", { token: readToken() })) as PolicyRow[] | null;
        setPolicies(Array.isArray(data) ? data : []);
      } catch {
        setPolicies([]);
      }
    })();
  }, []);

  async function runExport() {
    setMsg(null);
    try {
      const q = encodeURIComponent(email.trim());
      const data = (await apiFetch(`/api/rgpd/export?email=${q}`, { token: readToken() })) as { status?: string };
      setMsg(`Export demandé — statut : ${data?.status ?? "ok"}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function runAnonymize() {
    setMsg(null);
    const id = Number(contactId);
    if (!Number.isFinite(id)) {
      setMsg("Identifiant contact invalide.");
      return;
    }
    try {
      await apiFetch(`/api/rgpd/anonymize?contactId=${id}`, {
        token: readToken(),
        method: "POST",
      });
      setMsg(`Contact ${id} anonymisé (email & téléphones effacés).`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erreur");
    }
  }

  return (
    <>
      <header className="pg-hdr mb-4">
        <div>
          <h1>RGPD &amp; audit</h1>
          <p>
            Export des données, anonymisation contrôlée, politiques de rétention — réservé aux profils conformes à la
            matrice PDF v4.0.
          </p>
        </div>
        <Link href={getCrmHomeHref(role)} className="cbtn cbtn-ghost cbtn-sm">
          ← Accueil CRM
        </Link>
      </header>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <div className="fcard">
          <div className="fcard-body flex flex-col gap-3">
            <h2 className="text-sm font-bold text-[var(--navy)]">Export données (sujet)</h2>
            <label className="crm-field">
              <span className="crm-label">Email du contact</span>
              <input className="crm-input" type="email" placeholder="contact@exemple.fr" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <button type="button" className="cbtn cbtn-orange cbtn-sm" onClick={() => void runExport()}>
              Lancer export
            </button>
          </div>
        </div>

        <div className="fcard">
          <div className="fcard-body flex flex-col gap-3">
            <h2 className="text-sm font-bold text-[var(--navy)]">Anonymisation contact</h2>
            <p className="crm-hint">
              Opération sensible — <strong>Administrateur uniquement</strong> (API + futur journal d&apos;audit).
            </p>
            <label className="crm-field">
              <span className="crm-label">ID contact</span>
              <input
                className="crm-input"
                placeholder="Identifiant numérique"
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                disabled={!canAnonymizeRgpd(role)}
              />
            </label>
            <button
              type="button"
              className="cbtn cbtn-orange cbtn-sm"
              disabled={!canAnonymizeRgpd(role)}
              onClick={() => void runAnonymize()}
            >
              Anonymiser
            </button>
          </div>
        </div>
      </div>

      <div className="fcard">
        <div className="fcard-body">
          <h2 className="mb-3 text-sm font-bold text-[var(--navy)]">Politiques de rétention indicatives</h2>
          <div className="tw overflow-x-auto">
            <table className="ct">
              <thead>
                <tr>
                  <th>Domaine</th>
                  <th>Durée (ans)</th>
                  <th>Base légale</th>
                </tr>
              </thead>
              <tbody>
                {(policies ?? []).map((p, i) => (
                  <tr key={`${p.domaine}-${i}`}>
                    <td>{p.domaine}</td>
                    <td>{p.dureeAns}</td>
                    <td>{p.baseLegale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {policies === null ? <p className="fnote mt-2">Chargement…</p> : null}
        </div>
      </div>

      {msg ? <p className="fnote mt-4">{msg}</p> : null}
    </>
  );
}
