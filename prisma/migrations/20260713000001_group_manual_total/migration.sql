ALTER TABLE "EstimateTemplateGroup" ADD COLUMN IF NOT EXISTS "manualTotal" DECIMAL(14,2);
ALTER TABLE "ProjectEstimateGroup" ADD COLUMN IF NOT EXISTS "manualTotal" DECIMAL(14,2);
