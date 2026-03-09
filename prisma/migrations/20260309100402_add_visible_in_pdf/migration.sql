-- AlterTable
ALTER TABLE "EstimateTemplateItem" ADD COLUMN     "visibleInPdf" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ProjectEstimateItem" ADD COLUMN     "visibleInPdf" BOOLEAN NOT NULL DEFAULT true;
