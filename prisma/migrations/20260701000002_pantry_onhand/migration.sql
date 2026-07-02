-- Track how many of each item we have at home. Staples with onHand < 2
-- auto-appear on the shopping list.
ALTER TABLE "PantryItem" ADD COLUMN "onHand" INTEGER NOT NULL DEFAULT 0;
