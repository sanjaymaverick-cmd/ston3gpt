import { BadRequestException } from "@nestjs/common";
import { PolishingSessionService } from "./polishing-session.service";

const sessionSlab = (overrides: Record<string, unknown> = {}) => ({
  slabId: "slab-1",
  slab: {
    id: "slab-1",
    slabSerial: "S-1",
    productionStage: "UNDER_GRINDING",
    inventoryStatus: "RESERVED",
    locationId: "lpm-wip",
    salesStatus: "under_grinding",
    ...overrides,
  },
});

const activeSession = (overrides: Record<string, unknown> = {}) => ({
  id: "session-1",
  factoryId: "factory-1",
  machineId: "machine-1",
  processType: "GRINDING",
  status: "IN_PROGRESS",
  finishType: "grinding",
  slabs: [sessionSlab()],
  reservations: [{ id: "reservation-1", slabId: "slab-1", status: "ACTIVE" }],
  ...overrides,
});

describe("PolishingSessionService inventory integrity", () => {
  const transaction = (session: ReturnType<typeof activeSession>) => {
    const tx = {
      polishingSession: { findFirst: jest.fn().mockResolvedValue(session), update: jest.fn() },
      slab: { updateMany: jest.fn() },
      slabStateTransition: { create: jest.fn() },
      inventoryReservation: { updateMany: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((operation) => operation(tx)) };
    const inventory = {
      locationByCode: jest.fn()
        .mockResolvedValueOnce({ id: "lpm-wip", code: "LPM_WIP" })
        .mockResolvedValueOnce({ id: "lpm-queue", code: "LPM_QUEUE" }),
      createMovement: jest.fn(),
    };
    return { tx, service: new PolishingSessionService(prisma as never, inventory as never) };
  };

  it("refuses to complete a session after its reserved slab was adjusted", async () => {
    const session = activeSession({
      slabs: [sessionSlab({ productionStage: "REJECTED", inventoryStatus: "SCRAPPED", locationId: null })],
    });
    const { tx, service } = transaction(session);

    await expect(service.complete("factory-1", "owner-1", "session-1", "complete-1"))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(tx.slab.updateMany).not.toHaveBeenCalled();
    expect(tx.inventoryReservation.updateMany).not.toHaveBeenCalled();
  });

  it("refuses to abort a session when its slab no longer has that active reservation", async () => {
    const session = activeSession({ reservations: [] });
    const { tx, service } = transaction(session);

    await expect(service.abort("factory-1", "owner-1", "session-1", { reason: "stop", idempotencyKey: "abort-1" }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(tx.slab.updateMany).not.toHaveBeenCalled();
    expect(tx.inventoryReservation.updateMany).not.toHaveBeenCalled();
  });
});
