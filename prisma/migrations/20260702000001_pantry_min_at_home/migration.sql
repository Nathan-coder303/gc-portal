-- Per-item minimum threshold for at-home stock. When onHand < minAtHome,
-- the item auto-appears on the shopping list.
ALTER TABLE "PantryItem" ADD COLUMN "minAtHome" INTEGER NOT NULL DEFAULT 2;
