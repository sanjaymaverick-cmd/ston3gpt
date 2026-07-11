INSERT INTO "factory" ("id", "name", "location") VALUES
  ('factory-legacy-test', 'Legacy Test Factory', 'Test Yard');

INSERT INTO "machine" ("id", "factory_id", "name", "machine_type", "blade_count", "head_count", "abrasives_per_head") VALUES
  ('machine-b21-legacy', 'factory-legacy-test', 'B-21', 'cutting', 21, NULL, NULL),
  ('machine-lpm-legacy', 'factory-legacy-test', 'LPM', 'polishing', NULL, 16, 6);

INSERT INTO "customer" ("id", "factory_id", "name") VALUES
  ('customer-legacy-test', 'factory-legacy-test', 'Legacy Customer');

INSERT INTO "supplier" ("id", "factory_id", "name") VALUES
  ('supplier-legacy-test', 'factory-legacy-test', 'Legacy Supplier');

INSERT INTO "raw_block" (
  "id", "factory_id", "serial_number", "variety_name", "supplier_id", "weight_tons",
  "current_status", "current_location"
) VALUES
  ('block-legacy-in-stock', 'factory-legacy-test', 'LEG-IN', 'Legacy Granite', 'supplier-legacy-test', 1.250, 'in_stock', 'Old Yard'),
  ('block-legacy-under-cutting', 'factory-legacy-test', 'LEG-CUTTING', 'Legacy Granite', NULL, 1.100, 'under_cutting', 'B-21'),
  ('block-legacy-cut', 'factory-legacy-test', 'LEG-CONSUMED', 'Legacy Granite', NULL, 1.000, 'cut', 'B-21');

INSERT INTO "cutting_session" (
  "id", "factory_id", "raw_block_id", "machine_id", "started_at", "status"
) VALUES
  ('cutting-legacy-active', 'factory-legacy-test', 'block-legacy-under-cutting', 'machine-b21-legacy', now(), 'in_progress');

INSERT INTO "slab" (
  "id", "factory_id", "parent_block_id", "cutting_session_id", "slab_serial",
  "variety_name", "sales_status", "current_location"
) VALUES
  ('slab-legacy-unpolished', 'factory-legacy-test', 'block-legacy-in-stock', NULL, 'LEG-SLAB-U', 'Legacy Granite', 'in_stock', 'Old Stock'),
  ('slab-legacy-polished', 'factory-legacy-test', 'block-legacy-in-stock', NULL, 'LEG-SLAB-P', 'Legacy Granite', 'polished', 'Old Finished'),
  ('slab-legacy-sold', 'factory-legacy-test', 'block-legacy-in-stock', NULL, 'LEG-SLAB-S', 'Legacy Granite', 'sold', 'Delivered');

INSERT INTO "invoice" ("id", "factory_id", "customer_id", "invoice_number", "invoice_date", "invoiced_amount") VALUES
  ('invoice-legacy-test', 'factory-legacy-test', 'customer-legacy-test', 'INV-LEG-1', current_date, 1000.00);

INSERT INTO "payment" ("id", "invoice_id", "amount", "payment_date", "payment_mode") VALUES
  ('payment-legacy-test', 'invoice-legacy-test', 1000.00, current_date, 'bank');

INSERT INTO "vehicle" ("id", "factory_id", "name", "active") VALUES
  ('vehicle-legacy-test', 'factory-legacy-test', 'Legacy Truck', true);

INSERT INTO "expense" ("id", "factory_id", "category", "vehicle_id", "amount", "expense_date") VALUES
  ('expense-legacy-test', 'factory-legacy-test', 'vehicle', 'vehicle-legacy-test', 500.00, current_date);

INSERT INTO "daily_sales_summary" (
  "id", "factory_id", "summary_date", "total_qty_sqft", "invoiced_amount", "actual_amount_received", "is_derived"
) VALUES
  ('summary-legacy-test', 'factory-legacy-test', current_date, 10.00, 1000.00, 1000.00, false);
