"use client";

import { useEffect, useId, useState } from "react";

import { apiFetch } from "@/lib/api";
import { readToken } from "@/lib/token-storage";
import type { ClientRow } from "@/lib/types";
import { CrmEntityModal } from "@/components/crm/ui";

function isValidEmail(v: string) {
  if (!v.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

type Props = Readonly<{
  open: boolean;
  prefillRaisonSociale?: string;
  onClose: () => void;
  onCreated: (client: ClientRow) => void;
}>;

export function NewClientModal({ open, prefillRaisonSociale, onClose, onCreated }: Props) {
  const fid = useId();
  const [raisonSociale, setRaisonSociale] = useState("");
  const [entite, setEntite] = useState("");
  const [siret, setSiret] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [responsableEmail, setResponsableEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRaisonSociale(prefillRaisonSociale ?? "");
    setEntite("");
    setSiret("");
    setTelephone("");
    setEmail("");
    setResponsableEmail("");
    setError(null);
  }, [open, prefillRaisonSociale]);

  if (!open) return null;

  function validate(): string | null {
    if (!raisonSociale.trim()) return "Raison sociale obligatoire.";
    if (!isValidEmail(email)) return "Email invalide.";
    if (!isValidEmail(responsableEmail)) return "Email du responsable invalide.";
    return null;
  }

  async function submit() {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const result = (await apiFetch("/api/clients", {
        token: readToken(),
        method: "POST",
        body: JSON.stringify({
          raisonSociale: raisonSociale.trim(),
          entite: entite.trim(),
          siret: siret.trim(),
          telephone: telephone.trim(),
          email: email.trim(),
          responsableEmail: responsableEmail.trim(),
        }),
      })) as { id: number } | null;
      if (!result?.id) throw new Error("Réponse serveur invalide.");
      const client: ClientRow = {
        id: result.id,
        raisonSociale: raisonSociale.trim(),
        entite: entite.trim(),
        siret: siret.trim() || null,
        telephone: telephone.trim(),
        email: email.trim(),
        responsableEmail: responsableEmail.trim() || null,
        createdAtIso: new Date().toISOString(),
      };
      onCreated(client);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la création du client.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <CrmEntityModal
      open={open}
      onClose={onClose}
      title="Nouveau client"
      subtitle="Créer une fiche client exploitable pour les offres et commandes."
      size="md"
      zIndex={1100}
      error={error}
      footer={
        <>
          <button type="button" className="cbtn cbtn-ghost" disabled={saving} onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="cbtn cbtn-orange" disabled={saving} onClick={() => void submit()}>
            {saving ? "Création…" : "Créer le client"}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div className="crm-stack">
          <p className="crm-stack-title">
            <span className="crm-stack-title__icon" aria-hidden>◎</span> Identité
          </p>
          <div className="crm-form-grid crm-form-grid--tight">
            <label className="crm-field crm-span-2">
              <span className="crm-label">
                Raison sociale <span className="crm-req">*</span>
              </span>
              <input
                id={`${fid}-raisonSociale`}
                className="crm-input"
                value={raisonSociale}
                onChange={(e) => setRaisonSociale(e.target.value)}
                placeholder="Société anonyme…"
                autoComplete="organization"
                autoFocus
              />
            </label>
            <label className="crm-field">
              <span className="crm-label">Entité / département</span>
              <input
                id={`${fid}-entite`}
                className="crm-input"
                value={entite}
                onChange={(e) => setEntite(e.target.value)}
                placeholder="Siège, agence…"
              />
            </label>
            <label className="crm-field">
              <span className="crm-label">
                SIRET <span className="crm-opt">(optionnel)</span>
              </span>
              <input
                id={`${fid}-siret`}
                className="crm-input"
                value={siret}
                onChange={(e) => setSiret(e.target.value)}
                placeholder="14 chiffres"
                inputMode="numeric"
              />
            </label>
          </div>
        </div>
        <div className="crm-stack">
          <p className="crm-stack-title">
            <span className="crm-stack-title__icon" aria-hidden>@</span> Coordonnées
          </p>
          <div className="crm-form-grid crm-form-grid--tight">
            <label className="crm-field">
              <span className="crm-label">Téléphone</span>
              <input
                id={`${fid}-telephone`}
                className="crm-input"
                type="tel"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="+33 …"
              />
            </label>
            <label className="crm-field">
              <span className="crm-label">Email</span>
              <input
                id={`${fid}-email`}
                className="crm-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@entreprise.fr"
              />
            </label>
            <label className="crm-field crm-span-2">
              <span className="crm-label">Responsable client</span>
              <input
                id={`${fid}-responsableEmail`}
                className="crm-input"
                type="email"
                value={responsableEmail}
                onChange={(e) => setResponsableEmail(e.target.value)}
                placeholder="contact.technique@client.fr"
              />
              <p className="crm-hint">
                Référent côté client pour le suivi des étapes (distinct de l&apos;email société).
              </p>
            </label>
          </div>
        </div>
      </div>
    </CrmEntityModal>
  );
}
