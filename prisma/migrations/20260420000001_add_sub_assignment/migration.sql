CREATE TABLE IF NOT EXISTS "SubAssignment" (
  "id"              TEXT NOT NULL,
  "clientId"        TEXT NOT NULL,
  "companyId"       TEXT NOT NULL,
  "templateId"      TEXT,
  "divisionId"      TEXT,
  "itemId"          TEXT,
  "label"           TEXT NOT NULL,
  "subContractorId" TEXT,
  "subName"         TEXT,
  "cost"            DECIMAL(14,2),
  "salePrice"       DECIMAL(14,2),
  "notes"           TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SubAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SubAssignment_clientId_idx" ON "SubAssignment"("clientId");
CREATE INDEX IF NOT EXISTS "SubAssignment_companyId_idx" ON "SubAssignment"("companyId");

ALTER TABLE "SubAssignment"
  ADD CONSTRAINT "SubAssignment_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubAssignment"
  ADD CONSTRAINT "SubAssignment_subContractorId_fkey"
  FOREIGN KEY ("subContractorId") REFERENCES "SubContractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
