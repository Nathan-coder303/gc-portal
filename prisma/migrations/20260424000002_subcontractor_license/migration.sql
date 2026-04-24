-- Add licenseNumber field to SubContractor
ALTER TABLE "SubContractor" ADD COLUMN IF NOT EXISTS "licenseNumber" TEXT;
