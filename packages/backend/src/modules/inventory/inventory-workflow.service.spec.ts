import { BadRequestException } from "@nestjs/common";
import { InventoryWorkflowService } from "./inventory-workflow.service";

function serviceWithTx(tx: Record<string, unknown>) {
  return new InventoryWorkflowService({
    $transaction: (callback: (client: unknown) => unknown) => callback(tx),
  } as any);
}

describe("InventoryWorkflowService manual adjustment semantics", () => {
  it("creates a movement and updates raw block snapshot atomically", async () => {
    const tx = {
      inventoryMovement: {
        findUnique: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null),
        create: jest.fn().mockResolvedValue({ id: "movement-a" }),
      },
      rawBlock: {
        findFirst: jest.fn().mockResolvedValue({ id: "block-a", locationId: "loc-a", inventoryStatus: "AVAILABLE" }),
        update: jest.fn().mockResolvedValue({ id: "block-a" }),
      },
      slab: { findFirst: jest.fn(), update: jest.fn() },
      inventoryLocation: {
        findFirstOrThrow: jest.fn().mockResolvedValue({ id: "loc-b", code: "FINISHED_STOCK" }),
      },
    };
    const service = serviceWithTx(tx);

    await expect(
      service.adjust("factory-a", "user-a", {
        movementType: "ADJUSTMENT",
        rawBlockId: "block-a",
        fromLocationId: "loc-a",
        toLocationId: "loc-b",
        quantity: 1,
        reason: "Correct yard location",
        idempotencyKey: "adjust-a",
      }),
    ).resolves.toEqual({ id: "movement-a" });

    expect(tx.inventoryMovement.create).toHaveBeenCalled();
    expect(tx.rawBlock.update).toHaveBeenCalledWith({
      where: { id: "block-a" },
      data: {
        inventoryStatus: "AVAILABLE",
        locationId: "loc-b",
        currentLocation: "FINISHED_STOCK",
        currentStatus: "in_stock",
        productionStage: "RAW",
      },
    });
  });

  it("rejects moving stock out of a location where it is not present", async () => {
    const tx = {
      inventoryMovement: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      rawBlock: {
        findFirst: jest.fn().mockResolvedValue({ id: "block-a", locationId: "loc-a", inventoryStatus: "AVAILABLE" }),
      },
      slab: { findFirst: jest.fn() },
      inventoryLocation: { findFirstOrThrow: jest.fn() },
    };
    const service = serviceWithTx(tx);

    await expect(
      service.adjust("factory-a", "user-a", {
        movementType: "ADJUSTMENT",
        rawBlockId: "block-a",
        fromLocationId: "loc-other",
        toLocationId: "loc-b",
        quantity: 1,
        reason: "Bad source",
        idempotencyKey: "adjust-b",
      }),
    ).rejects.toThrow(BadRequestException);
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it("rejects a second reversal for the same original movement", async () => {
    const tx = {
      inventoryMovement: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: "movement-a",
            movementType: "ADJUSTMENT",
            rawBlockId: "block-a",
            slabId: null,
            fromLocationId: "loc-a",
            toLocationId: "loc-b",
            quantity: 1,
            areaSqft: null,
          })
          .mockResolvedValueOnce({ id: "reversal-a" }),
        create: jest.fn(),
      },
      rawBlock: { findFirst: jest.fn() },
      slab: { findFirst: jest.fn() },
      inventoryLocation: { findFirstOrThrow: jest.fn() },
    };
    const service = serviceWithTx(tx);

    await expect(
      service.reverseMovement("factory-a", "user-a", "movement-a", {
        reason: "Already reversed",
        idempotencyKey: "reverse-b",
      }),
    ).rejects.toThrow("Movement has already been reversed");
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });
});
