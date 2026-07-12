import { PrismaService } from "./common/prisma.service";
import { InventoryWorkflowService } from "./modules/inventory/inventory-workflow.service";
import { CuttingSessionService } from "./modules/production/cutting-session.service";
import { PolishingSessionService } from "./modules/production/polishing-session.service";
import { SalesOrderService } from "./modules/sales/sales-order.service";
import { CommercialService } from "./modules/sales/commercial.service";

describe("factory workflow smoke", () => {
  const prisma = new PrismaService();
  const inventory = new InventoryWorkflowService(prisma);
  const cutting = new CuttingSessionService(prisma, inventory);
  const polishing = new PolishingSessionService(prisma, inventory);
  const sales = new SalesOrderService(prisma, inventory);
  const commercial = new CommercialService(prisma);
  const owner = "owner-test";
  let factoryId = "";
  let b21Id = "";
  let lpmId = "";
  let customerId = "";

  beforeAll(async () => {
    await prisma.$connect();
    const [schemaRow] = await prisma.$queryRawUnsafe<Array<{ schema: string }>>(`SELECT current_schema() AS schema`);
    const allowedSchema = ["legacy_migration_test", "legacy_migration_test_clean"].includes(schemaRow.schema);
    if (!allowedSchema && process.env.STONEOS_ALLOW_WORKFLOW_SMOKE_TRUNCATE !== "1") {
      throw new Error(`Refusing to truncate workflow tables in schema ${schemaRow.schema}`);
    }
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "supplier_payment", "supplier_invoice_line", "supplier_invoice", "goods_receipt_line", "goods_receipt",
        "purchase_order_line", "purchase_order", "delivery_line", "delivery", "sales_reservation",
        "inventory_reservation", "inventory_movement", "opening_inventory_line", "opening_inventory_snapshot",
        "payment", "sales_line_item", "sales_order", "invoice", "customer", "slab_state_transition",
        "slab", "block_state_transition", "cutting_day_log", "cutting_session", "polishing_session_slab",
        "polishing_session", "raw_block", "machine", "inventory_location", "app_user", "factory"
      RESTART IDENTITY CASCADE
    `);
  }, 60000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createWorkflowFactory(name: string) {
    const factory = await prisma.factory.create({ data: { name } });
    const locations = await inventory.ensureDefaultLocations(factory.id);
    const locationByCode = Object.fromEntries(locations.map((location) => [location.code, location]));
    const b21 = await prisma.machine.create({ data: { factoryId: factory.id, name: `${name} B-21`, machineType: "CUTTING", bladeCount: 21 } });
    const lpm = await prisma.machine.create({ data: { factoryId: factory.id, name: `${name} LPM`, machineType: "POLISHING", headCount: 16, abrasivesPerHead: 6 } });
    const customer = await prisma.customer.create({ data: { factoryId: factory.id, name: `${name} Customer` } });
    return { factory, locations, locationByCode, b21, lpm, customer };
  }

  async function createLiveOpeningBlock(factoryId: string, rawYardId: string, serialNumber: string) {
    const snapshot = await inventory.createOpeningSnapshot(factoryId, owner, { countDate: "2026-07-11" });
    const openingBlockLine = await inventory.addOpeningRawBlock(factoryId, snapshot.id, {
      serialNumber,
      varietyName: "TEST_GRANITE",
      weightTons: 2,
      locationId: rawYardId,
      ownershipType: "COMPANY_OWNED",
      verificationStatus: "PHYSICALLY_VERIFIED",
    });
    await inventory.submitOpeningSnapshot(factoryId, owner, snapshot.id);
    await inventory.approveOpeningSnapshot(factoryId, owner, snapshot.id);
    await inventory.goLive(factoryId, owner);
    return openingBlockLine.rawBlockId!;
  }

  async function createUnpolishedSlabs(prefix: string, finalGoodSlabCount = 1) {
    const setup = await createWorkflowFactory(prefix);
    const rawBlockId = await createLiveOpeningBlock(setup.factory.id, setup.locationByCode.RAW_YARD.id, `${prefix}-BLOCK-1`);
    const session = await cutting.start(setup.factory.id, owner, {
      rawBlockId,
      machineId: setup.b21.id,
      expectedSlabCount: finalGoodSlabCount,
      idempotencyKey: `${prefix}:cut:start`,
    });
    const completed = await cutting.complete(setup.factory.id, owner, session.id, {
      totalSlabsCut: finalGoodSlabCount,
      finalGoodSlabCount,
      lengthFt: 8,
      widthFt: 2,
      idempotencyKey: `${prefix}:cut:complete`,
    });
    return { ...setup, rawBlockId, cuttingSession: session, slabs: completed.createdSlabs };
  }

  it("runs opening inventory through production, polishing, sale, delivery, invoice and payment", async () => {
    const factory = await prisma.factory.create({ data: { name: "Smoke Factory" } });
    factoryId = factory.id;
    const b21 = await prisma.machine.create({ data: { factoryId, name: "B-21", machineType: "CUTTING", bladeCount: 21 } });
    const lpm = await prisma.machine.create({ data: { factoryId, name: "LPM", machineType: "POLISHING", headCount: 16, abrasivesPerHead: 6 } });
    b21Id = b21.id;
    lpmId = lpm.id;
    customerId = (await prisma.customer.create({ data: { factoryId, name: "Smoke Customer" } })).id;
    const locations = await inventory.ensureDefaultLocations(factoryId);
    const rawYard = locations.find((l) => l.code === "RAW_YARD")!;
    const unpolished = locations.find((l) => l.code === "UNPOLISHED_STOCK")!;

    const snapshot = await inventory.createOpeningSnapshot(factoryId, owner, { countDate: "2026-07-11" });
    const openingBlockLine = await inventory.addOpeningRawBlock(factoryId, snapshot.id, {
      serialNumber: "LEG-BLOCK-1",
      varietyName: "UNKNOWN_LEGACY",
      weightTons: 1.5,
      locationId: rawYard.id,
      ownershipType: "UNKNOWN_LEGACY",
      verificationStatus: "PHYSICALLY_VERIFIED",
    });
    await inventory.addOpeningSlab(factoryId, snapshot.id, {
      slabSerial: "LEG-SLAB-UNKNOWN-1",
      varietyName: "UNKNOWN_LEGACY",
      inventoryKind: "UNPOLISHED_SLAB",
      lineageStatus: "LEGACY_UNKNOWN",
      locationId: unpolished.id,
      ownershipType: "UNKNOWN_LEGACY",
      verificationStatus: "PHYSICALLY_VERIFIED",
    });

    await expect(cutting.start(factoryId, owner, {
      rawBlockId: openingBlockLine.rawBlockId!,
      machineId: b21Id,
      idempotencyKey: "blocked-before-go-live",
    })).rejects.toThrow("Factory must be live");

    await inventory.submitOpeningSnapshot(factoryId, owner, snapshot.id);
    await inventory.approveOpeningSnapshot(factoryId, owner, snapshot.id);
    await inventory.goLive(factoryId, owner);

    const started = await cutting.start(factoryId, owner, {
      rawBlockId: openingBlockLine.rawBlockId!,
      machineId: b21Id,
      expectedSlabCount: 50,
      idempotencyKey: "start-cutting-1",
    });
    const retriedStart = await cutting.start(factoryId, owner, {
      rawBlockId: openingBlockLine.rawBlockId!,
      machineId: b21Id,
      expectedSlabCount: 50,
      idempotencyKey: "start-cutting-1",
    });
    expect(retriedStart.id).toBe(started.id);

    await cutting.upsertDayLog(factoryId, started.id, owner, {
      operationalDate: "2026-07-11",
      runtimeHours: 20,
      slabsProducedCount: 50,
    });
    const completed = await cutting.complete(factoryId, owner, started.id, {
      totalSlabsCut: 50,
      finalGoodSlabCount: 47,
      lengthFt: 9,
      widthFt: 2.5,
      idempotencyKey: "complete-cutting-1",
    });
    expect(completed.createdSlabs).toHaveLength(47);
    expect(completed.damagedSlabCount).toBe(3);

    const selectedForPolish = completed.createdSlabs.slice(0, 2).map((slab) => slab.id);
    const polishingSession = await polishing.create(factoryId, owner, {
      machineId: lpmId,
      operationalDate: "2026-07-12",
      finishType: "glossy",
      slabIds: selectedForPolish,
      idempotencyKey: "polish-start-1",
    });
    const wipSlab = await prisma.slab.findUniqueOrThrow({ where: { id: selectedForPolish[0] } });
    expect(wipSlab.productionStage).toBe("UNDER_POLISHING");
    await polishing.complete(factoryId, owner, polishingSession.id, "polish-complete-1");
    const polished = await prisma.slab.findUniqueOrThrow({ where: { id: selectedForPolish[0] } });
    expect(polished.productionStage).toBe("POLISHED");
    expect(polished.inventoryStatus).toBe("AVAILABLE");

    const order = await sales.create(factoryId, owner, {
      customerId,
      orderDate: "2026-07-13",
      lineItems: [{ slabId: polished.id, quantity: 22.5, unitPrice: 100 }],
    });
    const reserved = await prisma.slab.findUniqueOrThrow({ where: { id: polished.id } });
    expect(reserved.inventoryStatus).toBe("RESERVED");

    await sales.deliver(factoryId, owner, order.id, {
      deliveryDate: "2026-07-14",
      slabIds: [polished.id],
      idempotencyKey: "delivery-1",
    });
    const delivered = await prisma.slab.findUniqueOrThrow({ where: { id: polished.id } });
    expect(delivered.inventoryStatus).toBe("DELIVERED");

    const invoice = await commercial.createInvoice(factoryId, {
      salesOrderId: order.id,
      invoiceNumber: "INV-SMOKE-1",
      invoiceDate: "2026-07-15",
      invoicedAmount: 2250,
    });
    await commercial.createPayment(factoryId, { invoiceId: invoice.id, paymentDate: "2026-07-16", amount: 1000, paymentMode: "bank" });
    await commercial.createPayment(factoryId, { invoiceId: invoice.id, paymentDate: "2026-07-17", amount: 1250, paymentMode: "bank" });

    const genealogy = await prisma.slab.findUniqueOrThrow({ where: { id: polished.id }, include: { parentBlock: true, cuttingSession: true, polishingSessionSlabs: true, deliveryLines: true } });
    expect(genealogy.parentBlock?.serialNumber).toBe("LEG-BLOCK-1");
    expect(genealogy.cuttingSessionId).toBe(started.id);
    expect(genealogy.polishingSessionSlabs).toHaveLength(1);
    expect(genealogy.deliveryLines).toHaveLength(1);

    const sourceMovements = await prisma.inventoryMovement.count({ where: { factoryId, movementType: { in: ["OPENING_RECEIPT", "PRODUCTION_COMPLETION"] } } });
    expect(sourceMovements).toBeGreaterThanOrEqual(49);

    const otherFactory = await prisma.factory.create({ data: { name: "Other Factory" } });
    await expect(sales.create(otherFactory.id, owner, {
      customerId,
      orderDate: "2026-07-18",
      lineItems: [{ slabId: polished.id, quantity: 1, unitPrice: 1 }],
    })).rejects.toThrow("Customer not found");
  }, 60000);

  it("submits a goods receipt once and creates raw stock movements", async () => {
    const { factory, locationByCode } = await createWorkflowFactory("Receipt Factory");
    const supplier = await prisma.supplier.create({ data: { factoryId: factory.id, name: "Receipt Supplier" } });
    const receipt = await inventory.createGoodsReceipt(factory.id, owner, {
      supplierId: supplier.id,
      receiptDate: "2026-07-18",
      lines: [
        { serialNumber: "GR-BLOCK-1", varietyName: "BLACK_GALAXY", weightTons: 3.1, locationId: locationByCode.RAW_YARD.id, ownershipType: "COMPANY_OWNED" },
        { serialNumber: "GR-BLOCK-2", varietyName: "TAN_BROWN", weightTons: 2.8, locationId: locationByCode.RAW_YARD.id, ownershipType: "COMPANY_OWNED" },
      ],
    });

    const submitted = await inventory.submitGoodsReceipt(factory.id, owner, receipt.id);
    expect(submitted.status).toBe("SUBMITTED");
    expect(submitted.lines.every((line) => line.rawBlockId)).toBe(true);

    const firstRawBlockCount = await prisma.rawBlock.count({ where: { factoryId: factory.id, inventorySourceType: "GOODS_RECEIPT" } });
    const firstMovementCount = await prisma.inventoryMovement.count({ where: { factoryId: factory.id, movementType: "GOODS_RECEIPT" } });
    expect(firstRawBlockCount).toBe(2);
    expect(firstMovementCount).toBe(2);

    await inventory.submitGoodsReceipt(factory.id, owner, receipt.id);
    await expect(prisma.rawBlock.count({ where: { factoryId: factory.id, inventorySourceType: "GOODS_RECEIPT" } })).resolves.toBe(firstRawBlockCount);
    await expect(prisma.inventoryMovement.count({ where: { factoryId: factory.id, movementType: "GOODS_RECEIPT" } })).resolves.toBe(firstMovementCount);
  }, 60000);

  it("aborts cutting and releases the raw block reservation", async () => {
    const { factory, locationByCode, b21 } = await createWorkflowFactory("Abort Cutting Factory");
    const rawBlockId = await createLiveOpeningBlock(factory.id, locationByCode.RAW_YARD.id, "ABORT-CUT-BLOCK-1");
    const session = await cutting.start(factory.id, owner, {
      rawBlockId,
      machineId: b21.id,
      expectedSlabCount: 20,
      idempotencyKey: "abort-cutting:start",
    });

    const aborted = await cutting.abort(factory.id, owner, session.id, { reason: "Operator stopped test run", idempotencyKey: "abort-cutting:release" });
    expect(aborted.status).toBe("ABORTED");
    expect(aborted.rawBlock.productionStage).toBe("RAW");
    expect(aborted.rawBlock.inventoryStatus).toBe("AVAILABLE");
    expect(aborted.rawBlock.locationId).toBe(locationByCode.RAW_YARD.id);

    const reservation = await prisma.inventoryReservation.findUniqueOrThrow({ where: { id: session.blockReservationId! } });
    expect(reservation.status).toBe("RELEASED");
    await expect(prisma.inventoryMovement.count({ where: { factoryId: factory.id, movementType: "RESERVATION_RELEASE", cuttingSessionId: session.id } })).resolves.toBe(1);
    await expect(cutting.abort(factory.id, owner, session.id, { reason: "again", idempotencyKey: "abort-cutting:again" })).rejects.toThrow("Only active sessions can be aborted");
  }, 60000);

  it("aborts polishing and returns slabs to unpolished stock", async () => {
    const setup = await createUnpolishedSlabs("ABORT-POLISH", 2);
    const session = await polishing.create(setup.factory.id, owner, {
      machineId: setup.lpm.id,
      operationalDate: "2026-07-19",
      finishType: "matte",
      slabIds: setup.slabs.map((slab) => slab.id),
      idempotencyKey: "abort-polishing:start",
    });

    const aborted = await polishing.abort(setup.factory.id, owner, session.id, { reason: "Quality hold", idempotencyKey: "abort-polishing" });
    expect(aborted.status).toBe("ABORTED");

    const slabs = await prisma.slab.findMany({ where: { id: { in: setup.slabs.map((slab) => slab.id) } }, orderBy: { slabSerial: "asc" } });
    expect(slabs.every((slab) => slab.productionStage === "CUT_UNPOLISHED")).toBe(true);
    expect(slabs.every((slab) => slab.inventoryStatus === "AVAILABLE")).toBe(true);
    expect(slabs.every((slab) => slab.locationId === setup.locationByCode.UNPOLISHED_STOCK.id)).toBe(true);
    await expect(prisma.inventoryReservation.count({ where: { factoryId: setup.factory.id, polishingSessionId: session.id, status: "RELEASED" } })).resolves.toBe(2);
    await expect(prisma.inventoryMovement.count({ where: { factoryId: setup.factory.id, movementType: "RESERVATION_RELEASE", polishingSessionId: session.id } })).resolves.toBe(2);
  }, 60000);

  it("cancels a sales order and releases polished slab inventory", async () => {
    const setup = await createUnpolishedSlabs("CANCEL-SALE", 1);
    const polish = await polishing.create(setup.factory.id, owner, {
      machineId: setup.lpm.id,
      operationalDate: "2026-07-20",
      finishType: "glossy",
      slabIds: [setup.slabs[0].id],
      idempotencyKey: "cancel-sale:polish:start",
    });
    await polishing.complete(setup.factory.id, owner, polish.id, "cancel-sale:polish:complete");

    const order = await sales.create(setup.factory.id, owner, {
      customerId: setup.customer.id,
      orderDate: "2026-07-21",
      lineItems: [{ slabId: setup.slabs[0].id, quantity: 16, unitPrice: 95 }],
    });
    await sales.cancel(setup.factory.id, owner, order.id);

    const slab = await prisma.slab.findUniqueOrThrow({ where: { id: setup.slabs[0].id } });
    expect(slab.inventoryStatus).toBe("AVAILABLE");
    expect(slab.salesStatus).toBe("polished");
    await expect(prisma.salesReservation.count({ where: { factoryId: setup.factory.id, salesOrderId: order.id, status: "RELEASED" } })).resolves.toBe(1);
    await expect(prisma.inventoryReservation.count({ where: { factoryId: setup.factory.id, slabId: slab.id, purpose: "SALES", status: "RELEASED" } })).resolves.toBe(1);
  }, 60000);

  it("allows only one concurrent cutting start for a raw block", async () => {
    const setup = await createWorkflowFactory("Concurrent Cutting Factory");
    const rawBlockId = await createLiveOpeningBlock(setup.factory.id, setup.locationByCode.RAW_YARD.id, "CONCURRENT-CUT-BLOCK");
    const results = await Promise.allSettled([
      cutting.start(setup.factory.id, owner, { rawBlockId, machineId: setup.b21.id, idempotencyKey: "concurrent-cut:a" }),
      cutting.start(setup.factory.id, owner, { rawBlockId, machineId: setup.b21.id, idempotencyKey: "concurrent-cut:b" }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    await expect(prisma.cuttingSession.count({ where: { factoryId: setup.factory.id, rawBlockId, status: "IN_PROGRESS" } })).resolves.toBe(1);
    await expect(prisma.inventoryReservation.count({ where: { factoryId: setup.factory.id, rawBlockId, purpose: "CUTTING", status: "ACTIVE" } })).resolves.toBe(1);
  }, 60000);

  it("allows only one concurrent polishing reservation for a slab", async () => {
    const setup = await createUnpolishedSlabs("CONCURRENT-POLISH", 1);
    const slabId = setup.slabs[0].id;
    const results = await Promise.allSettled([
      polishing.create(setup.factory.id, owner, { machineId: setup.lpm.id, operationalDate: "2026-07-22", finishType: "glossy", slabIds: [slabId], idempotencyKey: "concurrent-polish:a" }),
      polishing.create(setup.factory.id, owner, { machineId: setup.lpm.id, operationalDate: "2026-07-22", finishType: "glossy", slabIds: [slabId], idempotencyKey: "concurrent-polish:b" }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    await expect(prisma.inventoryReservation.count({ where: { factoryId: setup.factory.id, slabId, purpose: "POLISHING", status: "ACTIVE" } })).resolves.toBe(1);
  }, 60000);

  it("allows only one concurrent sales reservation for a polished slab", async () => {
    const setup = await createUnpolishedSlabs("CONCURRENT-SALE", 1);
    const slabId = setup.slabs[0].id;
    const polish = await polishing.create(setup.factory.id, owner, { machineId: setup.lpm.id, operationalDate: "2026-07-23", finishType: "glossy", slabIds: [slabId], idempotencyKey: "concurrent-sale:polish:start" });
    await polishing.complete(setup.factory.id, owner, polish.id, "concurrent-sale:polish:complete");
    const secondCustomer = await prisma.customer.create({ data: { factoryId: setup.factory.id, name: "Concurrent Customer B" } });
    const results = await Promise.allSettled([
      sales.create(setup.factory.id, owner, { customerId: setup.customer.id, orderDate: "2026-07-24", lineItems: [{ slabId, quantity: 10, unitPrice: 100 }] }),
      sales.create(setup.factory.id, owner, { customerId: secondCustomer.id, orderDate: "2026-07-24", lineItems: [{ slabId, quantity: 10, unitPrice: 100 }] }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    await expect(prisma.inventoryReservation.count({ where: { factoryId: setup.factory.id, slabId, purpose: "SALES", status: "ACTIVE" } })).resolves.toBe(1);
    await expect(prisma.salesReservation.count({ where: { factoryId: setup.factory.id, slabId, status: "ACTIVE" } })).resolves.toBe(1);
  }, 60000);
});
