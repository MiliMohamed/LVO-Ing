-- LVO CRM — schéma dérivé de erd_tables_lvo_crm.html + maquette CRM (contacts, agences, champs UI).
SET client_encoding = 'UTF8';

CREATE TABLE agences (
    id         BIGSERIAL PRIMARY KEY,
    code       VARCHAR(16) NOT NULL UNIQUE,
    nom        VARCHAR(255) NOT NULL,
    region     VARCHAR(128)
);

CREATE TABLE users (
    id             BIGSERIAL PRIMARY KEY,
    email          VARCHAR(320) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    role           VARCHAR(64) NOT NULL,
    agence_id      BIGINT REFERENCES agences (id),
    totp_secret    VARCHAR(64),
    totp_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
    is_active      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_users_agence ON users (agence_id);

CREATE TABLE clients (
    id             BIGSERIAL PRIMARY KEY,
    raison_sociale VARCHAR(255) NOT NULL,
    siret          VARCHAR(32),
    type_client    VARCHAR(64),
    email          VARCHAR(320),
    telephone      VARCHAR(32),
    entite         VARCHAR(255),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE contacts (
    id          BIGSERIAL PRIMARY KEY,
    client_id   BIGINT NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
    civilite    VARCHAR(16),
    nom         VARCHAR(128) NOT NULL,
    prenom      VARCHAR(128) NOT NULL,
    fonction    VARCHAR(255),
    email       VARCHAR(320),
    telephone   VARCHAR(64),
    mobile      VARCHAR(64),
    plateforme  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contacts_client ON contacts (client_id);

CREATE TABLE sites (
    id                  BIGSERIAL PRIMARY KEY,
    client_id           BIGINT NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
    consultant_id       BIGINT REFERENCES users (id) ON DELETE SET NULL,
    nom                 VARCHAR(512) NOT NULL,
    adresse             TEXT,
    type_site           VARCHAR(64),
    onedrive_folder_id  VARCHAR(255),
    onedrive_folder_url TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sites_client ON sites (client_id);
CREATE INDEX idx_sites_consultant ON sites (consultant_id);

CREATE TABLE offres (
    id            BIGSERIAL PRIMARY KEY,
    site_id       BIGINT NOT NULL REFERENCES sites (id) ON DELETE CASCADE,
    consultant_id BIGINT REFERENCES users (id) ON DELETE SET NULL,
    numero_offre  VARCHAR(64) NOT NULL UNIQUE,
    type_mission  VARCHAR(32) NOT NULL,
    statut        VARCHAR(64) NOT NULL,
    montant_ht    NUMERIC(14, 2) NOT NULL DEFAULT 0,
    date_offre    DATE,
    cancelled_at  TIMESTAMPTZ,
    cancel_motif  TEXT
);

CREATE INDEX idx_offres_site ON offres (site_id);
CREATE INDEX idx_offres_consultant ON offres (consultant_id);

CREATE TABLE commandes (
    id               BIGSERIAL PRIMARY KEY,
    offre_id         BIGINT NOT NULL UNIQUE REFERENCES offres (id) ON DELETE CASCADE,
    numero_commande  VARCHAR(64) NOT NULL UNIQUE,
    date_commande    DATE NOT NULL,
    montant_ht       NUMERIC(14, 2) NOT NULL DEFAULT 0,
    montant_facture  NUMERIC(14, 2) NOT NULL DEFAULT 0,
    cancelled_at     TIMESTAMPTZ,
    cancel_motif     TEXT
);

CREATE TABLE factures (
    id               BIGSERIAL PRIMARY KEY,
    commande_id      BIGINT NOT NULL REFERENCES commandes (id) ON DELETE CASCADE,
    numero_facture   VARCHAR(64) NOT NULL UNIQUE,
    montant_ht       NUMERIC(14, 2) NOT NULL,
    frais            NUMERIC(14, 2) NOT NULL DEFAULT 0,
    statut           VARCHAR(64) NOT NULL,
    mode_reglement   VARCHAR(128),
    date_facture     DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE INDEX idx_factures_commande ON factures (commande_id);

CREATE TABLE echeancier_facturation (
    id             BIGSERIAL PRIMARY KEY,
    commande_id    BIGINT NOT NULL REFERENCES commandes (id) ON DELETE CASCADE,
    type_jalon     VARCHAR(128) NOT NULL,
    date_echeance  DATE NOT NULL,
    montant_ht     NUMERIC(14, 2) NOT NULL,
    statut         VARCHAR(64) NOT NULL
);

CREATE INDEX idx_echeancier_commande ON echeancier_facturation (commande_id);

-- Données de démo (dev)
INSERT INTO agences (code, nom, region) VALUES
  ('89', 'La Réunion', '974'),
  ('75', 'Paris', 'Île-de-France'),
  ('94', 'PACA', 'Provence');

INSERT INTO users (email, password_hash, role, agence_id, is_active) VALUES
  ('admin@lvo-ing.fr', '$2a$10$placeholder_hash_replace_with_bcrypt', 'ADMIN', 1, TRUE),
  ('consultant@lvo-ing.fr', '$2a$10$placeholder_hash_replace_with_bcrypt', 'CONSULTANT', 2, TRUE);

INSERT INTO clients (raison_sociale, siret, type_client, email, telephone, entite) VALUES
  ('SIDR', NULL, 'Bailleur', 'sidr@sidr.fr', '+262 262 90 20 00', 'Service Comptabilité'),
  ('CHU DE LA RÉUNION', NULL, 'Public', 'dsi@chu-reunion.fr', '+262 262 90 50 00', 'Dir. Technique');

INSERT INTO contacts (client_id, civilite, nom, prenom, fonction, email, mobile) VALUES
  (1, 'Mr', 'PRIGENT', 'Michel', 'Resp. Patrimoine', 'michel.prigent@sidr.fr', '+33 6 92 80 04 57'),
  (2, 'Mr', 'NICOLAS', 'Raphaël', 'Resp. Technique', 'r.nicolas@chu-reunion.fr', NULL);

INSERT INTO sites (client_id, consultant_id, nom, adresse, type_site) VALUES
  (2, 2, 'Allée des Topazes CS 11021, 97400 Saint-Denis', 'Allée des Topazes', 'Hôpital'),
  (1, 2, 'Multisites SIDR La Réunion 97400 Saint-Denis', 'Saint-Denis', 'Résidentiel');

INSERT INTO offres (site_id, consultant_id, numero_offre, type_mission, statut, montant_ht, date_offre) VALUES
  (2, 2, '2026-MS-94-89-051', 'MS', 'COMMANDE', 26041.00, '2026-03-07'::date);

INSERT INTO commandes (offre_id, numero_commande, date_commande, montant_ht) VALUES
  (1, '2026-027-MOV', '2026-03-07'::date, 26041.00);

INSERT INTO echeancier_facturation (commande_id, type_jalon, date_echeance, montant_ht, statut) VALUES
  (1, 'DET — Mois 1', '2026-05-15'::date, 2170.00, 'EN_RETARD');
