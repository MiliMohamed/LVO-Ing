import { CrmTablePage } from "@/components/crm/CrmTablePage";
import type { CommandeRow } from "@/lib/types";

export default function CommandesPage() {
  return (
    <CrmTablePage<CommandeRow>
      title="Commandes"
      subtitle="GET /api/commandes — format ref. YYYY-LVO-TYPE-nnn (Phase 1 / R4)"
      path="/api/commandes"
      columns={[
        { key: "numeroCommande", label: "N° commande" },
        { key: "dateCommande", label: "Date" },
        { key: "missionsLibelle", label: "Missions" },
        { key: "statut", label: "Statut" },
        { key: "montantHt", label: "Montant HT", preset: "moneyFr" },
        { key: "montantFacture", label: "Montant facturé", preset: "moneyFr" },
        { key: "clientNom", label: "Client" },
        { key: "siteNom", label: "Site" },
      ]}
      enableCrud={true}
      phase4CancelCommandes
      createSlug="commande"
    />
  );
}
