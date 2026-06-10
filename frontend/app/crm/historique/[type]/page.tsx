import { CrmTablePage } from "@/components/crm/CrmTablePage";
import { notFound } from "next/navigation";

export default async function HistoriquePage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (type !== "offres" && type !== "commandes") notFound();

  const titre = type === "offres" ? "Offres annulées" : "Commandes annulées";
  const entityType = type === "offres" ? "OFFRE" : "COMMANDE";

  return (
    <CrmTablePage<Record<string, unknown>>
      title={titre}
      subtitle="Historique des annulations et relance via duplication"
      path={`/api/historique/annulations/${entityType}`}
      columns={[
        { key: "reference", label: "Référence" },
        { key: "clientNom", label: "Client" },
        { key: "motif", label: "Motif" },
        { key: "montantHt", label: "Montant HT", preset: "moneyFr" },
        { key: "cancelledAt", label: "Annulée le" },
      ]}
      createSlug={type === "offres" ? "offre" : "commande"}
    />
  );
}
