"use client";

import { CrmFormField, CrmFormSection } from "@/components/crm/ui";

const CIVILITES = [
  { label: "M.", value: "M." },
  { label: "Mme", value: "Mme" },
  { label: "Mlle", value: "Mlle" },
];

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
}>;

export function ContactFormFields({ idPrefix, values, onChange, fieldErrors }: Props) {
  const f = (key: keyof ContactFormValues) => `${idPrefix}-${key}`;

  return (
    <>
      <CrmFormSection
        title="Identité"
        description="Informations d'identification du contact au sein de l'entreprise."
      >
        <CrmFormField
          select
          label="Civilité"
          htmlFor={f("civilite")}
          value={values.civilite}
          options={CIVILITES}
          onChange={(civilite) => onChange({ civilite })}
        />
        <CrmFormField
          label="Prénom"
          htmlFor={f("prenom")}
          value={values.prenom}
          onChange={(prenom) => onChange({ prenom })}
          required
          error={fieldErrors?.prenom}
        />
        <CrmFormField
          label="Nom"
          htmlFor={f("nom")}
          value={values.nom}
          onChange={(nom) => onChange({ nom })}
          required
          error={fieldErrors?.nom}
        />
        <CrmFormField
          label="Fonction / Poste"
          htmlFor={f("fonction")}
          value={values.fonction}
          onChange={(fonction) => onChange({ fonction })}
          placeholder="Ex : Directeur technique, Gestionnaire…"
        />
        <CrmFormField
          label="Entreprise / Rattachement"
          htmlFor={f("entreprise")}
          value={values.entreprise}
          onChange={(entreprise) => onChange({ entreprise })}
          hint="Raison sociale ou groupe — détermine les sites et commandes associés au contact."
          className="col-span-2"
        />
      </CrmFormSection>

      <CrmFormSection
        title="Coordonnées"
        description="L'email sert d'identifiant de connexion à l'Espace Client."
      >
        <CrmFormField
          label="Email"
          htmlFor={f("email")}
          type="email"
          value={values.email}
          onChange={(email) => onChange({ email })}
          error={fieldErrors?.email}
          hint="Identifiant de connexion à l'Espace Client — un mot de passe provisoire sera généré automatiquement."
          className="col-span-2"
        />
        <CrmFormField
          label="Téléphone fixe"
          htmlFor={f("telephone")}
          type="tel"
          value={values.telephone}
          onChange={(telephone) => onChange({ telephone })}
          placeholder="+33 1 23 45 67 89"
        />
        <CrmFormField
          label="Mobile"
          htmlFor={f("mobile")}
          type="tel"
          value={values.mobile}
          onChange={(mobile) => onChange({ mobile })}
          placeholder="+33 6 12 34 56 78"
        />
      </CrmFormSection>
    </>
  );
}
