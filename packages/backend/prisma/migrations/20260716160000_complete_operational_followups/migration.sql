ALTER TABLE "cutting_session"
  ADD COLUMN "damaged_cost_amount" DECIMAL(14,2),
  ADD COLUMN "cost_allocation_basis" TEXT;

CREATE TABLE "cutting_day_log_revision" (
  "id" TEXT NOT NULL,
  "cutting_day_log_id" TEXT NOT NULL,
  "previous_data" JSONB NOT NULL,
  "correction_reason" TEXT NOT NULL,
  "corrected_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cutting_day_log_revision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cutting_day_log_revision_cutting_day_log_id_fkey" FOREIGN KEY ("cutting_day_log_id") REFERENCES "cutting_day_log"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "tally_inventory_entry" (
  "id" TEXT NOT NULL,
  "tally_import_batch_id" TEXT NOT NULL,
  "voucher_type" TEXT,
  "entry_date" DATE,
  "stock_item_name" TEXT NOT NULL,
  "quantity" DECIMAL(14,3),
  "unit" TEXT,
  "amount" DECIMAL(14,2),
  CONSTRAINT "tally_inventory_entry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tally_inventory_entry_tally_import_batch_id_fkey" FOREIGN KEY ("tally_import_batch_id") REFERENCES "tally_import_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "customer_return" (
  "id" TEXT NOT NULL,
  "factory_id" TEXT NOT NULL,
  "delivery_id" TEXT NOT NULL,
  "return_date" DATE NOT NULL,
  "reason" TEXT NOT NULL,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_return_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_return_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "customer_return_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "delivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "customer_return_line" (
  "id" TEXT NOT NULL,
  "customer_return_id" TEXT NOT NULL,
  "slab_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_return_line_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_return_line_customer_return_id_fkey" FOREIGN KEY ("customer_return_id") REFERENCES "customer_return"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "customer_return_line_slab_id_fkey" FOREIGN KEY ("slab_id") REFERENCES "slab"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "customer_return_line_customer_return_id_slab_id_key" ON "customer_return_line"("customer_return_id", "slab_id");
