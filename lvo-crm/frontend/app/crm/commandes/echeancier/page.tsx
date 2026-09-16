import { PaiementEcheancierGantt } from "@/components/crm/PaiementEcheancierGantt";

export default function EcheancierPaiementPage() {
  return (
    <>
      <header className="pg-hdr mb-4">
        <h1>Échéancier de paiement</h1>
        <p>
          Vue Gantt des échéances de paiement de toutes les commandes — cliquez sur un mois pour voir le détail de
          trésorerie.
        </p>
      </header>

      <PaiementEcheancierGantt />
    </>
  );
}
