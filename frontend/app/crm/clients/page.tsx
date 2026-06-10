import { CrmTablePage } from "@/components/crm/CrmTablePage";
import type { ClientRow } from "@/lib/types";

export default function ClientsPage() {
  return (
    <CrmTablePage<ClientRow>
      title="Clients"
      subtitle="Phase 5 — fiche, SIRET audité ; suppression client réservée ADMIN si aucune donnée liée"
      path="/api/clients"
      phase5EntityMode="client"
      columns={[
        { key: "raisonSociale", label: "Raison sociale" },
        { key: "entite", label: "Entité" },
        { key: "responsableEmail", label: "Responsable" },
        { key: "siret", label: "SIRET" },
        { key: "email", label: "Email" },
        { key: "telephone", label: "Tél." },
        { key: "createdAtIso", label: "Créé le" },
      ]}
      enableCrud={true}
      createSlug="client"
    />
  );
}
