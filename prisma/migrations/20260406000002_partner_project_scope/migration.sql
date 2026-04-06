ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
ALTER TABLE "Partner" ADD FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "Partner_projectId_idx" ON "Partner"("projectId");
