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
        { key: "siret", label: "SIRET" },
        { key: "telephone", label: "Tél." },
        { key: "email", label: "Email" },
        { key: "responsableEmail", label: "Responsable" },
        { key: "createdAtIso", label: "Créé le" },
      ]}
      enableCrud={true}
      createSlug="client"
    />
  );
}
