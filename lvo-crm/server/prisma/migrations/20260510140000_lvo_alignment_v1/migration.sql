-- CreateEnum
CREATE TYPE "reference_entity_type" AS ENUM ('OFFRE', 'COMMANDE', 'FACTURE');

-- CreateEnum
CREATE TYPE "statut_paiement_facture" AS ENUM ('NON_PAYE', 'PARTIELLEMENT_PAYE', 'PAYE', 'EN_RETARD');

-- CreateEnum
CREATE TYPE "paiement_source" AS ENUM ('QUONTO_AUTO', 'MANUEL', 'IMPORT_CSV');

-- CreateEnum
CREATE TYPE "relance_niveau" AS ENUM ('RAPPEL', 'PREMIERE_RELANCE', 'DEUXIEME_RELANCE', 'MISE_EN_DEMEURE');

-- CreateEnum
CREATE TYPE "relance_canal" AS ENUM ('EMAIL', 'COURRIER', 'TELEPHONE');

-- CreateEnum
CREATE TYPE "contact_client_statut" AS ENUM ('ACTIF', 'ANNULE', 'ARCHIVE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CONSULTANT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "raison_sociale" TEXT NOT NULL,
    "entite" TEXT,
    "email" TEXT,
    "telephone" TEXT,
    "statut" "contact_client_statut" NOT NULL DEFAULT 'ACTIF',
    "cancelled_at" TIMESTAMPTZ(6),
    "cancelled_by" UUID,
    "cancellation_reason" VARCHAR(200),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "civilite" VARCHAR(10),
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "entreprise" TEXT,
    "fonction" TEXT,
    "email" TEXT,
    "telephone" TEXT,
    "mobile" TEXT,
    "statut" "contact_client_statut" NOT NULL DEFAULT 'ACTIF',
    "cancelled_at" TIMESTAMPTZ(6),
    "cancelled_by" UUID,
    "cancellation_reason" VARCHAR(200),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "type_site" TEXT,
    "adresse" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offres" (
    "id" UUID NOT NULL,
    "numero_offre" VARCHAR(50) NOT NULL,
    "type_mission" VARCHAR(10) NOT NULL,
    "statut" VARCHAR(30) NOT NULL,
    "montant_ht" DECIMAL(12,2) NOT NULL,
    "date_offre" DATE,
    "client_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "legacy_reference" VARCHAR(50),
    "echeancier_facturation_json" JSONB,
    "echeancier_execution_json" JSONB,
    "consultant_par_defaut_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commandes" (
    "id" UUID NOT NULL,
    "numero_commande" VARCHAR(50) NOT NULL,
    "date_commande" DATE,
    "type_mission" VARCHAR(10) NOT NULL,
    "montant_ht" DECIMAL(12,2) NOT NULL,
    "montant_facture" DECIMAL(12,2) NOT NULL,
    "client_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "offre_id" UUID,
    "legacy_reference" VARCHAR(50),
    "numero_client" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commandes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factures" (
    "id" UUID NOT NULL,
    "numero_facture" VARCHAR(50) NOT NULL,
    "commande_id" UUID NOT NULL,
    "date_facture" DATE,
    "date_echeance" DATE,
    "montant_ht" DECIMAL(12,2) NOT NULL,
    "frais" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "mode_reglement" VARCHAR(30) NOT NULL,
    "numero_commande_client" VARCHAR(100),
    "statut_paiement" "statut_paiement_facture" NOT NULL DEFAULT 'NON_PAYE',
    "montant_paye" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "derniere_relance_at" TIMESTAMPTZ(6),
    "niveau_relance" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "factures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phases_offre" (
    "id" UUID NOT NULL,
    "offre_id" UUID NOT NULL,
    "code_phase" VARCHAR(20) NOT NULL,
    "libelle" VARCHAR(200),
    "montant_ht" DECIMAL(12,2),
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "est_inclus" BOOLEAN NOT NULL DEFAULT true,
    "commentaire_phase" TEXT,

    CONSTRAINT "phases_offre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fichiers" (
    "id" UUID NOT NULL,
    "offre_id" UUID,
    "chemin" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fichiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reference_counters" (
    "id" UUID NOT NULL,
    "entity_type" "reference_entity_type" NOT NULL,
    "year" INTEGER NOT NULL,
    "type_mission" VARCHAR(10) NOT NULL DEFAULT '',
    "last_value" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reference_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avoirs" (
    "id" UUID NOT NULL,
    "numero" VARCHAR(30) NOT NULL,
    "facture_origine_id" UUID NOT NULL,
    "commande_id" UUID NOT NULL,
    "motif" VARCHAR(200) NOT NULL,
    "montant_ht" DECIMAL(12,2) NOT NULL,
    "taux_tva" DECIMAL(5,2) NOT NULL,
    "montant_ttc" DECIMAL(12,2) NOT NULL,
    "date_emission" DATE NOT NULL,
    "pdf_path" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avoirs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paiements" (
    "id" UUID NOT NULL,
    "facture_id" UUID NOT NULL,
    "montant" DECIMAL(12,2) NOT NULL,
    "date_paiement" DATE NOT NULL,
    "source" "paiement_source" NOT NULL,
    "reference_externe" VARCHAR(100),
    "quonto_transaction_id" VARCHAR(100),
    "rapproche_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rapproche_by" UUID,
    "notes" TEXT,

    CONSTRAINT "paiements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relances" (
    "id" UUID NOT NULL,
    "facture_id" UUID NOT NULL,
    "niveau" "relance_niveau" NOT NULL,
    "date_envoi" TIMESTAMPTZ(6) NOT NULL,
    "canal" "relance_canal" NOT NULL,
    "contenu" TEXT,
    "envoye_par" UUID NOT NULL,
    "reponse_recue_at" TIMESTAMPTZ(6),

    CONSTRAINT "relances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_gestionnaires" (
    "id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "is_principal" BOOLEAN NOT NULL DEFAULT false,
    "date_debut" DATE,
    "date_fin" DATE,
    "notes" TEXT,

    CONSTRAINT "site_gestionnaires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fichiers_versions" (
    "id" UUID NOT NULL,
    "fichier_id" UUID NOT NULL,
    "version_num" INTEGER NOT NULL,
    "s3_path" TEXT,
    "onedrive_path" TEXT,
    "onedrive_item_id" VARCHAR(100),
    "taille_octets" BIGINT,
    "checksum_sha256" VARCHAR(64),
    "uploaded_by" UUID NOT NULL,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_to_onedrive_at" TIMESTAMPTZ(6),

    CONSTRAINT "fichiers_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "offres_numero_offre_key" ON "offres"("numero_offre");

-- CreateIndex
CREATE UNIQUE INDEX "commandes_numero_commande_key" ON "commandes"("numero_commande");

-- CreateIndex
CREATE UNIQUE INDEX "factures_numero_facture_key" ON "factures"("numero_facture");

-- CreateIndex
CREATE INDEX "idx_factures_statut_paiement" ON "factures"("statut_paiement");

-- CreateIndex
CREATE UNIQUE INDEX "reference_counters_entity_year_type_key" ON "reference_counters"("entity_type", "year", "type_mission");

-- CreateIndex
CREATE UNIQUE INDEX "avoirs_numero_key" ON "avoirs"("numero");

-- CreateIndex
CREATE INDEX "idx_avoirs_facture" ON "avoirs"("facture_origine_id");

-- CreateIndex
CREATE INDEX "idx_paiements_facture" ON "paiements"("facture_id");

-- CreateIndex
CREATE INDEX "idx_relances_facture" ON "relances"("facture_id");

-- CreateIndex
CREATE UNIQUE INDEX "site_gestionnaires_site_client_key" ON "site_gestionnaires"("site_id", "client_id");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offres" ADD CONSTRAINT "offres_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offres" ADD CONSTRAINT "offres_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offres" ADD CONSTRAINT "offres_consultant_par_defaut_id_fkey" FOREIGN KEY ("consultant_par_defaut_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commandes" ADD CONSTRAINT "commandes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commandes" ADD CONSTRAINT "commandes_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commandes" ADD CONSTRAINT "commandes_offre_id_fkey" FOREIGN KEY ("offre_id") REFERENCES "offres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures" ADD CONSTRAINT "factures_commande_id_fkey" FOREIGN KEY ("commande_id") REFERENCES "commandes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phases_offre" ADD CONSTRAINT "phases_offre_offre_id_fkey" FOREIGN KEY ("offre_id") REFERENCES "offres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichiers" ADD CONSTRAINT "fichiers_offre_id_fkey" FOREIGN KEY ("offre_id") REFERENCES "offres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avoirs" ADD CONSTRAINT "avoirs_facture_origine_id_fkey" FOREIGN KEY ("facture_origine_id") REFERENCES "factures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avoirs" ADD CONSTRAINT "avoirs_commande_id_fkey" FOREIGN KEY ("commande_id") REFERENCES "commandes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avoirs" ADD CONSTRAINT "avoirs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "factures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_rapproche_by_fkey" FOREIGN KEY ("rapproche_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relances" ADD CONSTRAINT "relances_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "factures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relances" ADD CONSTRAINT "relances_envoye_par_fkey" FOREIGN KEY ("envoye_par") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_gestionnaires" ADD CONSTRAINT "site_gestionnaires_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_gestionnaires" ADD CONSTRAINT "site_gestionnaires_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichiers_versions" ADD CONSTRAINT "fichiers_versions_fichier_id_fkey" FOREIGN KEY ("fichier_id") REFERENCES "fichiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichiers_versions" ADD CONSTRAINT "fichiers_versions_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Phase 2 compléments (plan §332–340) : index partiels non modélisables entièrement dans Prisma
CREATE UNIQUE INDEX "paiements_quonto_transaction_id_key" ON "paiements" ("quonto_transaction_id") WHERE ("quonto_transaction_id" IS NOT NULL);

CREATE INDEX "idx_factures_date_echeance" ON "factures" ("date_echeance") WHERE "statut_paiement" IN ('NON_PAYE', 'PARTIELLEMENT_PAYE', 'EN_RETARD');

-- Seed : compteurs année 2026 à 0 (aligné plan Phase 2 §4 — sans utilisateur consultant hardcodé)
INSERT INTO "reference_counters" ("id", "entity_type", "year", "type_mission", "last_value", "updated_at")
SELECT gen_random_uuid(), 'OFFRE'::reference_entity_type, 2026, m, 0, NOW()
FROM unnest(ARRAY['A', 'ADC', 'MOE', 'ET', 'MCM', 'MCN', 'MM', 'MS']::varchar(10)[]) AS t(m);

INSERT INTO "reference_counters" ("id", "entity_type", "year", "type_mission", "last_value", "updated_at")
SELECT gen_random_uuid(), 'COMMANDE'::reference_entity_type, 2026, m, 0, NOW()
FROM unnest(ARRAY['A', 'ADC', 'MOE', 'ET', 'MCM', 'MCN', 'MM', 'MS']::varchar(10)[]) AS t(m);

INSERT INTO "reference_counters" ("id", "entity_type", "year", "type_mission", "last_value", "updated_at")
VALUES (gen_random_uuid(), 'FACTURE'::reference_entity_type, 2026, '', 0, NOW());
