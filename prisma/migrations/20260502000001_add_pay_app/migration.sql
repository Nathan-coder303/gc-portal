CREATE TABLE IF NOT EXISTS "PayApp" (
  "id"                   TEXT NOT NULL,
  "companyId"            TEXT NOT NULL,
  "clientId"             TEXT NOT NULL,
  "payAppNumber"         INTEGER NOT NULL DEFAULT 1,
  "invoiceNumber"        TEXT,
  "projectName"          TEXT,
  "projectNumber"        TEXT,
  "invoiceDate"          TEXT,
  "paymentDue"           TEXT,
  "periodStart"          TEXT,
  "periodEnd"            TEXT,
  "fromName"             TEXT,
  "fromContact"          TEXT,
  "fromAddress"          TEXT,
  "toName"               TEXT,
  "toContact"            TEXT,
  "toAddress"            TEXT,
  "originalContractSum"  DECIMAL(15,2) NOT NULL DEFAULT 0,
  "lessPreviousInvoices" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "depositPriorBalance"  DECIMAL(15,2) NOT NULL DEFAULT 0,
  "depositReductionThis" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "coAdditionsPrev"      DECIMAL(15,2) NOT NULL DEFAULT 0,
  "coDeductionsPrev"     DECIMAL(15,2) NOT NULL DEFAULT 0,
  "coAdditionsThis"      DECIMAL(15,2) NOT NULL DEFAULT 0,
  "coDeductionsThis"     DECIMAL(15,2) NOT NULL DEFAULT 0,
  "distributeOwner"      BOOLEAN NOT NULL DEFAULT true,
  "distributeArchitect"  BOOLEAN NOT NULL DEFAULT false,
  "distributeContractor" BOOLEAN NOT NULL DEFAULT false,
  "certifiedBy"          TEXT,
  "certState"            TEXT,
  "certCounty"           TEXT,
  "notaryName"           TEXT,
  "archivedAt"           TIMESTAMP(3),
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayApp_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PayAppLine" (
  "id"             TEXT NOT NULL,
  "payAppId"       TEXT NOT NULL,
  "sortOrder"      INTEGER NOT NULL DEFAULT 0,
  "itemNumber"     TEXT NOT NULL DEFAULT '',
  "description"    TEXT NOT NULL DEFAULT '',
  "scheduledValue" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "fromPrevious"   DECIMAL(15,2) NOT NULL DEFAULT 0,
  "thisInvoice"    DECIMAL(15,2) NOT NULL DEFAULT 0,
  "retainageThis"  DECIMAL(15,2) NOT NULL DEFAULT 0,
  "retainageTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayAppLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PayApp_companyId_idx" ON "PayApp"("companyId");
CREATE INDEX IF NOT EXISTS "PayApp_clientId_idx" ON "PayApp"("clientId");
CREATE INDEX IF NOT EXISTS "PayAppLine_payAppId_idx" ON "PayAppLine"("payAppId");

ALTER TABLE "PayApp" ADD CONSTRAINT "PayApp_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PayApp" ADD CONSTRAINT "PayApp_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayAppLine" ADD CONSTRAINT "PayAppLine_payAppId_fkey"
  FOREIGN KEY ("payAppId") REFERENCES "PayApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
