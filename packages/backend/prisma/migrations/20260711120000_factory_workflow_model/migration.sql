-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('owner', 'manager', 'supervisor', 'operator', 'accountant', 'auditor', 'admin', 'inventory', 'sales');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('invoiced', 'cash', 'mixed');

-- CreateEnum
CREATE TYPE "FactoryOperatingStatus" AS ENUM ('SETUP', 'OPENING_COUNT_IN_PROGRESS', 'OPENING_PENDING_APPROVAL', 'LIVE', 'LOCKED');

-- CreateEnum
CREATE TYPE "InventorySourceType" AS ENUM ('OPENING_INVENTORY', 'GOODS_RECEIPT', 'PRODUCTION_COMPLETION', 'CUSTOMER_RETURN', 'APPROVED_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "OwnershipType" AS ENUM ('COMPANY_OWNED', 'CONSIGNMENT', 'CUSTOMER_OWNED', 'UNKNOWN_LEGACY');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('DRAFT', 'PHYSICALLY_VERIFIED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BlockProductionStage" AS ENUM ('RAW', 'RESERVED_FOR_CUTTING', 'UNDER_CUTTING', 'CONSUMED', 'SOLD_AS_BLOCK', 'REJECTED');

-- CreateEnum
CREATE TYPE "SlabProductionStage" AS ENUM ('CUT_UNPOLISHED', 'RESERVED_FOR_POLISHING', 'UNDER_POLISHING', 'POLISHED');

-- CreateEnum
CREATE TYPE "InventoryStatus" AS ENUM ('DRAFT', 'AVAILABLE', 'RESERVED', 'HOLD', 'DELIVERED', 'CONSUMED', 'SCRAPPED');

-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'RELEASED', 'CONSUMED');

