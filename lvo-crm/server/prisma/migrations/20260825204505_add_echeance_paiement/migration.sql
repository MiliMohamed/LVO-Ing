-- CreateEnum
CREATE TYPE "StatutEcheancePaiement" AS ENUM ('A_VENIR', 'FACTUREE', 'PAYEE', 'ANNULEE');

-- CreateTable
CREATE TABLE "echeances_paiement" (
    "id" UUID NOT NULL,
    "legacy_id" INTEGER,
    "commande_id" UUID NOT NULL,
    "ordre" INTEGER NOT NULL,
    "libelle" VARCHAR(200) NOT NULL,
    "pourcentage" DECIMAL(5,2),
    "montant_ht" DECIMAL(12,2) NOT NULL,
    "date_echeance" DATE NOT NULL,
    "statut" "StatutEcheancePaiement" NOT NULL DEFAULT 'A_VENIR',
    "facture_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "echeances_paiement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "echeances_paiement_legacy_id_key" ON "echeances_paiement"("legacy_id");

-- CreateIndex
CREATE INDEX "idx_echeances_paiement_commande" ON "echeances_paiement"("commande_id");

-- AddForeignKey
ALTER TABLE "echeances_paiement" ADD CONSTRAINT "echeances_paiement_commande_id_fkey" FOREIGN KEY ("commande_id") REFERENCES "commandes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "echeances_paiement" ADD CONSTRAINT "echeances_paiement_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "factures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
