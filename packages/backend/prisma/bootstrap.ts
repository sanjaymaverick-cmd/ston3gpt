// ONE-TIME BOOTSTRAP — run this before anything else works.
//
// Solves the real chicken-and-egg problem: the guarded /admin/users
// endpoint requires an existing owner/admin to call it, but there is no
// admin on day one. This script goes around the API directly (Prisma +
// application credential store) to create:
//   1. The Factory row (Vedam Granites)
//   2. B-21 and LPM machines with their real specs
//   3. The first owner login
//
// Usage:
//   OWNER_EMAIL=you@example.com OWNER_PASSWORD=... npx tsx prisma/bootstrap.ts
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/common/password";

const prisma = new PrismaClient();

async function main() {
  const ownerEmail = process.env.OWNER_EMAIL;
  const ownerPassword = process.env.OWNER_PASSWORD;
  const ownerName = process.env.OWNER_NAME ?? "StoneOS Owner";
  const factoryName = process.env.FACTORY_NAME ?? "Vedam Granites";
  if ((!ownerEmail || !ownerPassword) && process.argv.includes("--if-configured")) {
    console.log("Owner bootstrap skipped: OWNER_EMAIL and OWNER_PASSWORD are not both configured");
    return;
  }
  if (!ownerEmail || !ownerPassword || ownerPassword.length < 12) {
    throw new Error("Set OWNER_EMAIL and OWNER_PASSWORD (at least 12 characters)");
  }

  const normalizedEmail = ownerEmail.trim().toLowerCase();
  const existingOwner = await prisma.appUser.findUnique({ where: { email: normalizedEmail } });
  if (existingOwner) {
    console.log(`Owner bootstrap skipped: ${normalizedEmail} already exists`);
    return;
  }

  const passwordHash = await hashPassword(ownerPassword);

  const factory = await prisma.$transaction(async (tx) => {
    const createdFactory = await tx.factory.create({ data: { name: factoryName } });
    await tx.machine.createMany({
      data: [
        { factoryId: createdFactory.id, name: "B-21", machineType: "CUTTING", bladeCount: 21 },
        { factoryId: createdFactory.id, name: "LPM", machineType: "POLISHING", headCount: 16, abrasivesPerHead: 6 },
      ],
    });
    await tx.inventoryLocation.createMany({
      data: [
        ["RAW_YARD", "Raw Yard", "RAW_YARD"],
        ["B21_QUEUE", "B-21 Queue", "B21_QUEUE"],
        ["B21_WIP", "B-21 WIP", "B21_WIP"],
        ["UNPOLISHED_STOCK", "Unpolished Stock", "UNPOLISHED_STOCK"],
        ["LPM_QUEUE", "LPM Queue", "LPM_QUEUE"],
        ["LPM_WIP", "LPM WIP", "LPM_WIP"],
        ["FINISHED_STOCK", "Finished Stock", "FINISHED_STOCK"],
        ["HOLD", "Hold", "HOLD"],
        ["DELIVERED", "Delivered", "DELIVERED"],
      ].map(([code, name, locationType]) => ({ factoryId: createdFactory.id, code, name, locationType: locationType as any })),
    });
    await tx.appUser.create({
      data: { factoryId: createdFactory.id, email: normalizedEmail, name: ownerName, passwordHash, role: "owner" },
    });
    return createdFactory;
  });

  console.log(`Created factory: ${factory.name} (${factory.id})`);
  console.log("Seeded B-21 (21 blades), LPM (16 heads x 6 abrasives/head), and inventory locations");
  console.log(`Granted ${ownerEmail} owner access to ${factory.name}`);
  console.log();
  console.log(`FACTORY_ID=${factory.id}  (save this — you won't need it day-to-day, but it's handy for scripts)`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
