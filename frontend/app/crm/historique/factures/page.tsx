import { CrmTablePage } from "@/components/crm/CrmTablePage";

export default function HistoriqueFacturesSupprimeesPage() {
  return (
    <CrmTablePage<Record<string, unknown>>
      title="Factures retirées"
      subtitle="Historique des suppressions (type FACTURE) — motif, montant, traçabilité"
      path="/api/historique/annulations/FACTURE"
      columns={[
        { key: "reference", label: "N° facture" },
        { key: "clientNom", label: "Client" },
        { key: "motif", label: "Motif" },
        { key: "montantHt", label: "Montant HT", preset: "moneyFr" },
        { key: "cancelledAt", label: "Supprimée le" },
      ]}
      createSlug="facture"
    />
  );
}
