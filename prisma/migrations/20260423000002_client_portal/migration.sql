-- Add CLIENT to Role enum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CLIENT';

-- Add clientId column to User (portal link to a specific client)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "clientId" TEXT;
ALTER TABLE "User" ADD CONSTRAINT "User_clientId_key" UNIQUE ("clientId");
ALTER TABLE "User" ADD CONSTRAINT "User_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Client portal photos
CREATE TABLE "ClientPortalPhoto" (
  "id"         TEXT         NOT NULL,
  "clientId"   TEXT         NOT NULL,
  "companyId"  TEXT         NOT NULL,
  "caption"    TEXT,
  "fileUrl"    TEXT         NOT NULL,
  "fileName"   TEXT         NOT NULL,
  "fileSize"   INTEGER      NOT NULL DEFAULT 0,
  "sortOrder"  INTEGER      NOT NULL DEFAULT 0,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientPortalPhoto_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ClientPortalPhoto" ADD CONSTRAINT "ClientPortalPhoto_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ClientPortalPhoto_clientId_idx" ON "ClientPortalPhoto"("clientId");
CREATE INDEX "ClientPortalPhoto_companyId_idx" ON "ClientPortalPhoto"("companyId");

-- Client portal documents
CREATE TABLE "ClientPortalDocument" (
  "id"         TEXT         NOT NULL,
  "clientId"   TEXT         NOT NULL,
  "companyId"  TEXT         NOT NULL,
  "category"   TEXT         NOT NULL,
  "label"      TEXT         NOT NULL,
  "fileUrl"    TEXT         NOT NULL,
  "fileName"   TEXT         NOT NULL,
  "fileSize"   INTEGER      NOT NULL DEFAULT 0,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientPortalDocument_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ClientPortalDocument" ADD CONSTRAINT "ClientPortalDocument_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ClientPortalDocument_clientId_idx" ON "ClientPortalDocument"("clientId");
CREATE INDEX "ClientPortalDocument_companyId_idx" ON "ClientPortalDocument"("companyId");
