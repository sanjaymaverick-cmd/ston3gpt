import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CuttingSessionService, operationalDateFor } from "./cutting-session.service";

describe("operationalDateFor", () => {
  it("assigns activity before 07:00 to the previous operating day", () => {
    const timestamp = new Date(2026, 6, 16, 6, 59);

    expect(operationalDateFor(timestamp)).toEqual(new Date(2026, 6, 15));
  });

  it("keeps activity from 07:00 on the current operating day", () => {
    const timestamp = new Date(2026, 6, 16, 7, 0);

    expect(operationalDateFor(timestamp)).toEqual(new Date(2026, 6, 16));
  });
});

describe("CuttingSessionService", () => {
  const startInput = {
    rawBlockId: "block-1",
    machineId: "machine-1",
    startedAt: "2026-07-16T08:00:00.000Z",
    expectedSlabCount: 2,
    idempotencyKey: "cut-start-1",
  };

  const validBlock = {
    id: "block-1",
    serialNumber: "BLK-1",
    varietyName: "Galaxy",
    verificationStatus: "APPROVED",
    productionStage: "RAW",
    inventoryStatus: "AVAILABLE",
    inventorySourceType: "OPENING_STOCK",
    locationId: "raw-yard",
    currentStatus: "in_stock",
    location: { id: "raw-yard", locationType: "RAW_YARD" },
  };

  const startHarness = (overrides: Record<string, unknown> = {}) => {
    const tx = {
      inventoryMovement: { findUnique: jest.fn().mockResolvedValue(null) },
      cuttingSession: {
        findUniqueOrThrow: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "session-1" }),
      },
      factory: { findUniqueOrThrow: jest.fn().mockResolvedValue({ operatingStatus: "LIVE" }) },
      rawBlock: {
        findFirst: jest.fn().mockResolvedValue(validBlock),
        update: jest.fn(),
      },
      machine: { findFirst: jest.fn().mockResolvedValue({ id: "machine-1", machineType: "CUTTING" }) },
      inventoryReservation: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "reservation-1" }),
        update: jest.fn(),
      },
      blockStateTransition: { create: jest.fn() },
      ...overrides,
    };
    const prisma = { $transaction: jest.fn((operation) => operation(tx)) };
    const inventory = {
      locationByCode: jest.fn().mockResolvedValue({ id: "b21-wip", code: "B21_WIP" }),
      createMovement: jest.fn(),
    };
    return { tx, inventory, service: new CuttingSessionService(prisma as never, inventory as never) };
  };

  it("returns the original session when a start idempotency key was already applied", async () => {
    const existing = { id: "session-existing" };
    const { tx, inventory, service } = startHarness();
    tx.inventoryMovement.findUnique.mockResolvedValue({ cuttingSessionId: existing.id });
    tx.cuttingSession.findUniqueOrThrow.mockResolvedValue(existing);

    await expect(service.start("factory-1", "user-1", startInput)).resolves.toBe(existing);
    expect(tx.factory.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(inventory.createMovement).not.toHaveBeenCalled();
  });

  it("rejects a raw block that is outside the caller's factory", async () => {
    const { tx, service } = startHarness();
    tx.rawBlock.findFirst.mockResolvedValue(null);

    await expect(service.start("factory-1", "user-1", startInput)).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.rawBlock.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "block-1", factoryId: "factory-1" },
    }));
    expect(tx.inventoryReservation.create).not.toHaveBeenCalled();
  });

  it("reserves and moves an eligible block in the same serializable transaction", async () => {
    const { tx, inventory, service } = startHarness();

    await expect(service.start("factory-1", "user-1", startInput)).resolves.toEqual({ id: "session-1" });
    expect(tx.inventoryReservation.create).toHaveBeenCalledWith({ data: expect.objectContaining({ rawBlockId: "block-1", createdBy: "user-1" }) });
    expect(inventory.createMovement).toHaveBeenCalledWith(tx, "factory-1", expect.objectContaining({
      movementType: "PRODUCTION_ISSUE",
      rawBlockId: "block-1",
      fromLocationId: "raw-yard",
      toLocationId: "b21-wip",
      idempotencyKey: "cut-start-1",
    }));
    expect(tx.rawBlock.update).toHaveBeenCalledWith({
      where: { id: "block-1" },
      data: expect.objectContaining({ productionStage: "UNDER_CUTTING", inventoryStatus: "RESERVED", locationId: "b21-wip" }),
    });
  });

  it("does not write a day log for a completed session", async () => {
    const prisma = {
      cuttingSession: { findFirst: jest.fn().mockResolvedValue({ status: "COMPLETED" }) },
      cuttingDayLog: { upsert: jest.fn() },
    };
    const service = new CuttingSessionService(prisma as never, {} as never);

    await expect(service.upsertDayLog("factory-1", "session-1", "user-1", { operationalDate: "2026-07-16" }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.cuttingDayLog.upsert).not.toHaveBeenCalled();
  });

  it("rejects completion when good slabs exceed total slabs before opening a transaction", async () => {
    const prisma = { $transaction: jest.fn() };
    const service = new CuttingSessionService(prisma as never, {} as never);

    await expect(service.complete("factory-1", "user-1", "session-1", {
      totalSlabsCut: 2,
      finalGoodSlabCount: 3,
      idempotencyKey: "complete-1",
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("creates traceable slabs and consumes the block reservation on completion", async () => {
    const session = {
      id: "session-1",
      status: "IN_PROGRESS",
      startedAt: new Date("2026-07-16T08:00:00.000Z"),
      rawBlockId: "block-1",
      machineId: "machine-1",
      blockReservationId: "reservation-1",
      rawBlock: validBlock,
      registeredSlabs: [],
    };
    const tx = {
      cuttingSession: {
        findFirst: jest.fn().mockResolvedValue(session),
        update: jest.fn().mockResolvedValue({ ...session, status: "COMPLETED" }),
      },
      slab: {
        create: jest.fn()
          .mockResolvedValueOnce({ id: "slab-1", slabSerial: "BLK-1/3/01" })
          .mockResolvedValueOnce({ id: "slab-2", slabSerial: "BLK-1/3/02" }),
      },
      rawBlock: { update: jest.fn() },
      inventoryReservation: { update: jest.fn() },
      blockStateTransition: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((operation) => operation(tx)) };
    const inventory = {
      locationByCode: jest.fn().mockResolvedValue({ id: "unpolished", code: "UNPOLISHED_STOCK" }),
      createMovement: jest.fn(),
    };
    const service = new CuttingSessionService(prisma as never, inventory as never);

    const result = await service.complete("factory-1", "user-1", "session-1", {
      endedAt: "2026-07-16T10:00:00.000Z",
      totalSlabsCut: 3,
      finalGoodSlabCount: 2,
      lengthFt: 10,
      widthFt: 3,
      idempotencyKey: "complete-1",
    });

    expect(result.damagedSlabCount).toBe(1);
    expect(tx.slab.create).toHaveBeenNthCalledWith(1, { data: expect.objectContaining({ slabSerial: "BLK-1/3/01", parentBlockId: "block-1" }) });
    expect(tx.slab.create).toHaveBeenNthCalledWith(2, { data: expect.objectContaining({ slabSerial: "BLK-1/3/02", parentBlockId: "block-1" }) });
    expect(inventory.createMovement).toHaveBeenCalledTimes(2);
    expect(tx.inventoryReservation.update).toHaveBeenCalledWith({
      where: { id: "reservation-1" },
      data: expect.objectContaining({ status: "CONSUMED", consumedBy: "user-1" }),
    });
    expect(tx.rawBlock.update).toHaveBeenCalledWith({
      where: { id: "block-1" },
      data: expect.objectContaining({ productionStage: "CONSUMED", inventoryStatus: "CONSUMED" }),
    });
  });
});
