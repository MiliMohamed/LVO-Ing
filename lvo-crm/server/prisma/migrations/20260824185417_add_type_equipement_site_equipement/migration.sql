-- CreateTable
CREATE TABLE "type_equipement" (
    "id" UUID NOT NULL,
    "legacy_id" INTEGER,
    "libelle" VARCHAR(100) NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "type_equipement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_equipement" (
    "id" UUID NOT NULL,
    "legacy_id" INTEGER,
    "site_id" UUID NOT NULL,
    "type_equipement_id" UUID NOT NULL,
    "quantite" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "site_equipement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "site_equipement_quantite_check" CHECK ("quantite" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "type_equipement_legacy_id_key" ON "type_equipement"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "type_equipement_libelle_key" ON "type_equipement"("libelle");

-- CreateIndex
CREATE UNIQUE INDEX "site_equipement_legacy_id_key" ON "site_equipement"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "site_equipement_site_id_type_equipement_id_key" ON "site_equipement"("site_id", "type_equipement_id");

-- AddForeignKey
ALTER TABLE "site_equipement" ADD CONSTRAINT "site_equipement_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_equipement" ADD CONSTRAINT "site_equipement_type_equipement_id_fkey" FOREIGN KEY ("type_equipement_id") REFERENCES "type_equipement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed default equipment types (additive — safe to re-run with ON CONFLICT)
INSERT INTO "type_equipement" ("id", "libelle", "actif") VALUES
  (gen_random_uuid(), 'Ascenseur', true),
  (gen_random_uuid(), 'Monte-charge', true),
  (gen_random_uuid(), 'Escalator', true)
ON CONFLICT ("libelle") DO NOTHING;
