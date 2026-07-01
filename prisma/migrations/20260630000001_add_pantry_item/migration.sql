CREATE TABLE IF NOT EXISTS "PantryItem" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "done" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PantryItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PantryItem_userId_done_createdAt_idx" ON "PantryItem"("userId", "done", "createdAt");
