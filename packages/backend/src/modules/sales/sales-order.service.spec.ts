import { BadRequestException } from "@nestjs/common";
import { SalesOrderService } from "./sales-order.service";

describe("SalesOrderService operational follow-ups", () => {
  it("derives recovery from sale-time square feet and raw-block weight", async () => {
    const prisma = {
      rawBlock: { findMany: jest.fn().mockResolvedValue([{
        id: "block-1",
        serialNumber: "BLK-1",
        weightTons: 2,
        slabs: [
          { salesLines: [{ quantity: 120 }, { quantity: 40 }] },
          { salesLines: [{ quantity: 60 }] },
        ],
        cuttingSessions: [{ damagedSlabCount: 3, damagedCostAmount: 450 }],
      }]) },
    };
    const service = new SalesOrderService(prisma as never, {} as never);

    await expect(service.recoveryReport("factory-1")).resolves.toEqual([expect.objectContaining({
      serialNumber: "BLK-1",
      soldSqft: 220,
      sqftPerTon: 110,
      varianceFromBenchmark: 5,
      damagedSlabCount: 3,
      damagedCostAmount: 450,
    })]);
  });

  it("returns delivered slabs to finished stock with an append-only movement", async () => {
    const tx = {
      inventoryMovement: { findUnique: jest.fn().mockResolvedValue(null) },
      delivery: { findFirst: jest.fn().mockResolvedValue({ id: "delivery-1", lines: [{ slabId: "slab-1" }] }) },
      customerReturnLine: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      customerReturn: {
        create: jest.fn().mockResolvedValue({ id: "return-1" }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "return-1" }),
      },
      slab: {
        findFirst: jest.fn().mockResolvedValue({ id: "slab-1", inventoryStatus: "DELIVERED", locationId: "delivered" }),
        update: jest.fn(),
      },
    };
    const prisma = { $transaction: jest.fn((operation) => operation(tx)) };
    const inventory = {
      locationByCode: jest.fn().mockResolvedValue({ id: "finished", code: "FINISHED_STOCK" }),
      createMovement: jest.fn(),
    };
    const service = new SalesOrderService(prisma as never, inventory as never);

    await service.returnDelivered("factory-1", "manager-1", {
      deliveryId: "delivery-1",
      returnDate: "2026-07-16",
      slabIds: ["slab-1"],
      reason: "Customer rejected transport damage claim after inspection",
      idempotencyKey: "return-1",
    });

    expect(tx.slab.update).toHaveBeenCalledWith({ where: { id: "slab-1" }, data: expect.objectContaining({
      inventoryStatus: "AVAILABLE",
      inventorySourceType: "CUSTOMER_RETURN",
      locationId: "finished",
    }) });
    expect(inventory.createMovement).toHaveBeenCalledWith(tx, "factory-1", expect.objectContaining({
      movementType: "RETURN",
      fromLocationId: "delivered",
      toLocationId: "finished",
      referenceId: "return-1",
    }));
  });

  it("rejects a return containing a slab outside the selected delivery", async () => {
    const tx = {
      inventoryMovement: { findUnique: jest.fn().mockResolvedValue(null) },
      delivery: { findFirst: jest.fn().mockResolvedValue({ id: "delivery-1", lines: [{ slabId: "slab-1" }] }) },
    };
    const service = new SalesOrderService({ $transaction: (operation: any) => operation(tx) } as never, {} as never);

    await expect(service.returnDelivered("factory-1", "manager-1", {
      deliveryId: "delivery-1",
      returnDate: "2026-07-16",
      slabIds: ["slab-2"],
      reason: "Wrong item",
      idempotencyKey: "return-2",
    })).rejects.toBeInstanceOf(BadRequestException);
  });
});
