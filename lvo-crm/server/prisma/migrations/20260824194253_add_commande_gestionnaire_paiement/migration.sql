-- AlterTable
ALTER TABLE "commandes" ADD COLUMN     "gestionnaire_nom" VARCHAR(200),
ADD COLUMN     "gestionnaire_contact" VARCHAR(300),
ADD COLUMN     "mode_paiement_commande" VARCHAR(20),
ADD COLUMN     "echeancier_paiement_json" TEXT;
