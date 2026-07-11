const assert = require("assert/strict");
const { PrismaClient } = require("@prisma/client");

const schemaName = process.argv[2] || "legacy_migration_test";

function quoteIdent(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function byId(rows) {
  return Object.fromEntries(rows.map((row) => [row.id, row]));
}

async function main() {
  const prisma = new PrismaClient();
  const schema = quoteIdent(schemaName);

  try {
    const [publicFixture] = await prisma.$queryRawUnsafe(`
      SELECT count(*)::int AS count
      FROM public.factory
      WHERE id = 'factory-legacy-test'
    `);
    assert.equal(publicFixture.count, 0, "legacy fixture must not be inserted into public");

    const [testFactory] = await prisma.$queryRawUnsafe(`
      SELECT count(*)::int AS count
      FROM ${schema}.factory
      WHERE id = 'factory-legacy-test' AND operating_status = 'LIVE'
    `);
    assert.equal(testFactory.count, 1, "legacy factory should exist and be marked LIVE");

    const [locationCount] = await prisma.$queryRawUnsafe(`
      SELECT count(*)::int AS count
      FROM ${schema}.inventory_location
      WHERE factory_id = 'factory-legacy-test'
    `);
    assert.equal(locationCount.count, 9, "default workflow locations should be seeded");

    const machines = byId(await prisma.$queryRawUnsafe(`
      SELECT id, machine_type::text AS machine_type
      FROM ${schema}.machine
      WHERE factory_id = 'factory-legacy-test'
    `));
    assert.equal(machines["machine-b21-legacy"].machine_type, "CUTTING");
    assert.equal(machines["machine-lpm-legacy"].machine_type, "POLISHING");

    const rawBlocks = byId(await prisma.$queryRawUnsafe(`
      SELECT id, production_stage::text AS production_stage, inventory_status::text AS inventory_status,
        inventory_source_type::text AS inventory_source_type, verification_status::text AS verification_status,
        information_confidence, location_id
      FROM ${schema}.raw_block
      WHERE factory_id = 'factory-legacy-test'
    `));
    assert.equal(rawBlocks["block-legacy-in-stock"].production_stage, "RAW");
    assert.equal(rawBlocks["block-legacy-in-stock"].inventory_status, "AVAILABLE");
    assert.equal(rawBlocks["block-legacy-in-stock"].location_id, "loc-factory-legacy-test-RAW_YARD");
    assert.equal(rawBlocks["block-legacy-under-cutting"].production_stage, "UNDER_CUTTING");
    assert.equal(rawBlocks["block-legacy-under-cutting"].inventory_status, "RESERVED");
    assert.equal(rawBlocks["block-legacy-under-cutting"].location_id, "loc-factory-legacy-test-B21_WIP");
    assert.equal(rawBlocks["block-legacy-cut"].production_stage, "CONSUMED");
    assert.equal(rawBlocks["block-legacy-cut"].inventory_status, "CONSUMED");
    for (const block of Object.values(rawBlocks)) {
      assert.equal(block.inventory_source_type, "APPROVED_ADJUSTMENT");
      assert.equal(block.verification_status, "PHYSICALLY_VERIFIED");
      assert.equal(block.information_confidence, "LEGACY_MIGRATED");
    }

    const slabs = byId(await prisma.$queryRawUnsafe(`
      SELECT id, production_stage::text AS production_stage, inventory_status::text AS inventory_status,
        inventory_source_type::text AS inventory_source_type, lineage_status::text AS lineage_status, location_id
      FROM ${schema}.slab
      WHERE factory_id = 'factory-legacy-test'
    `));
    assert.equal(slabs["slab-legacy-unpolished"].production_stage, "CUT_UNPOLISHED");
    assert.equal(slabs["slab-legacy-unpolished"].inventory_status, "AVAILABLE");
    assert.equal(slabs["slab-legacy-unpolished"].location_id, "loc-factory-legacy-test-UNPOLISHED_STOCK");
    assert.equal(slabs["slab-legacy-polished"].production_stage, "POLISHED");
    assert.equal(slabs["slab-legacy-polished"].inventory_status, "AVAILABLE");
    assert.equal(slabs["slab-legacy-polished"].location_id, "loc-factory-legacy-test-FINISHED_STOCK");
    assert.equal(slabs["slab-legacy-sold"].production_stage, "POLISHED");
    assert.equal(slabs["slab-legacy-sold"].inventory_status, "DELIVERED");
    assert.equal(slabs["slab-legacy-sold"].location_id, "loc-factory-legacy-test-DELIVERED");
    for (const slab of Object.values(slabs)) {
      assert.equal(slab.inventory_source_type, "APPROVED_ADJUSTMENT");
      assert.equal(slab.lineage_status, "LEGACY_KNOWN");
    }

    const [payment] = await prisma.$queryRawUnsafe(`
      SELECT factory_id
      FROM ${schema}.payment
      WHERE id = 'payment-legacy-test'
    `);
    assert.equal(payment.factory_id, "factory-legacy-test");

    const [movementSummary] = await prisma.$queryRawUnsafe(`
      SELECT count(*)::int AS count, count(DISTINCT idempotency_key)::int AS distinct_keys
      FROM ${schema}.inventory_movement
      WHERE factory_id = 'factory-legacy-test'
        AND reference_type = 'LEGACY_MIGRATION'
        AND movement_type = 'ADJUSTMENT'
    `);
    assert.equal(movementSummary.count, 6, "one legacy movement expected for each seeded block and slab");
    assert.equal(movementSummary.distinct_keys, 6, "legacy movements must be idempotent");

    console.log(`Legacy upgrade verification passed for schema ${schemaName}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
