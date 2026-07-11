const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const schemaName = process.argv[2] || "legacy_migration_test";

function quoteIdent(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function main() {
  const schema = quoteIdent(schemaName);
  const rows = await prisma.$queryRawUnsafe(`
    select table_schema, table_name
    from information_schema.tables
    where table_name in ('factory', 'inventory_location')
      and table_schema in ('public', '${schemaName.replace(/'/g, "''")}')
    order by table_schema, table_name
  `);
  const factories = await prisma.$queryRawUnsafe(`
    select 'public' as schema_name, count(*)::text as count
    from public.factory
    where id = 'factory-legacy-test'
    union all
    select '${schemaName.replace(/'/g, "''")}' as schema_name, count(*)::text as count
    from ${schema}.factory
    where id = 'factory-legacy-test'
  `);
  const types = await prisma.$queryRawUnsafe(`
    select n.nspname as schema_name, t.typname as type_name
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname in ('public', '${schemaName.replace(/'/g, "''")}')
      and t.typname in ('InventoryLocationType', 'MachineType', 'FactoryOperatingStatus')
    order by n.nspname, t.typname
  `);
  console.log(JSON.stringify({ rows, factories, types }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
