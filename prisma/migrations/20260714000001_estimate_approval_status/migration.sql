ALTER TABLE "EstimateTemplate" ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT NOT NULL DEFAULT 'DRAFT';
-- Estimates already signed (by client or countersigned) start as APPROVED.
UPDATE "EstimateTemplate" SET "approvalStatus" = 'APPROVED' WHERE "signedAt" IS NOT NULL OR "counterSignedAt" IS NOT NULL;
