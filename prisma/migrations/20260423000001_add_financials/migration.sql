CREATE TABLE "ClientSub" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "subContractorId" TEXT,
    "subName" TEXT,
    "contractAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientSub_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubPayment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientSubId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "checkNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubPayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MaterialPurchase" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "description" TEXT,
    "purchasedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaterialPurchase_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ClientSub" ADD CONSTRAINT "ClientSub_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientSub" ADD CONSTRAINT "ClientSub_subContractorId_fkey" FOREIGN KEY ("subContractorId") REFERENCES "SubContractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubPayment" ADD CONSTRAINT "SubPayment_clientSubId_fkey" FOREIGN KEY ("clientSubId") REFERENCES "ClientSub"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaterialPurchase" ADD CONSTRAINT "MaterialPurchase_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaterialPurchase" ADD CONSTRAINT "MaterialPurchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ClientSub_clientId_idx" ON "ClientSub"("clientId");
CREATE INDEX "ClientSub_companyId_idx" ON "ClientSub"("companyId");
CREATE INDEX "SubPayment_clientSubId_idx" ON "SubPayment"("clientSubId");
CREATE INDEX "SubPayment_companyId_idx" ON "SubPayment"("companyId");
CREATE INDEX "Supplier_companyId_idx" ON "Supplier"("companyId");
CREATE INDEX "MaterialPurchase_clientId_idx" ON "MaterialPurchase"("clientId");
CREATE INDEX "MaterialPurchase_companyId_idx" ON "MaterialPurchase"("companyId");
