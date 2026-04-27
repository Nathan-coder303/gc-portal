-- AlterTable
ALTER TABLE "SubBid" ADD COLUMN "projectId" TEXT;

-- CreateIndex
CREATE INDEX "SubBid_projectId_idx" ON "SubBid"("projectId");

-- AddForeignKey
ALTER TABLE "SubBid" ADD CONSTRAINT "SubBid_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
