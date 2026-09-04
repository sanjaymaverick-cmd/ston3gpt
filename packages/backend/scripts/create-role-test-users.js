const fs = require("fs");
const path = require("path");

for (const line of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split(/\r?\n/)) {
  const separator = line.indexOf("=");
  if (separator > 0 && !line.startsWith("#")) process.env[line.slice(0, separator)] = line.slice(separator + 1);
}

const { promisify } = require("util");
const { randomBytes, scrypt: scryptCallback } = require("crypto");
const { PrismaClient } = require("@prisma/client");
const scrypt = promisify(scryptCallback);

const prisma = new PrismaClient();
const password = process.env.STONEOS_TEST_USER_PASSWORD;
if (!password) throw new Error("STONEOS_TEST_USER_PASSWORD is required");

const identities = [
  ["operator", "stoneos.operator@example.com"],
  ["supervisor", "stoneos.supervisor@example.com"],
  ["manager", "stoneos.manager@example.com"],
  ["owner", "stoneos.owner@example.com"],
];

async function hashPassword(value) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(value, salt, 64);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

async function main() {
  let factory = await prisma.factory.findFirst({ where: { name: "StoneOS Role Test Factory" } });
  if (!factory) factory = await prisma.factory.create({ data: { name: "StoneOS Role Test Factory", operatingStatus: "LIVE", goLiveDate: new Date() } });
  const passwordHash = await hashPassword(password);

  for (const [role, email] of identities) {
    await prisma.appUser.upsert({
      where: { email },
      update: { factoryId: factory.id, role, active: true, passwordHash, name: `StoneOS ${role}` },
      create: { factoryId: factory.id, email, role, active: true, passwordHash, name: `StoneOS ${role}` },
    });
  }
  process.stdout.write(JSON.stringify({ factoryId: factory.id, users: identities.map(([role, email]) => ({ role, email })) }));
}

main().finally(() => prisma.$disconnect());
