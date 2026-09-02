-- Backward-safe additions: legacy rows remain nullable, while every new service-layer
-- payment/allocation supplies a stable request key. The partial unique indexes make
-- retries race-safe without inventing keys for historical financial records.
ALTER TABLE "payment" ADD COLUMN "idempotency_key" TEXT;
ALTER TABLE "expense_allocation" ADD COLUMN "allocation_batch_key" TEXT;

CREATE UNIQUE INDEX "payment_factory_id_idempotency_key_key"
  ON "payment"("factory_id", "idempotency_key");

CREATE UNIQUE INDEX "expense_allocation_expense_id_allocation_batch_key_raw_block_id_key"
  ON "expense_allocation"("expense_id", "allocation_batch_key", "raw_block_id");

ALTER TABLE "payment"
  ADD CONSTRAINT "payment_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "expense_allocation"
  ADD CONSTRAINT "expense_allocation_amount_positive" CHECK ("allocated_amount" > 0);
