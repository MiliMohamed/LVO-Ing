"use client";

import { useMemo, useState } from "react";

import { NewClientModal } from "@/components/crm/forms/NewClientModal";
import type { ClientRow } from "@/lib/types";

export type ContactFormValues = {
  civilite: string;
  prenom: string;
  nom: string;
  entreprise: string;
  fonction: string;
  email: string;
  telephone: string;
  mobile: string;
};

type Props = Readonly<{
  idPrefix: string;
  values: ContactFormValues;
  onChange: (patch: Partial<ContactFormValues>) => void;
  fieldErrors?: Partial<Record<keyof ContactFormValues, string>>;
  clients: ClientRow[];
  onClientCreated: (client: ClientRow) => void;
}>;

export function ContactFormFields({ idPrefix, values, onChange, fieldErrors, clients, onClientCreated }: Props) {
  const f = (key: keyof ContactFormValues) => `${idPrefix}-${key}`;
  const [newClientOpen, setNewClientOpen] = useState(false);

  const clientOptions = useMemo(
    () => [...clients].sort((a, b) => a.raisonSociale.localeCompare(b.raisonSociale, "fr")),
    [clients],
  );

  return (
    <>
      <div className="crm-stack crm-span-2">
        <p className="crm-stack-title">
          <span className="crm-stack-title__icon" aria-hidden>◇</span> Identité
        </p>
        <div className="crm-form-grid crm-form-grid--tight">
          <label className="crm-field">
            <span className="crm-label">Civilité</span>
            <select
              id={f("civilite")}
              className="crm-select"
              value={values.civilite}
              onChange={(e) => onChange({ civilite: e.target.value })}
            >
              <option value="M.">M.</option>
              <option value="Mme">Mme</option>
              <option value="Mlle">Mlle</option>
            </select>
          </label>
          <label className="crm-field">
            <span className="crm-label">
              Prénom <span className="crm-req">*</span>
            </span>
            <input
              id={f("prenom")}
              className="crm-input"
              value={values.prenom}
              onChange={(e) => onChange({ prenom: e.target.value })}
            />
            {fieldErrors?.prenom ? <p className="crm-hint" style={{ color: "var(--orange)" }}>{fieldErrors.prenom}</p> : null}
          </label>
          <label className="crm-field">
            <span className="crm-label">
              Nom <span className="crm-req">*</span>
            </span>
            <input
              id={f("nom")}
              className="crm-input"
              value={values.nom}
              onChange={(e) => onChange({ nom: e.target.value })}
            />
            {fieldErrors?.nom ? <p className="crm-hint" style={{ color: "var(--orange)" }}>{fieldErrors.nom}</p> : null}
          </label>
          <label className="crm-field">
            <span className="crm-label">Fonction / Poste</span>
            <input
              id={f("fonction")}
              className="crm-input"
              value={values.fonction}
              onChange={(e) => onChange({ fonction: e.target.value })}
              placeholder="Ex : Directeur technique, Gestionnaire…"
            />
          </label>
          <div className="crm-field crm-span-2">
            <label htmlFor={f("entreprise")} className="crm-label">
              Client <span className="crm-req">*</span>
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <select
                id={f("entreprise")}
                className="crm-select"
                style={{ flex: 1 }}
                value={values.entreprise}
                onChange={(e) => onChange({ entreprise: e.target.value })}
              >
                <option value="">Choisir un client…</option>
                {clientOptions.map((c) => (
                  <option key={c.id} value={c.raisonSociale}>
                    {c.raisonSociale}
                  </option>
                ))}
              </select>
              <button type="button" className="cbtn cbtn-ghost cbtn-sm" onClick={() => setNewClientOpen(true)}>
                + Nouveau client
              </button>
            </div>
            <p className="crm-hint">Client auquel ce contact est rattaché.</p>
            {fieldErrors?.entreprise ? (
              <p className="crm-hint" style={{ color: "var(--orange)" }}>{fieldErrors.entreprise}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="crm-stack crm-span-2">
        <p className="crm-stack-title">
          <span className="crm-stack-title__icon" aria-hidden>@</span> Coordonnées
        </p>
        <div className="crm-form-grid crm-form-grid--tight">
          <label className="crm-field crm-span-2">
            <span className="crm-label">Email</span>
            <input
              id={f("email")}
              className="crm-input"
              type="email"
              value={values.email}
              onChange={(e) => onChange({ email: e.target.value })}
            />
            <p className="crm-hint">
              Identifiant de connexion à l&apos;Espace Client — un mot de passe provisoire sera généré automatiquement.
            </p>
            {fieldErrors?.email ? <p className="crm-hint" style={{ color: "var(--orange)" }}>{fieldErrors.email}</p> : null}
          </label>
          <label className="crm-field">
            <span className="crm-label">Téléphone fixe</span>
            <input
              id={f("telephone")}
              className="crm-input"
              type="tel"
              value={values.telephone}
              onChange={(e) => onChange({ telephone: e.target.value })}
              placeholder="+33 1 23 45 67 89"
            />
          </label>
          <label className="crm-field">
            <span className="crm-label">Mobile</span>
            <input
              id={f("mobile")}
              className="crm-input"
              type="tel"
              value={values.mobile}
              onChange={(e) => onChange({ mobile: e.target.value })}
              placeholder="+33 6 12 34 56 78"
            />
          </label>
        </div>
      </div>

      <NewClientModal
        open={newClientOpen}
        onClose={() => setNewClientOpen(false)}
        onCreated={(client) => {
          onClientCreated(client);
          onChange({ entreprise: client.raisonSociale });
          setNewClientOpen(false);
        }}
      />
    </>
  );
}
