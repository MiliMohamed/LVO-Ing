-- Migration: full_normalized_schema
-- Ajoute tous les champs manquants + crée toutes les nouvelles tables
-- pour que chaque tableau du store in-memory soit persisté en table normalisée.

-- ─── Colonnes manquantes sur les tables existantes ───────────────────────────

-- users
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "legacy_id"       INTEGER       UNIQUE,
  ADD COLUMN IF NOT EXISTS "password_hash"   TEXT,
  ADD COLUMN IF NOT EXISTS "prenom"          VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "nom"             VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "telephone"       VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "avatar_data_url" TEXT,
  ADD COLUMN IF NOT EXISTS "agence_id"       INTEGER;

-- clients
ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "legacy_id"          INTEGER UNIQUE,
  ADD COLUMN IF NOT EXISTS "siret"              VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "code_postal"        VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "responsable_email"  TEXT;

-- contacts
ALTER TABLE "contacts"
  ADD COLUMN IF NOT EXISTS "legacy_id"            INTEGER UNIQUE,
  ADD COLUMN IF NOT EXISTS "owner_user_id"        INTEGER,
  ADD COLUMN IF NOT EXISTS "client_password_hash" TEXT;

-- sites
ALTER TABLE "sites"
  ADD COLUMN IF NOT EXISTS "legacy_id"      INTEGER UNIQUE,
  ADD COLUMN IF NOT EXISTS "statut"         VARCHAR(20) NOT NULL DEFAULT 'ACTIF',
  ADD COLUMN IF NOT EXISTS "image_data_url" TEXT,
  ADD COLUMN IF NOT EXISTS "client_nom"     VARCHAR(200);

-- offres (champs métier supplémentaires)
ALTER TABLE "offres"
  ADD COLUMN IF NOT EXISTS "legacy_id"              INTEGER UNIQUE,
  ADD COLUMN IF NOT EXISTS "type_missions_json"     TEXT,
  ADD COLUMN IF NOT EXISTS "client_nom"             VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "site_nom"               VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "phases_mode"            VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "phases_lines_json"      TEXT,
  ADD COLUMN IF NOT EXISTS "taux_tva"               DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "consultant_email"       TEXT,
  ADD COLUMN IF NOT EXISTS "gestionnaire_nom"       TEXT,
  ADD COLUMN IF NOT EXISTS "gestionnaire_contact"   TEXT,
  ADD COLUMN IF NOT EXISTS "gestionnaire_email"     TEXT,
  ADD COLUMN IF NOT EXISTS "client_decision_json"   TEXT,
  ADD COLUMN IF NOT EXISTS "missions_json"          TEXT;

-- commandes
ALTER TABLE "commandes"
  ADD COLUMN IF NOT EXISTS "legacy_id"         INTEGER UNIQUE,
  ADD COLUMN IF NOT EXISTS "statut"            VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "client_nom"        VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "site_nom"          VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "type_missions_json" TEXT;

-- factures
ALTER TABLE "factures"
  ADD COLUMN IF NOT EXISTS "legacy_id"               INTEGER UNIQUE,
  ADD COLUMN IF NOT EXISTS "numero_commande_display"  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "client_nom"              VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "statut_facturation"      VARCHAR(20);

-- avoirs
ALTER TABLE "avoirs"
  ADD COLUMN IF NOT EXISTS "legacy_id" INTEGER UNIQUE;

-- Rendre created_by nullable (le store in-memory ne stocke pas le créateur)
ALTER TABLE "avoirs"
  ALTER COLUMN "created_by" DROP NOT NULL;

-- paiements
ALTER TABLE "paiements"
  ADD COLUMN IF NOT EXISTS "legacy_id" INTEGER UNIQUE;

-- relances : rendre envoye_par nullable
ALTER TABLE "relances"
  ADD COLUMN IF NOT EXISTS "legacy_id" INTEGER UNIQUE;
