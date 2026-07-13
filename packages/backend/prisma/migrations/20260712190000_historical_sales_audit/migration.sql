ALTER TABLE "daily_sales_summary"
  ADD COLUMN IF NOT EXISTS "import_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "imported_by" TEXT,
  ADD COLUMN IF NOT EXISTS "imported_at" TIMESTAMP(3);
