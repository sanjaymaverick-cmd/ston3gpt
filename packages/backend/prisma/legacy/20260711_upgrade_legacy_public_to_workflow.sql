-- Upgrade an existing pre-workflow StoneOS schema to the factory workflow model.
-- This script is intended to be tested on an isolated copy before being applied
-- to public. It is intentionally idempotent and maps legacy string state instead
-- of dropping status columns blindly.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FactoryOperatingStatus' AND typnamespace = current_schema()::regnamespace) THEN
    CREATE TYPE "FactoryOperatingStatus" AS ENUM ('SETUP', 'OPENING_COUNT_IN_PROGRESS', 'OPENING_PENDING_APPROVAL', 'LIVE', 'LOCKED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InventorySourceType' AND typnamespace = current_schema()::regnamespace) THEN
    CREATE TYPE "InventorySourceType" AS ENUM ('OPENING_INVENTORY', 'GOODS_RECEIPT', 'PRODUCTION_COMPLETION', 'CUSTOMER_RETURN', 'APPROVED_ADJUSTMENT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OwnershipType' AND typnamespace = current_schema()::regnamespace) THEN
    CREATE TYPE "OwnershipType" AS ENUM ('COMPANY_OWNED', 'CONSIGNMENT', 'CUSTOMER_OWNED', 'UNKNOWN_LEGACY');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VerificationStatus' AND typnamespace = current_schema()::regnamespace) THEN
    CREATE TYPE "VerificationStatus" AS ENUM ('DRAFT', 'PHYSICALLY_VERIFIED', 'APPROVED', 'REJECTED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BlockProductionStage' AND typnamespace = current_schema()::regnamespace) THEN
    CREATE TYPE "BlockProductionStage" AS ENUM ('RAW', 'RESERVED_FOR_CUTTING', 'UNDER_CUTTING', 'CONSUMED', 'SOLD_AS_BLOCK', 'REJECTED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SlabProductionStage' AND typnamespace = current_schema()::regnamespace) THEN
    CREATE TYPE "SlabProductionStage" AS ENUM ('CUT_UNPOLISHED', 'RESERVED_FOR_POLISHING', 'UNDER_POLISHING', 'POLISHED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InventoryStatus' AND typnamespace = current_schema()::regnamespace) THEN
    CREATE TYPE "InventoryStatus" AS ENUM ('DRAFT', 'AVAILABLE', 'RESERVED', 'HOLD', 'DELIVERED', 'CONSUMED', 'SCRAPPED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SalesOrderStatus' AND typnamespace = current_schema()::regnamespace) THEN
    CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReservationStatus' AND typnamespace = current_schema()::regnamespace) THEN
    CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'RELEASED', 'CONSUMED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReservationPurpose' AND typnamespace = current_schema()::regnamespace) THEN
    CREATE TYPE "ReservationPurpose" AS ENUM ('CUTTING', 'POLISHING', 'SALES');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InventoryMovementType' AND typnamespace = current_schema()::regnamespace) THEN
    CREATE TYPE "InventoryMovementType" AS ENUM ('OPENING_RECEIPT', 'GOODS_RECEIPT', 'TRANSFER', 'PRODUCTION_ISSUE', 'PRODUCTION_COMPLETION', 'POLISHING_ISSUE', 'POLISHING_COMPLETION', 'SALES_RESERVATION', 'RESERVATION_RELEASE', 'DELIVERY', 'RETURN', 'ADJUSTMENT', 'REVERSAL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InventoryLocationType' AND typnamespace = current_schema()::regnamespace) THEN
    CREATE TYPE "InventoryLocationType" AS ENUM ('RAW_YARD', 'B21_QUEUE', 'B21_WIP', 'UNPOLISHED_STOCK', 'LPM_QUEUE', 'LPM_WIP', 'FINISHED_STOCK', 'HOLD', 'DELIVERED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OpeningSnapshotStatus' AND typnamespace = current_schema()::regnamespace) THEN
    CREATE TYPE "OpeningSnapshotStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'LOCKED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InventoryKind' AND typnamespace = current_schema()::regnamespace) THEN
    CREATE TYPE "InventoryKind" AS ENUM ('RAW_BLOCK', 'B21_WIP', 'UNPOLISHED_SLAB', 'POLISHED_SLAB');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SlabLineageStatus' AND typnamespace = current_schema()::regnamespace) THEN
    CREATE TYPE "SlabLineageStatus" AS ENUM ('LIVE_PARENTED', 'LEGACY_KNOWN', 'LEGACY_UNKNOWN');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MachineType' AND typnamespace = current_schema()::regnamespace) THEN
    CREATE TYPE "MachineType" AS ENUM ('CUTTING', 'POLISHING');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductionSessionStatus' AND typnamespace = current_schema()::regnamespace) THEN
    CREATE TYPE "ProductionSessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABORTED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PurchaseOrderStatus' AND typnamespace = current_schema()::regnamespace) THEN
    CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GoodsReceiptStatus' AND typnamespace = current_schema()::regnamespace) THEN
    CREATE TYPE "GoodsReceiptStatus" AS ENUM ('DRAFT', 'SUBMITTED');
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole' AND typnamespace = current_schema()::regnamespace)
    AND NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'UserRole' AND t.typnamespace = current_schema()::regnamespace AND e.enumlabel = 'inventory'
    ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'inventory';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole' AND typnamespace = current_schema()::regnamespace)
    AND NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'UserRole' AND t.typnamespace = current_schema()::regnamespace AND e.enumlabel = 'sales'
    ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'sales';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "inventory_location" (
  "id" TEXT NOT NULL,
  "factory_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "location_type" "InventoryLocationType" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_location_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "opening_inventory_snapshot" (
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

CREATE TABLE IF NOT EXISTS "opening_inventory_line" (
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

CREATE TABLE IF NOT EXISTS "inventory_movement" (
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

CREATE TABLE IF NOT EXISTS "inventory_reservation" (
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

CREATE TABLE IF NOT EXISTS "sales_reservation" (
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

CREATE TABLE IF NOT EXISTS "delivery" (
  "id" TEXT NOT NULL,
  "factory_id" TEXT NOT NULL,
  "sales_order_id" TEXT NOT NULL,
  "delivery_date" DATE NOT NULL,
  "vehicle_number" TEXT,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "delivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "delivery_line" (
  "id" TEXT NOT NULL,
  "delivery_id" TEXT NOT NULL,
  "slab_id" TEXT NOT NULL,
  "sales_reservation_id" TEXT NOT NULL,
  "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "delivery_line_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "purchase_order" (
  "id" TEXT NOT NULL,
  "factory_id" TEXT NOT NULL,
  "supplier_id" TEXT,
  "order_date" DATE NOT NULL,
  "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "purchase_order_line" (
  "id" TEXT NOT NULL,
  "purchase_order_id" TEXT NOT NULL,
  "raw_block_id" TEXT,
  "variety_name" TEXT NOT NULL,
  "expected_weight_tons" DECIMAL(10,3),
  "expected_amount" DECIMAL(14,2),
  CONSTRAINT "purchase_order_line_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "goods_receipt" (
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

CREATE TABLE IF NOT EXISTS "goods_receipt_line" (
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

CREATE TABLE IF NOT EXISTS "supplier_invoice" (
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

CREATE TABLE IF NOT EXISTS "supplier_invoice_line" (
  "id" TEXT NOT NULL,
  "supplier_invoice_id" TEXT NOT NULL,
  "goods_receipt_line_id" TEXT,
  "amount" DECIMAL(14,2) NOT NULL,
  CONSTRAINT "supplier_invoice_line_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "supplier_payment" (
  "id" TEXT NOT NULL,
  "factory_id" TEXT NOT NULL,
  "supplier_invoice_id" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "payment_date" DATE NOT NULL,
  "payment_mode" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supplier_payment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "factory" ADD COLUMN IF NOT EXISTS "operating_status" "FactoryOperatingStatus" NOT NULL DEFAULT 'SETUP';
ALTER TABLE "factory" ADD COLUMN IF NOT EXISTS "go_live_date" TIMESTAMP(3);
ALTER TABLE "factory" ADD COLUMN IF NOT EXISTS "opening_snapshot_approved_at" TIMESTAMP(3);
ALTER TABLE "factory" ADD COLUMN IF NOT EXISTS "opening_snapshot_approved_by" TEXT;
ALTER TABLE "factory" ADD COLUMN IF NOT EXISTS "backdate_lock_date" DATE;

ALTER TABLE "raw_block" ADD COLUMN IF NOT EXISTS "legacy_serial_number" TEXT;
ALTER TABLE "raw_block" ADD COLUMN IF NOT EXISTS "ownership_type" "OwnershipType" NOT NULL DEFAULT 'COMPANY_OWNED';
ALTER TABLE "raw_block" ADD COLUMN IF NOT EXISTS "verification_status" "VerificationStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "raw_block" ADD COLUMN IF NOT EXISTS "production_stage" "BlockProductionStage" NOT NULL DEFAULT 'RAW';
ALTER TABLE "raw_block" ADD COLUMN IF NOT EXISTS "inventory_status" "InventoryStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "raw_block" ADD COLUMN IF NOT EXISTS "location_id" TEXT;
ALTER TABLE "raw_block" ADD COLUMN IF NOT EXISTS "inventory_source_type" "InventorySourceType";
ALTER TABLE "raw_block" ADD COLUMN IF NOT EXISTS "opening_inventory_line_id" TEXT;
ALTER TABLE "raw_block" ADD COLUMN IF NOT EXISTS "goods_receipt_line_id" TEXT;
ALTER TABLE "raw_block" ADD COLUMN IF NOT EXISTS "information_confidence" TEXT NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "raw_block" ADD COLUMN IF NOT EXISTS "physically_verified_by" TEXT;
ALTER TABLE "raw_block" ADD COLUMN IF NOT EXISTS "physically_verified_at" TIMESTAMP(3);
ALTER TABLE "raw_block" ADD COLUMN IF NOT EXISTS "approved_by" TEXT;
ALTER TABLE "raw_block" ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP(3);

ALTER TABLE "slab" ADD COLUMN IF NOT EXISTS "production_stage" "SlabProductionStage" NOT NULL DEFAULT 'CUT_UNPOLISHED';
ALTER TABLE "slab" ADD COLUMN IF NOT EXISTS "inventory_status" "InventoryStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "slab" ADD COLUMN IF NOT EXISTS "location_id" TEXT;
ALTER TABLE "slab" ADD COLUMN IF NOT EXISTS "inventory_source_type" "InventorySourceType";
ALTER TABLE "slab" ADD COLUMN IF NOT EXISTS "opening_inventory_line_id" TEXT;
ALTER TABLE "slab" ADD COLUMN IF NOT EXISTS "lineage_status" "SlabLineageStatus" NOT NULL DEFAULT 'LIVE_PARENTED';
ALTER TABLE "slab" ADD COLUMN IF NOT EXISTS "polish_finish_type" TEXT;
ALTER TABLE "slab" ALTER COLUMN "parent_block_id" DROP NOT NULL;

ALTER TABLE "polishing_session" ADD COLUMN IF NOT EXISTS "status" "ProductionSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS';
ALTER TABLE "cutting_session" ADD COLUMN IF NOT EXISTS "block_reservation_id" TEXT;
ALTER TABLE "sales_order" ADD COLUMN IF NOT EXISTS "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "factory_id" TEXT;
ALTER TABLE "opening_inventory_snapshot" ALTER COLUMN "updated_at" DROP DEFAULT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'machine' AND column_name = 'machine_type' AND udt_name <> 'MachineType'
  ) THEN
    ALTER TABLE "machine" ADD COLUMN IF NOT EXISTS "machine_type_new" "MachineType";
    UPDATE "machine"
    SET "machine_type_new" = CASE
      WHEN lower("machine_type"::text) IN ('cutting', 'b21', 'b-21') THEN 'CUTTING'::"MachineType"
      WHEN lower("machine_type"::text) IN ('polishing', 'lpm') THEN 'POLISHING'::"MachineType"
      ELSE NULL
    END;
    IF EXISTS (SELECT 1 FROM "machine" WHERE "machine_type_new" IS NULL) THEN
      RAISE EXCEPTION 'Cannot map one or more machine.machine_type values to MachineType';
    END IF;
    ALTER TABLE "machine" DROP COLUMN "machine_type";
    ALTER TABLE "machine" RENAME COLUMN "machine_type_new" TO "machine_type";
  END IF;
END $$;
ALTER TABLE "machine" ALTER COLUMN "machine_type" SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'cutting_session' AND column_name = 'status' AND udt_name <> 'ProductionSessionStatus'
  ) THEN
    ALTER TABLE "cutting_session" ADD COLUMN IF NOT EXISTS "status_new" "ProductionSessionStatus";
    UPDATE "cutting_session"
    SET "status_new" = CASE
      WHEN lower("status"::text) IN ('in_progress', 'in progress', 'active') THEN 'IN_PROGRESS'::"ProductionSessionStatus"
      WHEN lower("status"::text) = 'completed' THEN 'COMPLETED'::"ProductionSessionStatus"
      WHEN lower("status"::text) = 'aborted' THEN 'ABORTED'::"ProductionSessionStatus"
      ELSE NULL
    END;
    IF EXISTS (SELECT 1 FROM "cutting_session" WHERE "status_new" IS NULL) THEN
      RAISE EXCEPTION 'Cannot map one or more cutting_session.status values to ProductionSessionStatus';
    END IF;
    ALTER TABLE "cutting_session" DROP COLUMN "status";
    ALTER TABLE "cutting_session" RENAME COLUMN "status_new" TO "status";
  END IF;
END $$;
ALTER TABLE "cutting_session" ALTER COLUMN "status" SET DEFAULT 'IN_PROGRESS';
ALTER TABLE "cutting_session" ALTER COLUMN "status" SET NOT NULL;

INSERT INTO "inventory_location" ("id", "factory_id", "code", "name", "location_type", "active")
SELECT 'loc-' || f."id" || '-RAW_YARD', f."id", 'RAW_YARD', 'Raw Yard', 'RAW_YARD'::"InventoryLocationType", true FROM "factory" f
ON CONFLICT DO NOTHING;
INSERT INTO "inventory_location" ("id", "factory_id", "code", "name", "location_type", "active")
SELECT 'loc-' || f."id" || '-B21_QUEUE', f."id", 'B21_QUEUE', 'B-21 Queue', 'B21_QUEUE'::"InventoryLocationType", true FROM "factory" f
ON CONFLICT DO NOTHING;
INSERT INTO "inventory_location" ("id", "factory_id", "code", "name", "location_type", "active")
SELECT 'loc-' || f."id" || '-B21_WIP', f."id", 'B21_WIP', 'B-21 WIP', 'B21_WIP'::"InventoryLocationType", true FROM "factory" f
ON CONFLICT DO NOTHING;
INSERT INTO "inventory_location" ("id", "factory_id", "code", "name", "location_type", "active")
SELECT 'loc-' || f."id" || '-UNPOLISHED_STOCK', f."id", 'UNPOLISHED_STOCK', 'Unpolished Stock', 'UNPOLISHED_STOCK'::"InventoryLocationType", true FROM "factory" f
ON CONFLICT DO NOTHING;
INSERT INTO "inventory_location" ("id", "factory_id", "code", "name", "location_type", "active")
SELECT 'loc-' || f."id" || '-LPM_QUEUE', f."id", 'LPM_QUEUE', 'LPM Queue', 'LPM_QUEUE'::"InventoryLocationType", true FROM "factory" f
ON CONFLICT DO NOTHING;
INSERT INTO "inventory_location" ("id", "factory_id", "code", "name", "location_type", "active")
SELECT 'loc-' || f."id" || '-LPM_WIP', f."id", 'LPM_WIP', 'LPM WIP', 'LPM_WIP'::"InventoryLocationType", true FROM "factory" f
ON CONFLICT DO NOTHING;
INSERT INTO "inventory_location" ("id", "factory_id", "code", "name", "location_type", "active")
SELECT 'loc-' || f."id" || '-FINISHED_STOCK', f."id", 'FINISHED_STOCK', 'Finished Stock', 'FINISHED_STOCK'::"InventoryLocationType", true FROM "factory" f
ON CONFLICT DO NOTHING;
INSERT INTO "inventory_location" ("id", "factory_id", "code", "name", "location_type", "active")
SELECT 'loc-' || f."id" || '-HOLD', f."id", 'HOLD', 'Hold', 'HOLD'::"InventoryLocationType", true FROM "factory" f
ON CONFLICT DO NOTHING;
INSERT INTO "inventory_location" ("id", "factory_id", "code", "name", "location_type", "active")
SELECT 'loc-' || f."id" || '-DELIVERED', f."id", 'DELIVERED', 'Delivered', 'DELIVERED'::"InventoryLocationType", true FROM "factory" f
ON CONFLICT DO NOTHING;

UPDATE "raw_block" rb
SET
  "production_stage" = CASE
    WHEN rb."current_status" = 'under_cutting' THEN 'UNDER_CUTTING'::"BlockProductionStage"
    WHEN rb."current_status" = 'cut' THEN 'CONSUMED'::"BlockProductionStage"
    ELSE 'RAW'::"BlockProductionStage"
  END,
  "inventory_status" = CASE
    WHEN rb."current_status" = 'under_cutting' THEN 'RESERVED'::"InventoryStatus"
    WHEN rb."current_status" = 'cut' THEN 'CONSUMED'::"InventoryStatus"
    ELSE 'AVAILABLE'::"InventoryStatus"
  END,
  "verification_status" = 'PHYSICALLY_VERIFIED'::"VerificationStatus",
  "ownership_type" = COALESCE(rb."ownership_type", 'COMPANY_OWNED'::"OwnershipType"),
  "inventory_source_type" = COALESCE(rb."inventory_source_type", 'APPROVED_ADJUSTMENT'::"InventorySourceType"),
  "information_confidence" = 'LEGACY_MIGRATED',
  "location_id" = COALESCE(
    rb."location_id",
    CASE
      WHEN rb."current_status" = 'under_cutting' THEN 'loc-' || rb."factory_id" || '-B21_WIP'
      ELSE 'loc-' || rb."factory_id" || '-RAW_YARD'
    END
  );

UPDATE "slab" s
SET
  "production_stage" = CASE
    WHEN s."sales_status" IN ('polished', 'sold') THEN 'POLISHED'::"SlabProductionStage"
    ELSE 'CUT_UNPOLISHED'::"SlabProductionStage"
  END,
  "inventory_status" = CASE
    WHEN s."sales_status" = 'sold' THEN 'DELIVERED'::"InventoryStatus"
    ELSE 'AVAILABLE'::"InventoryStatus"
  END,
  "inventory_source_type" = COALESCE(s."inventory_source_type", 'APPROVED_ADJUSTMENT'::"InventorySourceType"),
  "lineage_status" = CASE WHEN s."parent_block_id" IS NULL THEN 'LEGACY_UNKNOWN'::"SlabLineageStatus" ELSE 'LEGACY_KNOWN'::"SlabLineageStatus" END,
  "location_id" = COALESCE(
    s."location_id",
    CASE
      WHEN s."sales_status" = 'sold' THEN 'loc-' || s."factory_id" || '-DELIVERED'
      WHEN s."sales_status" = 'polished' THEN 'loc-' || s."factory_id" || '-FINISHED_STOCK'
      ELSE 'loc-' || s."factory_id" || '-UNPOLISHED_STOCK'
    END
  );

UPDATE "payment" p
SET "factory_id" = i."factory_id"
FROM "invoice" i
WHERE p."invoice_id" = i."id" AND p."factory_id" IS NULL;

UPDATE "payment"
SET "factory_id" = (SELECT f."id" FROM "factory" f ORDER BY f."created_at" LIMIT 1)
WHERE "factory_id" IS NULL AND (SELECT count(*) FROM "factory") = 1;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "payment" WHERE "factory_id" IS NULL) THEN
    RAISE EXCEPTION 'Cannot backfill payment.factory_id; payment rows are not linked to a known factory';
  END IF;
END $$;
ALTER TABLE "payment" ALTER COLUMN "factory_id" SET NOT NULL;

INSERT INTO "inventory_movement" (
  "id", "factory_id", "movement_type", "raw_block_id", "to_location_id",
  "quantity", "reference_type", "reference_id", "created_by", "reason", "idempotency_key"
)
SELECT
  'legacy-movement-block-' || rb."id",
  rb."factory_id",
  'ADJUSTMENT'::"InventoryMovementType",
  rb."id",
  rb."location_id",
  1,
  'LEGACY_MIGRATION',
  rb."id",
  'legacy-migration',
  'One-time source movement for pre-workflow raw block; original purchase history not inferred.',
  'legacy:block:' || rb."id"
FROM "raw_block" rb
WHERE NOT EXISTS (
  SELECT 1 FROM "inventory_movement" im
  WHERE im."factory_id" = rb."factory_id" AND im."idempotency_key" = 'legacy:block:' || rb."id"
);

INSERT INTO "inventory_movement" (
  "id", "factory_id", "movement_type", "slab_id", "to_location_id",
  "quantity", "reference_type", "reference_id", "created_by", "reason", "idempotency_key"
)
SELECT
  'legacy-movement-slab-' || s."id",
  s."factory_id",
  'ADJUSTMENT'::"InventoryMovementType",
  s."id",
  s."location_id",
  1,
  'LEGACY_MIGRATION',
  s."id",
  'legacy-migration',
  'One-time source movement for pre-workflow slab; parentage/status mapped from legacy fields only.',
  'legacy:slab:' || s."id"
FROM "slab" s
WHERE NOT EXISTS (
  SELECT 1 FROM "inventory_movement" im
  WHERE im."factory_id" = s."factory_id" AND im."idempotency_key" = 'legacy:slab:' || s."id"
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_location_factory_id_code_key" ON "inventory_location"("factory_id", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_movement_factory_id_idempotency_key_key" ON "inventory_movement"("factory_id", "idempotency_key");
CREATE INDEX IF NOT EXISTS "inventory_movement_factory_id_raw_block_id_idx" ON "inventory_movement"("factory_id", "raw_block_id");
CREATE INDEX IF NOT EXISTS "inventory_movement_factory_id_slab_id_idx" ON "inventory_movement"("factory_id", "slab_id");
CREATE INDEX IF NOT EXISTS "inventory_reservation_factory_id_raw_block_id_status_idx" ON "inventory_reservation"("factory_id", "raw_block_id", "status");
CREATE INDEX IF NOT EXISTS "inventory_reservation_factory_id_slab_id_status_idx" ON "inventory_reservation"("factory_id", "slab_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "one_active_block_reservation" ON "inventory_reservation"("factory_id", "raw_block_id") WHERE "status" = 'ACTIVE' AND "raw_block_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "one_active_slab_reservation" ON "inventory_reservation"("factory_id", "slab_id") WHERE "status" = 'ACTIVE' AND "slab_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "one_active_cutting_session_per_block" ON "cutting_session"("factory_id", "raw_block_id") WHERE "status" = 'IN_PROGRESS';
CREATE UNIQUE INDEX IF NOT EXISTS "sales_reservation_sales_line_item_id_key" ON "sales_reservation"("sales_line_item_id");
CREATE UNIQUE INDEX IF NOT EXISTS "sales_reservation_reservation_id_key" ON "sales_reservation"("reservation_id");
CREATE INDEX IF NOT EXISTS "sales_reservation_factory_id_slab_id_status_idx" ON "sales_reservation"("factory_id", "slab_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "delivery_line_delivery_id_slab_id_key" ON "delivery_line"("delivery_id", "slab_id");
CREATE UNIQUE INDEX IF NOT EXISTS "supplier_invoice_factory_id_invoice_number_key" ON "supplier_invoice"("factory_id", "invoice_number");
CREATE UNIQUE INDEX IF NOT EXISTS "raw_block_opening_inventory_line_id_key" ON "raw_block"("opening_inventory_line_id");
CREATE UNIQUE INDEX IF NOT EXISTS "slab_opening_inventory_line_id_key" ON "slab"("opening_inventory_line_id");
CREATE UNIQUE INDEX IF NOT EXISTS "sales_line_item_sales_order_id_slab_id_key" ON "sales_line_item"("sales_order_id", "slab_id");

DO $$
BEGIN
  ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_quantity_non_negative" CHECK ("quantity" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE "opening_inventory_line" ADD CONSTRAINT "opening_inventory_line_count_non_negative" CHECK ("count" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE "cutting_session" ADD CONSTRAINT "cutting_counts_non_negative" CHECK (
    ("total_slabs_cut" IS NULL OR "total_slabs_cut" >= 0)
    AND ("final_good_slab_count" IS NULL OR "final_good_slab_count" >= 0)
    AND ("damaged_slab_count" IS NULL OR "damaged_slab_count" >= 0)
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
DECLARE
  ddl text;
  statements text[] := ARRAY[
    'ALTER TABLE "inventory_location" ADD CONSTRAINT "inventory_location_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE "cutting_session" ADD CONSTRAINT "cutting_session_block_reservation_id_fkey" FOREIGN KEY ("block_reservation_id") REFERENCES "inventory_reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE',
    'ALTER TABLE "raw_block" ADD CONSTRAINT "raw_block_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "inventory_location"("id") ON DELETE SET NULL ON UPDATE CASCADE',
    'ALTER TABLE "raw_block" ADD CONSTRAINT "raw_block_opening_inventory_line_id_fkey" FOREIGN KEY ("opening_inventory_line_id") REFERENCES "opening_inventory_line"("id") ON DELETE SET NULL ON UPDATE CASCADE',
    'ALTER TABLE "raw_block" ADD CONSTRAINT "raw_block_goods_receipt_line_id_fkey" FOREIGN KEY ("goods_receipt_line_id") REFERENCES "goods_receipt_line"("id") ON DELETE SET NULL ON UPDATE CASCADE',
    'ALTER TABLE "slab" ADD CONSTRAINT "slab_parent_block_id_fkey" FOREIGN KEY ("parent_block_id") REFERENCES "raw_block"("id") ON DELETE SET NULL ON UPDATE CASCADE',
    'ALTER TABLE "slab" ADD CONSTRAINT "slab_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "inventory_location"("id") ON DELETE SET NULL ON UPDATE CASCADE',
    'ALTER TABLE "slab" ADD CONSTRAINT "slab_opening_inventory_line_id_fkey" FOREIGN KEY ("opening_inventory_line_id") REFERENCES "opening_inventory_line"("id") ON DELETE SET NULL ON UPDATE CASCADE',
    'ALTER TABLE "payment" ADD CONSTRAINT "payment_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE "opening_inventory_snapshot" ADD CONSTRAINT "opening_inventory_snapshot_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE "opening_inventory_line" ADD CONSTRAINT "opening_inventory_line_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "opening_inventory_snapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE "opening_inventory_line" ADD CONSTRAINT "opening_inventory_line_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "inventory_location"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_raw_block_id_fkey" FOREIGN KEY ("raw_block_id") REFERENCES "raw_block"("id") ON DELETE SET NULL ON UPDATE CASCADE',
    'ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_slab_id_fkey" FOREIGN KEY ("slab_id") REFERENCES "slab"("id") ON DELETE SET NULL ON UPDATE CASCADE',
    'ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "inventory_location"("id") ON DELETE SET NULL ON UPDATE CASCADE',
    'ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "inventory_location"("id") ON DELETE SET NULL ON UPDATE CASCADE',
    'ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_reverses_movement_id_fkey" FOREIGN KEY ("reverses_movement_id") REFERENCES "inventory_movement"("id") ON DELETE SET NULL ON UPDATE CASCADE',
    'ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_cutting_session_id_fkey" FOREIGN KEY ("cutting_session_id") REFERENCES "cutting_session"("id") ON DELETE SET NULL ON UPDATE CASCADE',
    'ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_polishing_session_id_fkey" FOREIGN KEY ("polishing_session_id") REFERENCES "polishing_session"("id") ON DELETE SET NULL ON UPDATE CASCADE',
    'ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_opening_inventory_line_id_fkey" FOREIGN KEY ("opening_inventory_line_id") REFERENCES "opening_inventory_line"("id") ON DELETE SET NULL ON UPDATE CASCADE',
    'ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_goods_receipt_line_id_fkey" FOREIGN KEY ("goods_receipt_line_id") REFERENCES "goods_receipt_line"("id") ON DELETE SET NULL ON UPDATE CASCADE',
    'ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_delivery_line_id_fkey" FOREIGN KEY ("delivery_line_id") REFERENCES "delivery_line"("id") ON DELETE SET NULL ON UPDATE CASCADE',
    'ALTER TABLE "inventory_reservation" ADD CONSTRAINT "inventory_reservation_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE "inventory_reservation" ADD CONSTRAINT "inventory_reservation_raw_block_id_fkey" FOREIGN KEY ("raw_block_id") REFERENCES "raw_block"("id") ON DELETE SET NULL ON UPDATE CASCADE',
    'ALTER TABLE "inventory_reservation" ADD CONSTRAINT "inventory_reservation_slab_id_fkey" FOREIGN KEY ("slab_id") REFERENCES "slab"("id") ON DELETE SET NULL ON UPDATE CASCADE',
    'ALTER TABLE "inventory_reservation" ADD CONSTRAINT "inventory_reservation_polishing_session_id_fkey" FOREIGN KEY ("polishing_session_id") REFERENCES "polishing_session"("id") ON DELETE SET NULL ON UPDATE CASCADE',
    'ALTER TABLE "sales_reservation" ADD CONSTRAINT "sales_reservation_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE "sales_reservation" ADD CONSTRAINT "sales_reservation_sales_line_item_id_fkey" FOREIGN KEY ("sales_line_item_id") REFERENCES "sales_line_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE "sales_reservation" ADD CONSTRAINT "sales_reservation_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "inventory_reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE "delivery" ADD CONSTRAINT "delivery_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE "delivery" ADD CONSTRAINT "delivery_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE "delivery_line" ADD CONSTRAINT "delivery_line_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "delivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE "delivery_line" ADD CONSTRAINT "delivery_line_slab_id_fkey" FOREIGN KEY ("slab_id") REFERENCES "slab"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE',
    'ALTER TABLE "purchase_order_line" ADD CONSTRAINT "purchase_order_line_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE "purchase_order_line" ADD CONSTRAINT "purchase_order_line_raw_block_id_fkey" FOREIGN KEY ("raw_block_id") REFERENCES "raw_block"("id") ON DELETE SET NULL ON UPDATE CASCADE',
    'ALTER TABLE "goods_receipt" ADD CONSTRAINT "goods_receipt_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE "goods_receipt" ADD CONSTRAINT "goods_receipt_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE',
    'ALTER TABLE "goods_receipt" ADD CONSTRAINT "goods_receipt_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_order"("id") ON DELETE SET NULL ON UPDATE CASCADE',
    'ALTER TABLE "goods_receipt_line" ADD CONSTRAINT "goods_receipt_line_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE "goods_receipt_line" ADD CONSTRAINT "goods_receipt_line_raw_block_id_fkey" FOREIGN KEY ("raw_block_id") REFERENCES "raw_block"("id") ON DELETE SET NULL ON UPDATE CASCADE',
    'ALTER TABLE "goods_receipt_line" ADD CONSTRAINT "goods_receipt_line_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "inventory_location"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE "supplier_invoice" ADD CONSTRAINT "supplier_invoice_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE "supplier_invoice" ADD CONSTRAINT "supplier_invoice_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE "supplier_invoice" ADD CONSTRAINT "supplier_invoice_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipt"("id") ON DELETE SET NULL ON UPDATE CASCADE',
    'ALTER TABLE "supplier_invoice_line" ADD CONSTRAINT "supplier_invoice_line_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "supplier_invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE "supplier_payment" ADD CONSTRAINT "supplier_payment_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE "supplier_payment" ADD CONSTRAINT "supplier_payment_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "supplier_invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE'
  ];
BEGIN
  ALTER TABLE "slab" DROP CONSTRAINT IF EXISTS "slab_parent_block_id_fkey";

  FOREACH ddl IN ARRAY statements LOOP
    BEGIN
      EXECUTE ddl;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;

-- Mark existing factories as setup/live based on presence of pre-workflow data.
UPDATE "factory" f
SET "operating_status" = CASE
  WHEN EXISTS (SELECT 1 FROM "raw_block" rb WHERE rb."factory_id" = f."id")
    OR EXISTS (SELECT 1 FROM "slab" s WHERE s."factory_id" = f."id")
    OR EXISTS (SELECT 1 FROM "daily_sales_summary" d WHERE d."factory_id" = f."id")
    OR EXISTS (SELECT 1 FROM "expense" e WHERE e."factory_id" = f."id")
  THEN 'LIVE'::"FactoryOperatingStatus"
  ELSE f."operating_status"
END
WHERE f."operating_status" = 'SETUP';
