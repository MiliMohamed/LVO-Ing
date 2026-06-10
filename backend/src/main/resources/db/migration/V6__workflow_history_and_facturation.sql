ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE sites ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE offres ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE factures ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS historique_annulations (
    id              BIGSERIAL PRIMARY KEY,
    entity_type     VARCHAR(32) NOT NULL,
    entity_id       BIGINT NOT NULL,
    reference       VARCHAR(128) NOT NULL,
    snapshot_json   TEXT NOT NULL,
    motif           VARCHAR(200) NOT NULL,
    commentaire     TEXT,
    montant_ht      NUMERIC(14,2) NOT NULL DEFAULT 0,
    client_nom      VARCHAR(255) NOT NULL,
    consultant_code VARCHAR(64),
    cancelled_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS historique_duplications (
    id              BIGSERIAL PRIMARY KEY,
    entity_type     VARCHAR(32) NOT NULL,
    source_id       BIGINT NOT NULL,
    target_id       BIGINT NOT NULL,
    source_ref      VARCHAR(128) NOT NULL,
    target_ref      VARCHAR(128) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS repartitions_honoraires (
    id          BIGSERIAL PRIMARY KEY,
    facture_id  BIGINT NOT NULL REFERENCES factures (id) ON DELETE CASCADE,
    code_poste  VARCHAR(32) NOT NULL,
    pourcentage NUMERIC(6,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS adresses_facturation (
    id             BIGSERIAL PRIMARY KEY,
    client_id       BIGINT NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
    label           VARCHAR(128),
    adresse_complete TEXT NOT NULL,
    is_default      BOOLEAN NOT NULL DEFAULT FALSE
);
