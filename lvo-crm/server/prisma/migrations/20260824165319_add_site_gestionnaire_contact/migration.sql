-- AlterTable
ALTER TABLE "site_gestionnaires" ADD COLUMN     "contact_id" UUID,
ADD COLUMN     "contact_nom" VARCHAR(200);

-- AddForeignKey
ALTER TABLE "site_gestionnaires" ADD CONSTRAINT "site_gestionnaires_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
