CREATE TABLE IF NOT EXISTS "MarketingAgency" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contractStartDate" TIMESTAMP(3) NOT NULL,
  "payAmount" DECIMAL(14,2) NOT NULL,
  "payFrequency" TEXT NOT NULL,
  "facebookFees" DECIMAL(14,2),
  "notes" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketingAgency_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MarketingAgency_companyId_idx" ON "MarketingAgency"("companyId");

ALTER TABLE "MarketingAgency" ADD CONSTRAINT "MarketingAgency_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
