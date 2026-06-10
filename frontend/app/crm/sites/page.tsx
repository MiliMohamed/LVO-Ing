import { CrmTablePage } from "@/components/crm/CrmTablePage";
import type { SiteRow } from "@/lib/types";

export default function SitesPage() {
  return (
    <CrmTablePage<SiteRow>
      title="Sites"
      subtitle="Fiche site, gestionnaires (Phase 6) et registre équipements (ascenseurs, monte-charges)"
      path="/api/sites"
      phase5EntityMode="site"
      phase6SiteGestionnaireFilter
      columns={[
        { key: "nom", label: "Site" },
        { key: "typeSite", label: "Type" },
        { key: "clientNom", label: "Propriétaire" },
        { key: "gestionnairePrincipal", label: "Gestionn. principal" },
        { key: "equipementsCount", label: "Équipements" },
      ]}
      enableCrud={true}
      createSlug="site"
    />
  );
}
