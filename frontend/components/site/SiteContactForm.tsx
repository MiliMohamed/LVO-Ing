"use client";

import { useState } from "react";

const MISSIONS = [
  "Audit & Diagnostic",
  "Mission Complète Neuf",
  "Mission Complète Modernisation",
  "Maintenance Management",
  "Étude de Trafic",
  "Mission Spéciale",
];

export function SiteContactForm() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      setSent(true);
    }, 900);
  }

  return (
    <div className="cf-box">
      <div className="cf-title">Envoyer un message</div>
      {sent ? (
        <p className="cf-success">
          Merci — votre message a bien été enregistré (démo front). Branchement API courrier à prévoir côté backend.
        </p>
      ) : (
        <form onSubmit={onSubmit}>
          <div className="cf-row">
            <div className="cf-fld">
              <label htmlFor="scf-nom">
                Nom <span className="cf-req">*</span>
              </label>
              <input id="scf-nom" name="nom" required placeholder="DUPONT" autoComplete="family-name" />
            </div>
            <div className="cf-fld">
              <label htmlFor="scf-prenom">Prénom</label>
              <input id="scf-prenom" name="prenom" placeholder="Jean" autoComplete="given-name" />
            </div>
          </div>
          <div className="cf-row">
            <div className="cf-fld">
              <label htmlFor="scf-email">
                Email <span className="cf-req">*</span>
              </label>
              <input id="scf-email" name="email" type="email" required placeholder="j.dupont@entreprise.fr" autoComplete="email" />
            </div>
            <div className="cf-fld">
              <label htmlFor="scf-tel">Téléphone</label>
              <input id="scf-tel" name="tel" type="tel" placeholder="+33 6 …" autoComplete="tel" />
            </div>
          </div>
          <div className="cf-fld">
            <label htmlFor="scf-societe">Entreprise</label>
            <input id="scf-societe" name="societe" placeholder="Nom de votre société" autoComplete="organization" />
          </div>
          <div className="cf-fld">
            <label htmlFor="scf-mission">
              Type de mission <span className="cf-req">*</span>
            </label>
            <select id="scf-mission" name="mission" required defaultValue="">
              <option value="">Sélectionner…</option>
              {MISSIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="cf-fld">
            <label htmlFor="scf-msg">
              Votre message <span className="cf-req">*</span>
            </label>
            <textarea id="scf-msg" name="msg" required placeholder="Décrivez votre projet…" />
          </div>
          <button className="cf-submit" type="submit" disabled={busy}>
            {busy ? "Envoi…" : "Envoyer le message →"}
          </button>
          <p className="cf-footnote">En soumettant ce formulaire, vous acceptez notre politique de confidentialité.</p>
        </form>
      )}
    </div>
  );
}
