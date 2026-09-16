-- CreateTable
CREATE TABLE "ascensoristes" (
    "id" UUID NOT NULL,
    "legacy_id" INTEGER,
    "entreprise" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telephone" VARCHAR(50),
    "ascensoriste_password_hash" TEXT,
    "statut" "contact_client_statut" NOT NULL DEFAULT 'ACTIF',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ascensoristes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ascensoristes_legacy_id_key" ON "ascensoristes"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "ascensoristes_email_key" ON "ascensoristes"("email");