ALTER TABLE "relances"
  ALTER COLUMN "envoye_par" DROP NOT NULL;

-- site_gestionnaires : rendre client_id nullable + ajouter client_nom
ALTER TABLE "site_gestionnaires"
  ADD COLUMN IF NOT EXISTS "legacy_id"   INTEGER UNIQUE,
  ADD COLUMN IF NOT EXISTS "client_nom"  VARCHAR(200);
ALTER TABLE "site_gestionnaires"
  ALTER COLUMN "client_id" DROP NOT NULL;

-- fichiers_versions : ajouter champs manquants
ALTER TABLE "fichiers_versions"
  ADD COLUMN IF NOT EXISTS "legacy_id"  INTEGER UNIQUE,
  ADD COLUMN IF NOT EXISTS "reference"  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "doc_type"   VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "format"     VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "storage"    VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "minio_key"  TEXT;
ALTER TABLE "fichiers_versions"
  ALTER COLUMN "uploaded_by" DROP NOT NULL;

-- ─── Nouvelles tables ─────────────────────────────────────────────────────────

-- Équipements par site
CREATE TABLE IF NOT EXISTS "site_equipements" (
    "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
    "legacy_id"         INTEGER     UNIQUE,
    "site_id"           UUID        NOT NULL,
    "type"              VARCHAR(30) NOT NULL,
    "marque"            VARCHAR(100),
    "modele"            VARCHAR(100),
    "numero_serie"      VARCHAR(100),
    "annee_installation" INTEGER,
    "capacite_kg"       INTEGER,
    "etages"            VARCHAR(200),
    "statut"            VARCHAR(20) NOT NULL DEFAULT 'ACTIF',
    "notes"             TEXT,
    "created_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "site_equipements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "site_equipements_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE
);

-- Arborescence documentaire
CREATE TABLE IF NOT EXISTS "site_arborescence_nodes" (
    "id"                  UUID           NOT NULL DEFAULT gen_random_uuid(),
    "legacy_id"           INTEGER        UNIQUE,
    "site_id"             UUID           NOT NULL,
    "parent_id"           UUID,
    "legacy_parent_id"    INTEGER,
    "node_type"           VARCHAR(10)    NOT NULL,
    "nom"                 VARCHAR(500)   NOT NULL,
    "sort_order"          INTEGER        NOT NULL DEFAULT 0,
    "stored_path"         TEXT,
    "minio_key"           TEXT,
    "content_type"        VARCHAR(200),
    "size_bytes"          BIGINT,
    "uploaded_by_user_id" INTEGER,
    "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "site_arborescence_nodes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "site_arborescence_nodes_site_id_fkey"   FOREIGN KEY ("site_id")   REFERENCES "sites"("id")                      ON DELETE CASCADE,
    CONSTRAINT "site_arborescence_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "site_arborescence_nodes"("id")     ON DELETE CASCADE
);

