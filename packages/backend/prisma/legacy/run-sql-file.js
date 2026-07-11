const fs = require("fs");
const { PrismaClient } = require("@prisma/client");

const [, , filePath, searchPath] = process.argv;
if (!filePath) {
  console.error("Usage: node run-sql-file.js <file.sql> [search_path]");
  process.exit(1);
}

function splitSql(sql) {
  const statements = [];
  let current = "";
  let inSingle = false;
  let dollarTag = null;

  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    const rest = sql.slice(i);

    if (!inSingle && !dollarTag && rest.startsWith("--")) {
      const nextNewline = sql.indexOf("\n", i);
      if (nextNewline === -1) break;
      i = nextNewline;
      current += "\n";
      continue;
    }

    if (!inSingle && ch === "$") {
      const match = rest.match(/^\$[A-Za-z0-9_]*\$/);
      if (match) {
        const tag = match[0];
        current += tag;
        i += tag.length - 1;
        if (!dollarTag) {
          dollarTag = tag;
        } else if (dollarTag === tag) {
          dollarTag = null;
        }
        continue;
      }
    }

    if (!dollarTag && ch === "'") {
      inSingle = !inSingle;
    }

    if (!inSingle && !dollarTag && ch === ";") {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = "";
      continue;
    }

    current += ch;
  }

  const trimmed = current.trim();
  if (trimmed) statements.push(trimmed);
  return statements;
}

function quoteIdent(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const sql = fs.readFileSync(filePath, "utf8");
    const statements = splitSql(sql);
    if (process.env.DEBUG_SQL_SPLIT) {
      console.log(statements.slice(0, 5).map((statement, index) => ({
        index: index + 1,
        preview: statement.slice(0, 500),
      })));
    }

    await prisma.$transaction(
      async (tx) => {
        if (searchPath) {
          await tx.$executeRawUnsafe(`SET search_path = ${quoteIdent(searchPath)}`);
        }

        for (const [index, statement] of statements.entries()) {
          try {
            await tx.$executeRawUnsafe(statement);
          } catch (error) {
            console.error(`Failed at statement ${index + 1}/${statements.length}:`);
            console.error(statement.slice(0, 1000));
            throw error;
          }
        }
      },
      { maxWait: 120000, timeout: 120000 },
    );

    console.log(`Executed ${statements.length} SQL statements from ${filePath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
