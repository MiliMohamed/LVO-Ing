-- Arborescence documentaire interne par site (remplace OneDrive pour la structure dossiers)

CREATE TABLE site_arborescence_nodes (
    id              BIGSERIAL PRIMARY KEY,
    site_id         BIGINT NOT NULL REFERENCES sites (id) ON DELETE CASCADE,
    parent_id       BIGINT REFERENCES site_arborescence_nodes (id) ON DELETE CASCADE,
    node_type       VARCHAR(16) NOT NULL CHECK (node_type IN ('FOLDER', 'FILE')),
    nom             VARCHAR(512) NOT NULL,
    sort_order      INT NOT NULL DEFAULT 0,
    stored_path     TEXT,
    content_type    VARCHAR(128),
    size_bytes      BIGINT,
    uploaded_by_id  BIGINT REFERENCES users (id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_site_arbo_site ON site_arborescence_nodes (site_id);
CREATE INDEX idx_site_arbo_parent ON site_arborescence_nodes (parent_id);
CREATE UNIQUE INDEX uq_site_arbo_folder_name
    ON site_arborescence_nodes (site_id, parent_id, nom)
    WHERE node_type = 'FOLDER';
