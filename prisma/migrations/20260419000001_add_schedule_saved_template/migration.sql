CREATE TABLE "ScheduleSavedTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tasks" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScheduleSavedTemplate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ScheduleSavedTemplate_companyId_idx" ON "ScheduleSavedTemplate"("companyId");
