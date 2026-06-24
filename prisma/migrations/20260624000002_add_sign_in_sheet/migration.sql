CREATE TABLE IF NOT EXISTS "SignInSheet" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "estimateTemplateId" TEXT NOT NULL,
  "data" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SignInSheet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SignInSheet_estimateTemplateId_key" ON "SignInSheet"("estimateTemplateId");
CREATE INDEX IF NOT EXISTS "SignInSheet_companyId_idx" ON "SignInSheet"("companyId");

ALTER TABLE "SignInSheet" ADD CONSTRAINT "SignInSheet_estimateTemplateId_fkey"
  FOREIGN KEY ("estimateTemplateId") REFERENCES "EstimateTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
