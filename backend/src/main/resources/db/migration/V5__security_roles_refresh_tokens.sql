CREATE TABLE refresh_tokens (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token       VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at  TIMESTAMPTZ
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);

INSERT INTO users (email, password_hash, role, agence_id, is_active)
SELECT 'manager@lvo-ing.fr',
       '$2a$10$ZfErN/GbpX.JboeGkLeaFOyd1s1CShtEC.Cw1C/iJ912tw.WFbYSa',
       'MANAGER',
       1,
       TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE lower(email) = 'manager@lvo-ing.fr');

INSERT INTO users (email, password_hash, role, agence_id, is_active)
SELECT 'viewer@lvo-ing.fr',
       '$2a$10$ZfErN/GbpX.JboeGkLeaFOyd1s1CShtEC.Cw1C/iJ912tw.WFbYSa',
       'VIEWER',
       1,
       TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE lower(email) = 'viewer@lvo-ing.fr');
