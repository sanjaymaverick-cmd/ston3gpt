ALTER TABLE "inventory_movement"
  DROP CONSTRAINT IF EXISTS "inventory_movement_quantity_non_negative";

ALTER TABLE "inventory_movement"
  ADD CONSTRAINT "inventory_movement_quantity_positive" CHECK ("quantity" > 0);
