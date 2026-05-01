-- AlterTable: add lump-sum override to template and project estimate divisions
ALTER TABLE "EstimateTemplateDivision" ADD COLUMN IF NOT EXISTS "manualTotal" DECIMAL(14,2);
ALTER TABLE "ProjectEstimateDivision" ADD COLUMN IF NOT EXISTS "manualTotal" DECIMAL(14,2);
