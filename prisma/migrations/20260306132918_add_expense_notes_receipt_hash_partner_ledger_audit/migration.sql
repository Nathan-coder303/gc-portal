-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "isPossibleDup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "receiptHash" TEXT;

-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "isReversal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reversesId" TEXT;

-- AlterTable
ALTER TABLE "Partner" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "ownershipPct" DECIMAL(5,2),
ADD COLUMN     "role" TEXT;

-- CreateTable
CREATE TABLE "TaskChangeLog" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskChangeLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TaskChangeLog" ADD CONSTRAINT "TaskChangeLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
