const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const columns = await prisma.$queryRawUnsafe(`
    select table_name, column_name, data_type, udt_name, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public'
    order by table_name, ordinal_position
  `);
  const enums = await prisma.$queryRawUnsafe(`
    select t.typname as enum_name, e.enumlabel
    from pg_type t
    join pg_enum e on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
    order by t.typname, e.enumsortorder
  `);
  const counts = await prisma.$queryRawUnsafe(`
    select schemaname, relname as table_name, n_live_tup::bigint as estimated_rows
    from pg_stat_user_tables
    where schemaname = 'public'
    order by relname
  `);
  console.log(JSON.stringify({ enums, columns, counts }, (_key, value) => (
    typeof value === "bigint" ? value.toString() : value
  ), 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
