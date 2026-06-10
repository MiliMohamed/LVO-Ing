import { CrmTablePage } from "@/components/crm/CrmTablePage";
import type { OffreRow } from "@/lib/types";

export default function OffresPage() {
  return (
    <CrmTablePage<OffreRow>
      title="Offres"
      subtitle="Gestionnaire = syndic / prestataire / propriétaire (Phase 6) ; missions multiples ; échéancier mois AAAA-MM"
      path="/api/offres"
      columns={[
        { key: "numeroOffre", label: "N° offre" },
        { key: "statut", label: "Statut" },
        { key: "missionsLibelle", label: "Missions" },
        { key: "gestionnaireLibelle", label: "Gestionnaire" },
        { key: "missionsCount", label: "Missions" },
        { key: "montantHt", label: "Montant HT", preset: "moneyFr" },
        { key: "dateOffre", label: "Date" },
        { key: "clientNom", label: "Client" },
        { key: "siteNom", label: "Site" },
      ]}
      enableCrud={true}
      createSlug="offre"
    />
  );
}