-- Tâches CRM
CREATE TABLE IF NOT EXISTS "crm_tasks" (
    "id"          UUID           NOT NULL DEFAULT gen_random_uuid(),
    "legacy_id"   INTEGER        UNIQUE,
    "user_id"     UUID           NOT NULL,
    "title"       TEXT           NOT NULL,
    "due_date"    DATE,
    "due_hour"    INTEGER,
    "due_minute"  INTEGER,
    "done"        BOOLEAN        NOT NULL DEFAULT false,
    "entity_type" VARCHAR(50),
    "entity_id"   INTEGER,
    "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crm_tasks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "crm_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- Notifications CRM
CREATE TABLE IF NOT EXISTS "crm_notifications" (
    "id"          UUID           NOT NULL DEFAULT gen_random_uuid(),
    "legacy_id"   INTEGER        UNIQUE,
    "user_id"     UUID           NOT NULL,
    "kind"        VARCHAR(30)    NOT NULL,
    "title"       TEXT           NOT NULL,
    "message"     TEXT           NOT NULL,
    "href"        TEXT,
    "entity_type" VARCHAR(50),
    "entity_id"   INTEGER,
    "read"        BOOLEAN        NOT NULL DEFAULT false,
    "source"      VARCHAR(20),
    "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crm_notifications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "crm_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- Messagerie espace client
CREATE TABLE IF NOT EXISTS "client_portal_messages" (
    "id"             UUID           NOT NULL DEFAULT gen_random_uuid(),
    "legacy_id"      INTEGER        UNIQUE,
    "thread_id"      VARCHAR(100)   NOT NULL,
    "entreprise"     VARCHAR(200)   NOT NULL,
    "subject"        TEXT           NOT NULL,
    "body"           TEXT           NOT NULL,
    "sender_type"    VARCHAR(10)    NOT NULL,
    "sender_name"    VARCHAR(200),
    "sender_email"   VARCHAR(200),
    "read_by_client" BOOLEAN        NOT NULL DEFAULT false,
    "read_by_crm"    BOOLEAN        NOT NULL DEFAULT false,
    "created_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "client_portal_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_client_messages_entreprise" ON "client_portal_messages"("entreprise");

-- Documents espace client
CREATE TABLE IF NOT EXISTS "client_portal_documents" (
    "id"           UUID           NOT NULL DEFAULT gen_random_uuid(),
    "legacy_id"    INTEGER        UNIQUE,
    "entreprise"   VARCHAR(200)   NOT NULL,
    "contact_id"   UUID,
    "site_id"      UUID,
    "nom"          VARCHAR(500)   NOT NULL,
    "type"         VARCHAR(30)    NOT NULL,
    "file_name"    VARCHAR(500)   NOT NULL,
    "stored_path"  TEXT,
    "minio_key"    TEXT,
    "size_bytes"   BIGINT,
    "content_type" VARCHAR(200),
    "statut"       VARCHAR(20)    NOT NULL DEFAULT 'EN_ATTENTE',
    "motif_rejet"  TEXT,
    "validated_at" TIMESTAMPTZ(6),
    "offre_id"     UUID,
    "commande_id"  UUID,
    "notes"        TEXT,
    "uploaded_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "client_portal_documents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "client_portal_documents_contact_id_fkey"  FOREIGN KEY ("contact_id")  REFERENCES "contacts"("id")  ON DELETE SET NULL,
    CONSTRAINT "client_portal_documents_site_id_fkey"     FOREIGN KEY ("site_id")     REFERENCES "sites"("id")     ON DELETE SET NULL,
    CONSTRAINT "client_portal_documents_offre_id_fkey"    FOREIGN KEY ("offre_id")    REFERENCES "offres"("id")    ON DELETE SET NULL,
    CONSTRAINT "client_portal_documents_commande_id_fkey" FOREIGN KEY ("commande_id") REFERENCES "commandes"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "idx_client_docs_entreprise" ON "client_portal_documents"("entreprise");

-- Notifications espace client
CREATE TABLE IF NOT EXISTS "client_portal_notifications" (
    "id"         UUID           NOT NULL DEFAULT gen_random_uuid(),
    "legacy_id"  INTEGER        UNIQUE,
    "entreprise" VARCHAR(200)   NOT NULL,
    "title"      TEXT           NOT NULL,
    "message"    TEXT           NOT NULL,
    "kind"       VARCHAR(30)    NOT NULL,
    "href"       TEXT,
    "read"       BOOLEAN        NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "client_portal_notifications_pkey" PRIMARY KEY ("id")
);

-- Contrats clients
CREATE TABLE IF NOT EXISTS "client_contrats" (
    "id"                          UUID           NOT NULL DEFAULT gen_random_uuid(),
    "legacy_id"                   INTEGER        UNIQUE,
    "entreprise"                  VARCHAR(200)   NOT NULL,
    "reference"                   VARCHAR(100)   NOT NULL,
    "intitule"                    TEXT           NOT NULL,
    "site_id"                     UUID,
    "site_nom"                    VARCHAR(200),
    "type_contrat"                VARCHAR(100),
    "date_debut"                  DATE           NOT NULL,
    "date_fin"                    DATE           NOT NULL,
    "montant_annuel_ht"           DECIMAL(12,2),
    "prestataire"                 VARCHAR(200),
    "statut"                      VARCHAR(30)    NOT NULL DEFAULT 'ACTIF',
    "conditions_renouvellement"   TEXT,
    "clause_revision_tarifaire"   TEXT,
    "avenants_json"               TEXT,
    "demande_renouvellement_at"   TIMESTAMPTZ(6),
    "created_at"                  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "client_contrats_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "client_contrats_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL
);

-- Interventions & pannes
CREATE TABLE IF NOT EXISTS "client_interventions" (
    "id"                      UUID           NOT NULL DEFAULT gen_random_uuid(),
    "legacy_id"               INTEGER        UNIQUE,
    "entreprise"              VARCHAR(200)   NOT NULL,
    "reference"               VARCHAR(100)   NOT NULL,
    "site_id"                 UUID,
    "site_nom"                VARCHAR(200),
    "equipement_id"           UUID,
    "equipement_libelle"      VARCHAR(200),
    "type"                    VARCHAR(50)    NOT NULL,
    "priorite"                VARCHAR(20)    NOT NULL DEFAULT 'NORMALE',
    "statut"                  VARCHAR(20)    NOT NULL DEFAULT 'CREEE',
    "description"             TEXT           NOT NULL,
    "prestataire"             VARCHAR(200),
    "declared_at"             TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_at"             TIMESTAMPTZ(6),
    "resolved_at"             TIMESTAMPTZ(6),
    "compte_rendu"            TEXT,
    "declared_by_contact_id"  UUID,
    "declared_by_name"        VARCHAR(200),
    CONSTRAINT "client_interventions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "client_interventions_site_id_fkey"       FOREIGN KEY ("site_id")       REFERENCES "sites"("id")           ON DELETE SET NULL,
    CONSTRAINT "client_interventions_equip_id_fkey"      FOREIGN KEY ("equipement_id") REFERENCES "site_equipements"("id") ON DELETE SET NULL,
    CONSTRAINT "client_interventions_contact_id_fkey"    FOREIGN KEY ("declared_by_contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL
);

-- Configuration alertes client
CREATE TABLE IF NOT EXISTS "client_alertes_configs" (
    "id"                          UUID           NOT NULL DEFAULT gen_random_uuid(),
    "entreprise"                  VARCHAR(200)   NOT NULL UNIQUE,
    "facture_impayee"             BOOLEAN        NOT NULL DEFAULT true,
    "facture_impayee_delai_jours" INTEGER        NOT NULL DEFAULT 30,
    "contrat_expirant"            BOOLEAN        NOT NULL DEFAULT true,
    "panne_signalee"              BOOLEAN        NOT NULL DEFAULT true,
    "mms_sous_seuil"              BOOLEAN        NOT NULL DEFAULT false,
    "mms_seuil"                   DECIMAL(5,2)   NOT NULL DEFAULT 5.0,
    "offre_expirant"              BOOLEAN        NOT NULL DEFAULT true,
    "visite_reglementaire"        BOOLEAN        NOT NULL DEFAULT true,
    "updated_at"                  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "client_alertes_configs_pkey" PRIMARY KEY ("id")
);

-- Rapports MMS
CREATE TABLE IF NOT EXISTS "mms_rapports" (
    "id"                 UUID           NOT NULL DEFAULT gen_random_uuid(),
    "legacy_id"          INTEGER        UNIQUE,
    "prestataire"        VARCHAR(200)   NOT NULL,
    "client"             VARCHAR(200)   NOT NULL,
    "trimestre"          VARCHAR(10)    NOT NULL,
    "annee"              INTEGER        NOT NULL,
    "created_by_user_id" UUID,
    "nb_appareils"       INTEGER        NOT NULL DEFAULT 0,
    "nb_interventions"   INTEGER        NOT NULL DEFAULT 0,
    "nb_pannes"          INTEGER        NOT NULL DEFAULT 0,
    "nb_visites"         INTEGER        NOT NULL DEFAULT 0,
    "penalite_totale"    DECIMAL(12,2)  NOT NULL DEFAULT 0,
    "excel_nom"          VARCHAR(500),
    "word_nom"           VARCHAR(500),
    "pdf_nom"            VARCHAR(500),
    "excel_minio_key"    TEXT,
    "word_minio_key"     TEXT,
    "pdf_minio_key"      TEXT,
    "excel_size_bytes"   BIGINT,
    "word_size_bytes"    BIGINT,
    "pdf_size_bytes"     BIGINT,
    "site_id"            UUID,
    "created_at"         TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mms_rapports_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "mms_rapports_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")  ON DELETE SET NULL,
    CONSTRAINT "mms_rapports_site_id_fkey" FOREIGN KEY ("site_id")            REFERENCES "sites"("id")  ON DELETE SET NULL
);

-- Transactions Quonto en attente
CREATE TABLE IF NOT EXISTS "pending_quonto_transactions" (
    "id"                    UUID           NOT NULL DEFAULT gen_random_uuid(),
    "legacy_id"             INTEGER        UNIQUE,
    "libelle"               TEXT           NOT NULL,
    "montant"               DECIMAL(12,2)  NOT NULL,
    "date_operation"        DATE           NOT NULL,
    "score"                 DECIMAL(5,2)   NOT NULL DEFAULT 0,
    "quonto_transaction_id" VARCHAR(200)   NOT NULL UNIQUE,
    "created_at"            TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pending_quonto_transactions_pkey" PRIMARY KEY ("id")
);

-- Journal d'audit
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id"            UUID           NOT NULL DEFAULT gen_random_uuid(),
    "legacy_id"     INTEGER        UNIQUE,
    "entity_type"   VARCHAR(50)    NOT NULL,
    "entity_id"     INTEGER,
    "action"        VARCHAR(100)   NOT NULL,
    "changes"       JSONB,
    "performed_by"  VARCHAR(200),
    "performed_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address"    VARCHAR(50),
    "user_agent"    TEXT,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_audit_log_entity" ON "audit_logs"("entity_type", "entity_id");

-- Historique annulations
CREATE TABLE IF NOT EXISTS "historique_annulations" (
    "id"           UUID           NOT NULL DEFAULT gen_random_uuid(),
    "legacy_id"    INTEGER        UNIQUE,
    "entity_type"  VARCHAR(50)    NOT NULL,
    "entity_id"    INTEGER        NOT NULL,
    "reference"    VARCHAR(100)   NOT NULL,
    "motif"        TEXT           NOT NULL,
    "commentaire"  TEXT,
    "montant_ht"   DECIMAL(12,2),
    "client_nom"   VARCHAR(200),
    "cancelled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "historique_annulations_pkey" PRIMARY KEY ("id")
);

-- Refresh tokens (CRM)
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
    "id"         UUID           NOT NULL DEFAULT gen_random_uuid(),
    "token"      TEXT           NOT NULL UNIQUE,
    "user_id"    UUID           NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),
    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- Refresh tokens (espace client)
CREATE TABLE IF NOT EXISTS "client_refresh_tokens" (
    "id"         UUID           NOT NULL DEFAULT gen_random_uuid(),
    "token"      TEXT           NOT NULL UNIQUE,
    "contact_id" UUID           NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),
    CONSTRAINT "client_refresh_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "client_refresh_tokens_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE
);
