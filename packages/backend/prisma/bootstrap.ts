// ONE-TIME BOOTSTRAP — run this before anything else works.
//
// Solves the real chicken-and-egg problem: the guarded /admin/users
// endpoint requires an existing owner/admin to call it, but there is no
// admin on day one. This script goes around the API directly (Prisma +
// Clerk SDK) to create:
//   1. The Factory row (Vedam Granites)
//   2. B-21 and LPM machines with their real specs
//   3. The first owner — looked up by email in Clerk, same as the
//      ongoing /admin/users flow, just without the guard
//
// Usage:
//   OWNER_EMAIL=you@example.com npx ts-node prisma/bootstrap.ts
//
// The person running this must have ALREADY signed up in the app via
// Clerk (sign-up itself is unrestricted) — this script only grants that
// existing account owner-level access to a factory it also creates.
import { PrismaClient } from "@prisma/client";
import { clerkClient } from "@clerk/clerk-sdk-node";

const prisma = new PrismaClient();

async function main() {
  const ownerEmail = process.env.OWNER_EMAIL;
  const factoryName = process.env.FACTORY_NAME ?? "Vedam Granites";
  if (!ownerEmail) {
    throw new Error("Set OWNER_EMAIL to the email you signed up with in Clerk");
  }

  const { data: users } = await clerkClient.users.getUserList({ emailAddress: [ownerEmail] });
  if (users.length === 0) {
    throw new Error(`No Clerk account found for ${ownerEmail} — sign up in the app first, then re-run this.`);
  }
  const clerkUser = users[0];

  const factory = await prisma.factory.create({ data: { name: factoryName } });
  console.log(`Created factory: ${factory.name} (${factory.id})`);

  await prisma.machine.create({
    data: { factoryId: factory.id, name: "B-21", machineType: "CUTTING", bladeCount: 21 },
  });
  await prisma.machine.create({
    data: { factoryId: factory.id, name: "LPM", machineType: "POLISHING", headCount: 16, abrasivesPerHead: 6 },
  });
  console.log("Seeded B-21 (21 blades) and LPM (16 heads x 6 abrasives/head)");

  await prisma.inventoryLocation.createMany({
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
    ].map(([code, name, locationType]) => ({ factoryId: factory.id, code, name, locationType: locationType as any })),
  });
  console.log("Seeded controlled inventory locations");

  await clerkClient.users.updateUserMetadata(clerkUser.id, {
    publicMetadata: { factoryId: factory.id, role: "owner" },
  });
  await prisma.appUser.create({
    data: { factoryId: factory.id, email: ownerEmail, name: clerkUser.firstName ?? ownerEmail, role: "owner" },
  });
  console.log(`Granted ${ownerEmail} owner access to ${factory.name}`);
  console.log();
  console.log(`FACTORY_ID=${factory.id}  (save this — you won't need it day-to-day, but it's handy for scripts)`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
