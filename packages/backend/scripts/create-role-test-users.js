const fs = require("fs");
const path = require("path");

for (const line of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split(/\r?\n/)) {
  const separator = line.indexOf("=");
  if (separator > 0 && !line.startsWith("#")) process.env[line.slice(0, separator)] = line.slice(separator + 1);
}

const { clerkClient } = require("@clerk/clerk-sdk-node");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const password = process.env.STONEOS_TEST_USER_PASSWORD;
if (!password) throw new Error("STONEOS_TEST_USER_PASSWORD is required");

const identities = [
  ["operator", "stoneos.operator+clerk_test@example.com"],
  ["supervisor", "stoneos.supervisor+clerk_test@example.com"],
  ["manager", "stoneos.manager+clerk_test@example.com"],
  ["owner", "stoneos.owner+clerk_test@example.com"],
];

async function main() {
  let factory = await prisma.factory.findFirst({ where: { name: "StoneOS Role Test Factory" } });
  if (!factory) factory = await prisma.factory.create({ data: { name: "StoneOS Role Test Factory", operatingStatus: "LIVE", goLiveDate: new Date() } });

  for (const [role, email] of identities) {
    const existing = (await clerkClient.users.getUserList({ emailAddress: [email] })).data[0];
    const user = existing ?? await clerkClient.users.createUser({
      emailAddress: [email], password, firstName: "StoneOS", lastName: role,
      username: `stoneos_${role}_test`,
      publicMetadata: { factoryId: factory.id, role }, skipLegalChecks: true,
    });
    if (existing) {
      await clerkClient.users.updateUser(user.id, { password, skipPasswordChecks: true });
      await clerkClient.users.updateUserMetadata(user.id, { publicMetadata: { factoryId: factory.id, role } });
    }
    await prisma.appUser.upsert({
      where: { email },
      update: { factoryId: factory.id, role, active: true, name: `StoneOS ${role}` },
      create: { factoryId: factory.id, email, role, active: true, name: `StoneOS ${role}` },
    });
  }
  process.stdout.write(JSON.stringify({ factoryId: factory.id, users: identities.map(([role, email]) => ({ role, email })) }));
}

main().finally(() => prisma.$disconnect());
