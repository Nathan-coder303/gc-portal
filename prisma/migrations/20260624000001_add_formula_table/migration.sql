CREATE TABLE IF NOT EXISTS "Formula" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "expression" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Formula_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Formula_companyId_scope_key" ON "Formula"("companyId", "scope");
CREATE INDEX IF NOT EXISTS "Formula_companyId_idx" ON "Formula"("companyId");
