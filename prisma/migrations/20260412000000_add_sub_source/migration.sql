ALTER TABLE "SubContractor" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'manual';
CREATE INDEX IF NOT EXISTS "SubContractor_companyId_source_idx" ON "SubContractor"("companyId", "source");
