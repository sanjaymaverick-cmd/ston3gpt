import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "./common/prisma.service";
import { ExpenseService } from "./modules/expenses/expense.service";
import { InventoryWorkflowService } from "./modules/inventory/inventory-workflow.service";
import { CuttingSessionService } from "./modules/production/cutting-session.service";
import { PolishingSessionService } from "./modules/production/polishing-session.service";
import { CommercialService } from "./modules/sales/commercial.service";
import { SalesOrderService } from "./modules/sales/sales-order.service";

describe("cross-tenant reference authorization", () => {
  const prisma = new PrismaService();
  const inventory = new InventoryWorkflowService(prisma);
  const cutting = new CuttingSessionService(prisma, inventory);
  const polishing = new PolishingSessionService(prisma, inventory);
  const sales = new SalesOrderService(prisma, inventory);
  const commercial = new CommercialService(prisma);
  const expenses = new ExpenseService(prisma);
  const userId = "cross-tenant-test-user";

  let tenantA: any;
  let tenantB: any;

  beforeAll(async () => {
    await prisma.$connect();
    const [schemaRow] = await prisma.$queryRawUnsafe<Array<{ schema: string }>>(`SELECT current_schema() AS schema`);
    if (!["legacy_migration_test", "legacy_migration_test_clean"].includes(schemaRow.schema)) {
      throw new Error(`Cross-tenant tests require an isolated test schema; received ${schemaRow.schema}`);
    }

    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const factoryA = await prisma.factory.create({ data: { name: `Tenant A ${suffix}`, operatingStatus: "LIVE", goLiveDate: new Date() } });
    const factoryB = await prisma.factory.create({ data: { name: `Tenant B ${suffix}`, operatingStatus: "LIVE", goLiveDate: new Date() } });
    const locationsA = Object.fromEntries((await inventory.ensureDefaultLocations(factoryA.id)).map((location) => [location.code, location]));
    const locationsB = Object.fromEntries((await inventory.ensureDefaultLocations(factoryB.id)).map((location) => [location.code, location]));

    const cuttingMachineA = await prisma.machine.create({ data: { factoryId: factoryA.id, name: `B-21 A ${suffix}`, machineType: "CUTTING" } });
    const polishingMachineA = await prisma.machine.create({ data: { factoryId: factoryA.id, name: `LPM A ${suffix}`, machineType: "POLISHING" } });
    const cuttingMachineB = await prisma.machine.create({ data: { factoryId: factoryB.id, name: `B-21 B ${suffix}`, machineType: "CUTTING" } });
    const polishingMachineB = await prisma.machine.create({ data: { factoryId: factoryB.id, name: `LPM B ${suffix}`, machineType: "POLISHING" } });
    const customerA = await prisma.customer.create({ data: { factoryId: factoryA.id, name: `Customer A ${suffix}` } });
    const customerB = await prisma.customer.create({ data: { factoryId: factoryB.id, name: `Customer B ${suffix}` } });
    const supplierB = await prisma.supplier.create({ data: { factoryId: factoryB.id, name: `Supplier B ${suffix}` } });
    const vehicleB = await prisma.vehicle.create({ data: { factoryId: factoryB.id, name: `Vehicle B ${suffix}` } });

    const rawBlockA = await prisma.rawBlock.create({ data: {
      factoryId: factoryA.id, serialNumber: `BLOCK-A-${suffix}`, varietyName: "TEST", verificationStatus: "APPROVED",
      productionStage: "RAW", inventoryStatus: "AVAILABLE", locationId: locationsA.RAW_YARD.id,
      inventorySourceType: "OPENING_INVENTORY", currentStatus: "in_stock", currentLocation: locationsA.RAW_YARD.code,
    } });
    const rawBlockB = await prisma.rawBlock.create({ data: {
      factoryId: factoryB.id, serialNumber: `BLOCK-B-${suffix}`, varietyName: "TEST", verificationStatus: "APPROVED",
      productionStage: "RAW", inventoryStatus: "AVAILABLE", locationId: locationsB.RAW_YARD.id,
      inventorySourceType: "OPENING_INVENTORY", currentStatus: "in_stock", currentLocation: locationsB.RAW_YARD.code,
    } });
    const slabA = await prisma.slab.create({ data: {
      factoryId: factoryA.id, parentBlockId: rawBlockA.id, slabSerial: `SLAB-A-${suffix}`, varietyName: "TEST",
      productionStage: "CUT_UNPOLISHED", inventoryStatus: "AVAILABLE", locationId: locationsA.UNPOLISHED_STOCK.id,
      inventorySourceType: "PRODUCTION_COMPLETION", lineageStatus: "LIVE_PARENTED", salesStatus: "in_stock",
    } });
    const slabB = await prisma.slab.create({ data: {
      factoryId: factoryB.id, parentBlockId: rawBlockB.id, slabSerial: `SLAB-B-${suffix}`, varietyName: "TEST",
      productionStage: "CUT_UNPOLISHED", inventoryStatus: "AVAILABLE", locationId: locationsB.UNPOLISHED_STOCK.id,
      inventorySourceType: "PRODUCTION_COMPLETION", lineageStatus: "LIVE_PARENTED", salesStatus: "in_stock",
    } });
    const cuttingSessionB = await prisma.cuttingSession.create({ data: { factoryId: factoryB.id, rawBlockId: rawBlockB.id, machineId: cuttingMachineB.id, startedAt: new Date() } });
    const polishingSessionB = await prisma.polishingSession.create({ data: { factoryId: factoryB.id, machineId: polishingMachineB.id, operationalDate: new Date(), finishType: "glossy" } });
    const salesOrderB = await prisma.salesOrder.create({ data: { factoryId: factoryB.id, customerId: customerB.id, orderDate: new Date(), status: "CONFIRMED" } });
    const invoiceB = await prisma.invoice.create({ data: { factoryId: factoryB.id, customerId: customerB.id, invoiceNumber: `INV-B-${suffix}`, invoiceDate: new Date(), invoicedAmount: 100 } });
    const expenseA = await prisma.expense.create({ data: { factoryId: factoryA.id, category: "maintenance", amount: 100, expenseDate: new Date() } });
    const openingSnapshotA = await prisma.openingInventorySnapshot.create({ data: { factoryId: factoryA.id, countDate: new Date(), createdBy: userId } });

    tenantA = { factory: factoryA, locations: locationsA, cuttingMachine: cuttingMachineA, polishingMachine: polishingMachineA, customer: customerA, rawBlock: rawBlockA, slab: slabA, expense: expenseA, openingSnapshot: openingSnapshotA };
    tenantB = { factory: factoryB, locations: locationsB, cuttingMachine: cuttingMachineB, polishingMachine: polishingMachineB, customer: customerB, supplier: supplierB, vehicle: vehicleB, rawBlock: rawBlockB, slab: slabB, cuttingSession: cuttingSessionB, polishingSession: polishingSessionB, salesOrder: salesOrderB, invoice: invoiceB };
  }, 60000);

  afterAll(async () => prisma.$disconnect());

  it("rejects a supplier owned by another factory", async () => {
    await expect(inventory.createGoodsReceipt(tenantA.factory.id, userId, {
      supplierId: tenantB.supplier.id,
      receiptDate: "2026-07-13",
      lines: [{ serialNumber: "CROSS-SUPPLIER", varietyName: "TEST", locationId: tenantA.locations.RAW_YARD.id, ownershipType: "COMPANY_OWNED" }],
    })).rejects.toThrow();
  });

  it("rejects opening and receipt locations owned by another factory", async () => {
    await expect(inventory.addOpeningRawBlock(tenantA.factory.id, tenantA.openingSnapshot.id, {
      serialNumber: "CROSS-LOCATION-BLOCK", varietyName: "TEST", locationId: tenantB.locations.RAW_YARD.id,
      ownershipType: "COMPANY_OWNED", verificationStatus: "PHYSICALLY_VERIFIED",
    })).rejects.toThrow();
    await expect(inventory.addOpeningSlab(tenantA.factory.id, tenantA.openingSnapshot.id, {
      slabSerial: "CROSS-LOCATION-SLAB", varietyName: "TEST", inventoryKind: "UNPOLISHED_SLAB", lineageStatus: "LEGACY_UNKNOWN",
      locationId: tenantB.locations.UNPOLISHED_STOCK.id, ownershipType: "COMPANY_OWNED", verificationStatus: "PHYSICALLY_VERIFIED",
    })).rejects.toThrow();
    await expect(inventory.createGoodsReceipt(tenantA.factory.id, userId, {
      receiptDate: "2026-07-13",
      lines: [{ serialNumber: "CROSS-LOCATION-RECEIPT", varietyName: "TEST", locationId: tenantB.locations.RAW_YARD.id, ownershipType: "COMPANY_OWNED" }],
    })).rejects.toThrow(BadRequestException);
  });

  it("rejects raw blocks and machines owned by another factory", async () => {
    await expect(cutting.start(tenantA.factory.id, userId, { rawBlockId: tenantB.rawBlock.id, machineId: tenantA.cuttingMachine.id, idempotencyKey: "cross-block" })).rejects.toThrow("Block not found");
    await expect(cutting.start(tenantA.factory.id, userId, { rawBlockId: tenantA.rawBlock.id, machineId: tenantB.cuttingMachine.id, idempotencyKey: "cross-cutting-machine" })).rejects.toThrow("Machine not found");
  });

  it("rejects slabs and polishing machines owned by another factory", async () => {
    await expect(polishing.create(tenantA.factory.id, userId, { machineId: tenantA.polishingMachine.id, operationalDate: "2026-07-13", finishType: "glossy", slabIds: [tenantB.slab.id], idempotencyKey: "cross-slab" })).rejects.toThrow("One or more slabs not found in this factory");
    await expect(polishing.create(tenantA.factory.id, userId, { machineId: tenantB.polishingMachine.id, operationalDate: "2026-07-13", finishType: "glossy", slabIds: [tenantA.slab.id], idempotencyKey: "cross-polishing-machine" })).rejects.toThrow("Machine not found");
  });

  it("rejects cutting and polishing sessions owned by another factory", async () => {
    await expect(cutting.complete(tenantA.factory.id, userId, tenantB.cuttingSession.id, { totalSlabsCut: 1, finalGoodSlabCount: 1, idempotencyKey: "cross-cutting-session" })).rejects.toThrow("Cutting session not found");
    await expect(polishing.complete(tenantA.factory.id, userId, tenantB.polishingSession.id, "cross-polishing-session")).rejects.toThrow("Polishing session not found");
  });

  it("rejects customers and sales orders owned by another factory", async () => {
    await expect(sales.create(tenantA.factory.id, userId, { customerId: tenantB.customer.id, orderDate: "2026-07-13", lineItems: [{ slabId: tenantA.slab.id, quantity: 1, unitPrice: 1 }] })).rejects.toThrow("Customer not found");
    await expect(commercial.createInvoice(tenantA.factory.id, { salesOrderId: tenantB.salesOrder.id, invoiceNumber: "CROSS-ORDER", invoiceDate: "2026-07-13", invoicedAmount: 1 })).rejects.toThrow("Sales order not found");
  });

  it("rejects invoices owned by another factory", async () => {
    await expect(commercial.createPayment(tenantA.factory.id, { invoiceId: tenantB.invoice.id, paymentDate: "2026-07-13", amount: 1, paymentMode: "bank" })).rejects.toThrow("Invoice not found");
  });

  it("rejects vehicles owned by another factory", async () => {
    await expect(expenses.create(tenantA.factory.id, { category: "vehicle", vehicleId: tenantB.vehicle.id, amount: 10, expenseDate: "2026-07-13" })).rejects.toThrow(NotFoundException);
  });

  it("rejects expense allocations to another factory's raw block", async () => {
    await expect(expenses.allocate(tenantA.factory.id, tenantA.expense.id, [{ rawBlockId: tenantB.rawBlock.id, allocatedAmount: 10, allocationMethod: "manual" }])).rejects.toThrow(NotFoundException);
  });
});
