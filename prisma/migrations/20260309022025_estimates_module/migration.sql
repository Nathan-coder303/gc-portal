-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EntityType" ADD VALUE 'ESTIMATE_TEMPLATE';
ALTER TYPE "EntityType" ADD VALUE 'PROJECT_ESTIMATE';

-- CreateTable
CREATE TABLE "EstimateTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "archivedAt" TIMESTAMP(3),
    "archivedBy" TEXT,

    CONSTRAINT "EstimateTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimateTemplateDivision" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "csiCode" TEXT,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "archivedBy" TEXT,

    CONSTRAINT "EstimateTemplateDivision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimateTemplateGroup" (
    "id" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "archivedBy" TEXT,

    CONSTRAINT "EstimateTemplateGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimateTemplateItem" (
    "id" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "groupId" TEXT,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "defaultQty" DECIMAL(14,4),
    "defaultUnitCost" DECIMAL(14,2),
    "defaultLaborCost" DECIMAL(14,2),
    "defaultMaterialCost" DECIMAL(14,2),
    "defaultMarkupPct" DECIMAL(5,2),
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "archivedBy" TEXT,

    CONSTRAINT "EstimateTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectEstimate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "templateId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "archivedAt" TIMESTAMP(3),
    "archivedBy" TEXT,

    CONSTRAINT "ProjectEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectEstimateDivision" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "csiCode" TEXT,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "archivedBy" TEXT,

    CONSTRAINT "ProjectEstimateDivision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectEstimateGroup" (
    "id" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "archivedBy" TEXT,

    CONSTRAINT "ProjectEstimateGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectEstimateItem" (
    "id" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "groupId" TEXT,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "qty" DECIMAL(14,4) NOT NULL DEFAULT 1,
    "unitCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "laborCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "materialCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "markupPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "manualTotal" DECIMAL(14,2),
    "vendor" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "archivedBy" TEXT,

    CONSTRAINT "ProjectEstimateItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EstimateTemplate_companyId_idx" ON "EstimateTemplate"("companyId");

-- CreateIndex
CREATE INDEX "EstimateTemplateDivision_templateId_idx" ON "EstimateTemplateDivision"("templateId");

-- CreateIndex
CREATE INDEX "EstimateTemplateGroup_divisionId_idx" ON "EstimateTemplateGroup"("divisionId");

-- CreateIndex
CREATE INDEX "EstimateTemplateItem_divisionId_idx" ON "EstimateTemplateItem"("divisionId");

-- CreateIndex
CREATE INDEX "EstimateTemplateItem_groupId_idx" ON "EstimateTemplateItem"("groupId");

-- CreateIndex
CREATE INDEX "ProjectEstimate_projectId_idx" ON "ProjectEstimate"("projectId");

-- CreateIndex
CREATE INDEX "ProjectEstimateDivision_estimateId_idx" ON "ProjectEstimateDivision"("estimateId");

-- CreateIndex
CREATE INDEX "ProjectEstimateGroup_divisionId_idx" ON "ProjectEstimateGroup"("divisionId");

-- CreateIndex
CREATE INDEX "ProjectEstimateItem_divisionId_idx" ON "ProjectEstimateItem"("divisionId");

-- CreateIndex
CREATE INDEX "ProjectEstimateItem_groupId_idx" ON "ProjectEstimateItem"("groupId");

-- AddForeignKey
ALTER TABLE "EstimateTemplate" ADD CONSTRAINT "EstimateTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateTemplateDivision" ADD CONSTRAINT "EstimateTemplateDivision_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EstimateTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateTemplateGroup" ADD CONSTRAINT "EstimateTemplateGroup_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "EstimateTemplateDivision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateTemplateItem" ADD CONSTRAINT "EstimateTemplateItem_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "EstimateTemplateDivision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateTemplateItem" ADD CONSTRAINT "EstimateTemplateItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "EstimateTemplateGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEstimate" ADD CONSTRAINT "ProjectEstimate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEstimate" ADD CONSTRAINT "ProjectEstimate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EstimateTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEstimateDivision" ADD CONSTRAINT "ProjectEstimateDivision_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "ProjectEstimate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEstimateGroup" ADD CONSTRAINT "ProjectEstimateGroup_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "ProjectEstimateDivision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEstimateItem" ADD CONSTRAINT "ProjectEstimateItem_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "ProjectEstimateDivision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEstimateItem" ADD CONSTRAINT "ProjectEstimateItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProjectEstimateGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
