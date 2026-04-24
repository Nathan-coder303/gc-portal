-- Add address field to SubContractor
ALTER TABLE "SubContractor" ADD COLUMN IF NOT EXISTS "address" TEXT;
