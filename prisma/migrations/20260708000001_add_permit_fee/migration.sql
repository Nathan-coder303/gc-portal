CREATE TABLE IF NOT EXISTS "PermitFee" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "description" TEXT,
  "amount" DECIMAL(14,2) NOT NULL,
  "incurredAt" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PermitFee_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PermitFee_clientId_idx" ON "PermitFee"("clientId");
CREATE INDEX IF NOT EXISTS "PermitFee_companyId_idx" ON "PermitFee"("companyId");
ALTER TABLE "PermitFee" ADD CONSTRAINT "PermitFee_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
