CREATE TABLE "ClientEmail" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "cc" TEXT,
    "bcc" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentBy" TEXT,
    "context" TEXT,
    CONSTRAINT "ClientEmail_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ClientEmail_clientId_idx" ON "ClientEmail"("clientId");
CREATE INDEX "ClientEmail_companyId_idx" ON "ClientEmail"("companyId");
ALTER TABLE "ClientEmail" ADD CONSTRAINT "ClientEmail_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