-- CreateEnum
CREATE TYPE "ReservationPurpose" AS ENUM ('CUTTING', 'POLISHING', 'SALES');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('OPENING_RECEIPT', 'GOODS_RECEIPT', 'TRANSFER', 'PRODUCTION_ISSUE', 'PRODUCTION_COMPLETION', 'POLISHING_ISSUE', 'POLISHING_COMPLETION', 'SALES_RESERVATION', 'RESERVATION_RELEASE', 'DELIVERY', 'RETURN', 'ADJUSTMENT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "InventoryLocationType" AS ENUM ('RAW_YARD', 'B21_QUEUE', 'B21_WIP', 'UNPOLISHED_STOCK', 'LPM_QUEUE', 'LPM_WIP', 'FINISHED_STOCK', 'HOLD', 'DELIVERED');

-- CreateEnum
CREATE TYPE "OpeningSnapshotStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'LOCKED');

-- CreateEnum
CREATE TYPE "InventoryKind" AS ENUM ('RAW_BLOCK', 'B21_WIP', 'UNPOLISHED_SLAB', 'POLISHED_SLAB');

-- CreateEnum
CREATE TYPE "SlabLineageStatus" AS ENUM ('LIVE_PARENTED', 'LEGACY_KNOWN', 'LEGACY_UNKNOWN');

-- CreateEnum
CREATE TYPE "MachineType" AS ENUM ('CUTTING', 'POLISHING');

-- CreateEnum
CREATE TYPE "ProductionSessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABORTED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GoodsReceiptStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateTable
CREATE TABLE "factory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operating_status" "FactoryOperatingStatus" NOT NULL DEFAULT 'SETUP',
    "go_live_date" TIMESTAMP(3),
    "opening_snapshot_approved_at" TIMESTAMP(3),
    "opening_snapshot_approved_by" TEXT,
    "backdate_lock_date" DATE,

    CONSTRAINT "factory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_location" (
    "id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location_type" "InventoryLocationType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_user" (
    "id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier" (
    "id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact_info" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer" (
    "id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact_info" TEXT,
    "credit_limit" DECIMAL(14,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine" (
    "id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "machine_type" "MachineType" NOT NULL,
    "blade_count" INTEGER,
    "head_count" INTEGER,
    "abrasives_per_head" INTEGER,
    "installed_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "machine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cutting_session" (
    "id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "raw_block_id" TEXT NOT NULL,
    "machine_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "status" "ProductionSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "block_reservation_id" TEXT,
    "expected_slab_count" INTEGER,
    "total_slabs_cut" INTEGER,
    "final_good_slab_count" INTEGER,
    "damaged_slab_count" INTEGER,
    "wastage_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cutting_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cutting_day_log" (
    "id" TEXT NOT NULL,
    "cutting_session_id" TEXT NOT NULL,
    "operational_date" DATE NOT NULL,
    "runtime_hours" DECIMAL(4,2),
    "power_cut_minutes" INTEGER,
    "downtime_minutes" INTEGER,
    "downtime_reason" TEXT,
    "power_consumption_kwh" DECIMAL(10,2),
    "slabs_produced_count" INTEGER,
    "operator_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cutting_day_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "polishing_session" (
    "id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "machine_id" TEXT NOT NULL,
    "operational_date" DATE NOT NULL,
    "finish_type" TEXT NOT NULL,
    "slabs_polished_count" INTEGER,
    "runtime_hours" DECIMAL(4,2),
    "power_consumption_kwh" DECIMAL(10,2),
    "downtime_minutes" INTEGER,
    "downtime_reason" TEXT,
    "operator_id" TEXT,
    "notes" TEXT,
    "status" "ProductionSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "polishing_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "polishing_session_slab" (
    "id" TEXT NOT NULL,
    "polishing_session_id" TEXT NOT NULL,
    "slab_id" TEXT NOT NULL,

    CONSTRAINT "polishing_session_slab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle" (
    "id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vehicle_type" TEXT,
    "purchase_date" DATE,
    "retired_date" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_block" (
    "id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "serial_number" TEXT NOT NULL,
    "legacy_serial_number" TEXT,
    "variety_name" TEXT NOT NULL,
    "supplier_id" TEXT,
    "weight_tons" DECIMAL(10,3),
    "purchase_date" DATE,
    "invoiced_amount" DECIMAL(14,2),
    "actual_amount_paid" DECIMAL(14,2),
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    "current_status" TEXT NOT NULL DEFAULT 'in_stock',
    "current_location" TEXT,
    "ownership_type" "OwnershipType" NOT NULL DEFAULT 'COMPANY_OWNED',
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'DRAFT',
    "production_stage" "BlockProductionStage" NOT NULL DEFAULT 'RAW',
    "inventory_status" "InventoryStatus" NOT NULL DEFAULT 'DRAFT',
    "location_id" TEXT,
    "inventory_source_type" "InventorySourceType",
    "opening_inventory_line_id" TEXT,
    "goods_receipt_line_id" TEXT,
    "information_confidence" TEXT NOT NULL DEFAULT 'NORMAL',
    "physically_verified_by" TEXT,
    "physically_verified_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_block_photo" (
    "id" TEXT NOT NULL,
    "raw_block_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_block_photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "block_state_transition" (
    "id" TEXT NOT NULL,
    "raw_block_id" TEXT NOT NULL,
    "from_state" TEXT,
    "to_state" TEXT NOT NULL,
    "machine_id" TEXT,
    "user_id" TEXT,
    "notes" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "block_state_transition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slab" (
    "id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "parent_block_id" TEXT,
    "cutting_session_id" TEXT,
    "slab_serial" TEXT NOT NULL,
    "variety_name" TEXT NOT NULL,
    "thickness_mm" DECIMAL(5,2) NOT NULL DEFAULT 18.0,
    "length_ft" DECIMAL(6,2),
    "width_ft" DECIMAL(6,2),
    "finish" TEXT,
    "quality_note" TEXT,
    "current_location" TEXT,
    "sales_status" TEXT NOT NULL DEFAULT 'in_stock',
    "production_stage" "SlabProductionStage" NOT NULL DEFAULT 'CUT_UNPOLISHED',
    "inventory_status" "InventoryStatus" NOT NULL DEFAULT 'DRAFT',
    "location_id" TEXT,
    "inventory_source_type" "InventorySourceType",
    "opening_inventory_line_id" TEXT,
    "lineage_status" "SlabLineageStatus" NOT NULL DEFAULT 'LIVE_PARENTED',
    "polish_finish_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slab_photo" (
    "id" TEXT NOT NULL,
    "slab_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slab_photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slab_state_transition" (
    "id" TEXT NOT NULL,
    "slab_id" TEXT NOT NULL,
    "from_state" TEXT,
    "to_state" TEXT NOT NULL,
    "machine_id" TEXT,
    "user_id" TEXT,
    "notes" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slab_state_transition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_runtime_log" (
    "id" TEXT NOT NULL,
    "machine_id" TEXT NOT NULL,
    "log_date" DATE NOT NULL,
    "runtime_minutes" INTEGER,
    "downtime_minutes" INTEGER,
    "downtime_reason" TEXT,
    "operator_id" TEXT,
    "power_consumption_kwh" DECIMAL(10,2),
    "blade_or_head_usage" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "machine_runtime_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_production_report" (
    "id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "report_date" DATE NOT NULL,
    "department" TEXT NOT NULL,
    "production_qty" DECIMAL(10,2),
    "production_value" DECIMAL(14,2),
    "machine_utilisation_pct" DECIMAL(5,2),
    "recovery_pct" DECIMAL(5,2),
    "rejection_pct" DECIMAL(5,2),
    "rework_pct" DECIMAL(5,2),
    "downtime_minutes" INTEGER,
    "labour_hours" DECIMAL(8,2),
    "labour_headcount" INTEGER,
    "raw_block_consumption" DECIMAL(10,3),
    "finished_slab_count" INTEGER,
    "dispatch_qty" DECIMAL(10,2),
    "is_derived" BOOLEAN NOT NULL DEFAULT true,
    "manual_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_production_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumable" (
    "id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consumable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumable_purchase" (
    "id" TEXT NOT NULL,
    "consumable_id" TEXT NOT NULL,
    "quantity" DECIMAL(10,2),
    "invoiced_amount" DECIMAL(14,2),
    "actual_amount_paid" DECIMAL(14,2),
    "purchase_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consumable_purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumable_usage_log" (
    "id" TEXT NOT NULL,
    "consumable_id" TEXT NOT NULL,
    "machine_id" TEXT,
    "quantity_used" DECIMAL(10,2),
    "usage_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consumable_usage_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice" (
    "id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "invoice_date" DATE NOT NULL,
    "invoiced_amount" DECIMAL(14,2) NOT NULL,
    "gst_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "invoice_id" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "payment_mode" TEXT,
    "payment_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order" (
    "id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "order_date" DATE NOT NULL,
    "invoice_id" TEXT,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_line_item" (
    "id" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "slab_id" TEXT,
    "variety_name" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "gst_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "loading_charge" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "transport_charge" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "invoiced_amount" DECIMAL(14,2),
    "actual_amount_received" DECIMAL(14,2),
    "payment_type" "PaymentType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_line_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_sales_summary" (
    "id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "summary_date" DATE NOT NULL,
    "total_qty_sqft" DECIMAL(12,2),
    "invoiced_amount" DECIMAL(14,2),
    "actual_amount_received" DECIMAL(14,2),
    "is_derived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_sales_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense" (
    "id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "vehicle_id" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "to_whom" TEXT,
    "expense_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_allocation" (
    "id" TEXT NOT NULL,
    "expense_id" TEXT NOT NULL,
    "raw_block_id" TEXT,
    "allocated_amount" DECIMAL(14,2) NOT NULL,
    "allocation_method" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tally_import_batch" (
    "id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "source_file" TEXT,
    "import_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "period_start" DATE,
    "period_end" DATE,

    CONSTRAINT "tally_import_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tally_ledger_entry" (
    "id" TEXT NOT NULL,
    "tally_import_batch_id" TEXT NOT NULL,
    "voucher_type" TEXT,
    "entry_date" DATE,
    "account" TEXT,
    "debit" DECIMAL(14,2),
    "credit" DECIMAL(14,2),
    "narration" TEXT,

    CONSTRAINT "tally_ledger_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tally_trial_balance_snapshot" (
    "id" TEXT NOT NULL,
    "tally_import_batch_id" TEXT NOT NULL,
    "account" TEXT,
    "debit" DECIMAL(14,2),
    "credit" DECIMAL(14,2),

    CONSTRAINT "tally_trial_balance_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_snapshot" (
    "id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "item_type" TEXT NOT NULL,
    "quantity_on_hand" DECIMAL(12,2),
    "value_on_hand" DECIMAL(14,2),
    "days_since_last_movement" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utility_reading" (
    "id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "reading_date" DATE NOT NULL,
    "solar_generation_kwh" DECIMAL(10,2),
    "grid_export_kwh" DECIMAL(10,2),
    "grid_import_kwh" DECIMAL(10,2),
    "machine_consumption_kwh" DECIMAL(10,2),
    "power_cut_minutes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "utility_reading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opening_inventory_snapshot" (
    "id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "count_date" DATE NOT NULL,
    "status" "OpeningSnapshotStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by" TEXT NOT NULL,
    "submitted_by" TEXT,
    "submitted_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejected_by" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opening_inventory_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opening_inventory_line" (
    "id" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "inventory_kind" "InventoryKind" NOT NULL,
    "raw_block_id" TEXT,
    "slab_id" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "area_sqft" DECIMAL(12,2),
    "opening_value" DECIMAL(14,2),
    "location_id" TEXT NOT NULL,
    "ownership_type" "OwnershipType" NOT NULL,
    "verification_status" "VerificationStatus" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opening_inventory_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movement" (
    "id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "movement_type" "InventoryMovementType" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw_block_id" TEXT,
    "slab_id" TEXT,
    "from_location_id" TEXT,
    "to_location_id" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "area_sqft" DECIMAL(12,2),
    "reference_type" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "reverses_movement_id" TEXT,
    "created_by" TEXT NOT NULL,
    "reason" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "cutting_session_id" TEXT,
    "polishing_session_id" TEXT,
    "opening_inventory_line_id" TEXT,
    "goods_receipt_line_id" TEXT,
    "delivery_line_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_reservation" (
    "id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "raw_block_id" TEXT,
    "slab_id" TEXT,
    "purpose" "ReservationPurpose" NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "reference_type" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "released_by" TEXT,
    "consumed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMP(3),
    "consumed_at" TIMESTAMP(3),
    "polishing_session_id" TEXT,

    CONSTRAINT "inventory_reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_reservation" (
    "id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "sales_line_item_id" TEXT NOT NULL,
    "slab_id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery" (
    "id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "delivery_date" DATE NOT NULL,
    "vehicle_number" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_line" (
    "id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "slab_id" TEXT NOT NULL,
    "sales_reservation_id" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order" (
    "id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "supplier_id" TEXT,
    "order_date" DATE NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_line" (
    "id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "raw_block_id" TEXT,
    "variety_name" TEXT NOT NULL,
    "expected_weight_tons" DECIMAL(10,3),
    "expected_amount" DECIMAL(14,2),

    CONSTRAINT "purchase_order_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt" (
    "id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "supplier_id" TEXT,
    "purchase_order_id" TEXT,
    "receipt_date" DATE NOT NULL,
    "status" "GoodsReceiptStatus" NOT NULL DEFAULT 'DRAFT',
    "submitted_by" TEXT,
    "submitted_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goods_receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_line" (
    "id" TEXT NOT NULL,
    "goods_receipt_id" TEXT NOT NULL,
    "raw_block_id" TEXT,
    "serial_number" TEXT NOT NULL,
    "legacy_serial_number" TEXT,
    "variety_name" TEXT NOT NULL,
    "weight_tons" DECIMAL(10,3),
    "location_id" TEXT NOT NULL,
    "ownership_type" "OwnershipType" NOT NULL DEFAULT 'COMPANY_OWNED',
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PHYSICALLY_VERIFIED',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goods_receipt_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_invoice" (
    "id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "goods_receipt_id" TEXT,
    "invoice_number" TEXT NOT NULL,
    "invoice_date" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_invoice_line" (
    "id" TEXT NOT NULL,
    "supplier_invoice_id" TEXT NOT NULL,
    "goods_receipt_line_id" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "supplier_invoice_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_payment" (
    "id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "supplier_invoice_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "payment_date" DATE NOT NULL,
    "payment_mode" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_location_factory_id_code_key" ON "inventory_location"("factory_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_email_key" ON "app_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "cutting_day_log_cutting_session_id_operational_date_key" ON "cutting_day_log"("cutting_session_id", "operational_date");

-- CreateIndex
CREATE UNIQUE INDEX "polishing_session_slab_polishing_session_id_slab_id_key" ON "polishing_session_slab"("polishing_session_id", "slab_id");

-- CreateIndex
CREATE UNIQUE INDEX "raw_block_opening_inventory_line_id_key" ON "raw_block"("opening_inventory_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "raw_block_factory_id_serial_number_key" ON "raw_block"("factory_id", "serial_number");

-- CreateIndex
CREATE UNIQUE INDEX "slab_opening_inventory_line_id_key" ON "slab"("opening_inventory_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "slab_factory_id_slab_serial_key" ON "slab"("factory_id", "slab_serial");

-- CreateIndex
CREATE UNIQUE INDEX "machine_runtime_log_machine_id_log_date_key" ON "machine_runtime_log"("machine_id", "log_date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_production_report_factory_id_report_date_department_key" ON "daily_production_report"("factory_id", "report_date", "department");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_factory_id_invoice_number_key" ON "invoice"("factory_id", "invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "sales_line_item_sales_order_id_slab_id_key" ON "sales_line_item"("sales_order_id", "slab_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_sales_summary_factory_id_summary_date_key" ON "daily_sales_summary"("factory_id", "summary_date");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_snapshot_factory_id_snapshot_date_item_type_key" ON "inventory_snapshot"("factory_id", "snapshot_date", "item_type");

-- CreateIndex
CREATE INDEX "inventory_movement_factory_id_raw_block_id_idx" ON "inventory_movement"("factory_id", "raw_block_id");

-- CreateIndex
CREATE INDEX "inventory_movement_factory_id_slab_id_idx" ON "inventory_movement"("factory_id", "slab_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_movement_factory_id_idempotency_key_key" ON "inventory_movement"("factory_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "inventory_reservation_factory_id_raw_block_id_status_idx" ON "inventory_reservation"("factory_id", "raw_block_id", "status");

-- CreateIndex
CREATE INDEX "inventory_reservation_factory_id_slab_id_status_idx" ON "inventory_reservation"("factory_id", "slab_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sales_reservation_sales_line_item_id_key" ON "sales_reservation"("sales_line_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_reservation_reservation_id_key" ON "sales_reservation"("reservation_id");

-- CreateIndex
CREATE INDEX "sales_reservation_factory_id_slab_id_status_idx" ON "sales_reservation"("factory_id", "slab_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_line_delivery_id_slab_id_key" ON "delivery_line"("delivery_id", "slab_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_invoice_factory_id_invoice_number_key" ON "supplier_invoice"("factory_id", "invoice_number");

-- AddForeignKey
ALTER TABLE "inventory_location" ADD CONSTRAINT "inventory_location_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier" ADD CONSTRAINT "supplier_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine" ADD CONSTRAINT "machine_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_session" ADD CONSTRAINT "cutting_session_raw_block_id_fkey" FOREIGN KEY ("raw_block_id") REFERENCES "raw_block"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_session" ADD CONSTRAINT "cutting_session_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_session" ADD CONSTRAINT "cutting_session_block_reservation_id_fkey" FOREIGN KEY ("block_reservation_id") REFERENCES "inventory_reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_day_log" ADD CONSTRAINT "cutting_day_log_cutting_session_id_fkey" FOREIGN KEY ("cutting_session_id") REFERENCES "cutting_session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polishing_session" ADD CONSTRAINT "polishing_session_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polishing_session_slab" ADD CONSTRAINT "polishing_session_slab_polishing_session_id_fkey" FOREIGN KEY ("polishing_session_id") REFERENCES "polishing_session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polishing_session_slab" ADD CONSTRAINT "polishing_session_slab_slab_id_fkey" FOREIGN KEY ("slab_id") REFERENCES "slab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_block" ADD CONSTRAINT "raw_block_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_block" ADD CONSTRAINT "raw_block_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_block" ADD CONSTRAINT "raw_block_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "inventory_location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_block" ADD CONSTRAINT "raw_block_opening_inventory_line_id_fkey" FOREIGN KEY ("opening_inventory_line_id") REFERENCES "opening_inventory_line"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_block" ADD CONSTRAINT "raw_block_goods_receipt_line_id_fkey" FOREIGN KEY ("goods_receipt_line_id") REFERENCES "goods_receipt_line"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_block_photo" ADD CONSTRAINT "raw_block_photo_raw_block_id_fkey" FOREIGN KEY ("raw_block_id") REFERENCES "raw_block"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "block_state_transition" ADD CONSTRAINT "block_state_transition_raw_block_id_fkey" FOREIGN KEY ("raw_block_id") REFERENCES "raw_block"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "block_state_transition" ADD CONSTRAINT "block_state_transition_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slab" ADD CONSTRAINT "slab_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slab" ADD CONSTRAINT "slab_parent_block_id_fkey" FOREIGN KEY ("parent_block_id") REFERENCES "raw_block"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slab" ADD CONSTRAINT "slab_cutting_session_id_fkey" FOREIGN KEY ("cutting_session_id") REFERENCES "cutting_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slab" ADD CONSTRAINT "slab_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "inventory_location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slab" ADD CONSTRAINT "slab_opening_inventory_line_id_fkey" FOREIGN KEY ("opening_inventory_line_id") REFERENCES "opening_inventory_line"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slab_photo" ADD CONSTRAINT "slab_photo_slab_id_fkey" FOREIGN KEY ("slab_id") REFERENCES "slab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slab_state_transition" ADD CONSTRAINT "slab_state_transition_slab_id_fkey" FOREIGN KEY ("slab_id") REFERENCES "slab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slab_state_transition" ADD CONSTRAINT "slab_state_transition_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_runtime_log" ADD CONSTRAINT "machine_runtime_log_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_production_report" ADD CONSTRAINT "daily_production_report_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumable" ADD CONSTRAINT "consumable_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumable_purchase" ADD CONSTRAINT "consumable_purchase_consumable_id_fkey" FOREIGN KEY ("consumable_id") REFERENCES "consumable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumable_usage_log" ADD CONSTRAINT "consumable_usage_log_consumable_id_fkey" FOREIGN KEY ("consumable_id") REFERENCES "consumable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumable_usage_log" ADD CONSTRAINT "consumable_usage_log_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order" ADD CONSTRAINT "sales_order_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order" ADD CONSTRAINT "sales_order_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order" ADD CONSTRAINT "sales_order_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_line_item" ADD CONSTRAINT "sales_line_item_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_line_item" ADD CONSTRAINT "sales_line_item_slab_id_fkey" FOREIGN KEY ("slab_id") REFERENCES "slab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_sales_summary" ADD CONSTRAINT "daily_sales_summary_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_allocation" ADD CONSTRAINT "expense_allocation_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_allocation" ADD CONSTRAINT "expense_allocation_raw_block_id_fkey" FOREIGN KEY ("raw_block_id") REFERENCES "raw_block"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tally_import_batch" ADD CONSTRAINT "tally_import_batch_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tally_ledger_entry" ADD CONSTRAINT "tally_ledger_entry_tally_import_batch_id_fkey" FOREIGN KEY ("tally_import_batch_id") REFERENCES "tally_import_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tally_trial_balance_snapshot" ADD CONSTRAINT "tally_trial_balance_snapshot_tally_import_batch_id_fkey" FOREIGN KEY ("tally_import_batch_id") REFERENCES "tally_import_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_snapshot" ADD CONSTRAINT "inventory_snapshot_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utility_reading" ADD CONSTRAINT "utility_reading_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_inventory_snapshot" ADD CONSTRAINT "opening_inventory_snapshot_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_inventory_line" ADD CONSTRAINT "opening_inventory_line_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "opening_inventory_snapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_inventory_line" ADD CONSTRAINT "opening_inventory_line_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "inventory_location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_raw_block_id_fkey" FOREIGN KEY ("raw_block_id") REFERENCES "raw_block"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_slab_id_fkey" FOREIGN KEY ("slab_id") REFERENCES "slab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "inventory_location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "inventory_location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_reverses_movement_id_fkey" FOREIGN KEY ("reverses_movement_id") REFERENCES "inventory_movement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_cutting_session_id_fkey" FOREIGN KEY ("cutting_session_id") REFERENCES "cutting_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_polishing_session_id_fkey" FOREIGN KEY ("polishing_session_id") REFERENCES "polishing_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_opening_inventory_line_id_fkey" FOREIGN KEY ("opening_inventory_line_id") REFERENCES "opening_inventory_line"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_goods_receipt_line_id_fkey" FOREIGN KEY ("goods_receipt_line_id") REFERENCES "goods_receipt_line"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_delivery_line_id_fkey" FOREIGN KEY ("delivery_line_id") REFERENCES "delivery_line"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservation" ADD CONSTRAINT "inventory_reservation_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservation" ADD CONSTRAINT "inventory_reservation_raw_block_id_fkey" FOREIGN KEY ("raw_block_id") REFERENCES "raw_block"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservation" ADD CONSTRAINT "inventory_reservation_slab_id_fkey" FOREIGN KEY ("slab_id") REFERENCES "slab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservation" ADD CONSTRAINT "inventory_reservation_polishing_session_id_fkey" FOREIGN KEY ("polishing_session_id") REFERENCES "polishing_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_reservation" ADD CONSTRAINT "sales_reservation_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_reservation" ADD CONSTRAINT "sales_reservation_sales_line_item_id_fkey" FOREIGN KEY ("sales_line_item_id") REFERENCES "sales_line_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_reservation" ADD CONSTRAINT "sales_reservation_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "inventory_reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery" ADD CONSTRAINT "delivery_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery" ADD CONSTRAINT "delivery_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_line" ADD CONSTRAINT "delivery_line_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "delivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_line" ADD CONSTRAINT "delivery_line_slab_id_fkey" FOREIGN KEY ("slab_id") REFERENCES "slab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_line" ADD CONSTRAINT "purchase_order_line_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_line" ADD CONSTRAINT "purchase_order_line_raw_block_id_fkey" FOREIGN KEY ("raw_block_id") REFERENCES "raw_block"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt" ADD CONSTRAINT "goods_receipt_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt" ADD CONSTRAINT "goods_receipt_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt" ADD CONSTRAINT "goods_receipt_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_line" ADD CONSTRAINT "goods_receipt_line_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_line" ADD CONSTRAINT "goods_receipt_line_raw_block_id_fkey" FOREIGN KEY ("raw_block_id") REFERENCES "raw_block"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_line" ADD CONSTRAINT "goods_receipt_line_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "inventory_location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoice" ADD CONSTRAINT "supplier_invoice_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoice" ADD CONSTRAINT "supplier_invoice_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoice" ADD CONSTRAINT "supplier_invoice_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoice_line" ADD CONSTRAINT "supplier_invoice_line_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "supplier_invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payment" ADD CONSTRAINT "supplier_payment_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payment" ADD CONSTRAINT "supplier_payment_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "supplier_invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Database-backed workflow safeguards that Prisma cannot express directly.
CREATE UNIQUE INDEX "one_active_block_reservation"
  ON "inventory_reservation"("factory_id", "raw_block_id")
  WHERE "status" = 'ACTIVE' AND "raw_block_id" IS NOT NULL;

CREATE UNIQUE INDEX "one_active_slab_reservation"
  ON "inventory_reservation"("factory_id", "slab_id")
  WHERE "status" = 'ACTIVE' AND "slab_id" IS NOT NULL;

CREATE UNIQUE INDEX "one_active_cutting_session_per_block"
  ON "cutting_session"("factory_id", "raw_block_id")
  WHERE "status" = 'IN_PROGRESS';

ALTER TABLE "inventory_movement"
  ADD CONSTRAINT "inventory_movement_quantity_non_negative" CHECK ("quantity" >= 0);

ALTER TABLE "opening_inventory_line"
  ADD CONSTRAINT "opening_inventory_line_count_non_negative" CHECK ("count" >= 0);

ALTER TABLE "cutting_session"
  ADD CONSTRAINT "cutting_counts_non_negative" CHECK (
    ("total_slabs_cut" IS NULL OR "total_slabs_cut" >= 0)
    AND ("final_good_slab_count" IS NULL OR "final_good_slab_count" >= 0)
    AND ("damaged_slab_count" IS NULL OR "damaged_slab_count" >= 0)
  );
