import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { InventoryWorkflowService } from "./inventory-workflow.service";

describe("InventoryWorkflowService tenant validation", () => {
  it("rejects stale factory metadata before creating locations", async () => {
    const prisma = {
      factory: { count: jest.fn().mockResolvedValue(0) },
      inventoryLocation: { upsert: jest.fn(), findMany: jest.fn() },
    };
    const service = new InventoryWorkflowService(prisma as never);

    await expect(service.ensureDefaultLocations("deleted-factory"))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.inventoryLocation.upsert).not.toHaveBeenCalled();
  });

  it("allows an owner to submit an explicitly empty opening count", async () => {
    const update = jest.fn().mockResolvedValue({ id: "snapshot-1", status: "SUBMITTED", lines: [] });
    const prisma = {
      openingInventorySnapshot: {
        findFirst: jest.fn().mockResolvedValue({ id: "snapshot-1", status: "DRAFT", lines: [] }),
      },
      $transaction: jest.fn((operation) => operation({
        factory: { update: jest.fn() },
        openingInventorySnapshot: { update },
      })),
    };
    const service = new InventoryWorkflowService(prisma as never);

    await expect(service.submitOpeningSnapshot("factory-1", "owner-1", "snapshot-1"))
      .resolves.toMatchObject({ status: "SUBMITTED" });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "SUBMITTED" }),
    }));
  });

  it("reverses epoxy only by restoring both the ledger snapshot and ground workflow state", async () => {
    const movement = {
      id: "movement-1",
      factoryId: "factory-1",
      movementType: "TRANSFER",
      slabId: "slab-1",
      rawBlockId: null,
      fromLocationId: "lpm-queue",
      toLocationId: "lpm-queue",
      quantity: 1,
      areaSqft: null,
      referenceType: "EPOXY_APPLICATION",
    };
    const slabFindFirst = jest.fn()
      .mockResolvedValueOnce({
        id: "slab-1",
        productionStage: "EPOXY_APPLIED",
        inventoryStatus: "AVAILABLE",
        locationId: "lpm-queue",
        reservations: [],
      })
      .mockResolvedValueOnce({ id: "slab-1", locationId: "lpm-queue", inventoryStatus: "AVAILABLE" });
    const slabUpdate = jest.fn().mockResolvedValue({ id: "slab-1" });
    const transitionCreate = jest.fn().mockResolvedValue({ id: "transition-1" });
    const inventoryMovement = {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValueOnce(movement).mockResolvedValueOnce(null),
      create: jest.fn().mockResolvedValue({ id: "reversal-1", movementType: "REVERSAL" }),
    };
    const tx = {
      inventoryMovement,
      slab: { findFirst: slabFindFirst, update: slabUpdate },
      slabStateTransition: { create: transitionCreate },
      inventoryLocation: { findFirstOrThrow: jest.fn().mockResolvedValue({ id: "lpm-queue", code: "LPM_QUEUE" }) },
    };
    const prisma = { $transaction: jest.fn((operation) => operation(tx)) };
    const service = new InventoryWorkflowService(prisma as never);

    await expect(service.reverseMovement("factory-1", "owner-1", "movement-1", { reason: "Epoxy entry corrected", idempotencyKey: "reverse-1" }))
      .resolves.toMatchObject({ movementType: "REVERSAL" });
    expect(slabUpdate).toHaveBeenLastCalledWith({
      where: { id: "slab-1" },
      data: { productionStage: "GRINDED", salesStatus: "grinded" },
    });
    expect(transitionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ slabId: "slab-1", fromState: "epoxy_applied", toState: "grinded" }),
    });
  });

  it("rejects epoxy reversal after the slab has entered polishing", async () => {
    const movement = {
      id: "movement-1",
      movementType: "TRANSFER",
      slabId: "slab-1",
      rawBlockId: null,
      fromLocationId: "lpm-queue",
      toLocationId: "lpm-queue",
      quantity: 1,
      areaSqft: null,
      referenceType: "EPOXY_APPLICATION",
    };
    const tx = {
      inventoryMovement: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValueOnce(movement).mockResolvedValueOnce(null),
        create: jest.fn(),
      },
      slab: {
        findFirst: jest.fn().mockResolvedValue({
          id: "slab-1",
          productionStage: "UNDER_POLISHING",
          inventoryStatus: "RESERVED",
          locationId: "lpm-wip",
          reservations: [{ id: "reservation-1" }],
        }),
      },
    };
    const prisma = { $transaction: jest.fn((operation) => operation(tx)) };
    const service = new InventoryWorkflowService(prisma as never);

    await expect(service.reverseMovement("factory-1", "owner-1", "movement-1", { reason: "too late", idempotencyKey: "reverse-1" }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });
});
