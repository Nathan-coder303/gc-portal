-- CreateTable
CREATE TABLE "DailySummary" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailySummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailySummary_companyId_date_idx" ON "DailySummary"("companyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailySummary_companyId_date_key" ON "DailySummary"("companyId", "date");

-- AddForeignKey
ALTER TABLE "DailySummary" ADD CONSTRAINT "DailySummary_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
