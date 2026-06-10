import { CrmTablePage } from "@/components/crm/CrmTablePage";
import type { ContactRow } from "@/lib/types";

export default function ContactsPage() {
  return (
    <CrmTablePage<ContactRow>
      title="Contacts"
      subtitle="Phase 5 — fiche (PATCH), suppression si aucune commande liée au rattachement entreprise"
      path="/api/contacts"
      phase5EntityMode="contact"
      columns={[
        { key: "entreprise", label: "Entreprise" },
        { key: "civilite", label: "Civ." },
        { key: "prenom", label: "Prénom" },
        { key: "nom", label: "Nom" },
        { key: "fonction", label: "Fonction" },
        { key: "email", label: "Email" },
        { key: "telephone", label: "Tél." },
        { key: "mobile", label: "Mobile" },
      ]}
      enableCrud={true}
      createSlug="contact"
    />
  );
}
