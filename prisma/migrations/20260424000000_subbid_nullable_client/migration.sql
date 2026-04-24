-- Make SubBid.clientId nullable to support TRIAGE bids (no project assigned yet)
ALTER TABLE "SubBid" ALTER COLUMN "clientId" DROP NOT NULL;
