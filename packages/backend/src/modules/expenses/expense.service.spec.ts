import { BadRequestException } from "@nestjs/common";
import { ExpenseService } from "./expense.service";

describe("ExpenseService allocation", () => {
  it("rejects cumulative allocation beyond the expense total", async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: "expense-1" }]),
      expense: { findFirst: jest.fn().mockResolvedValue({ id: "expense-1", amount: 100 }) },
      rawBlock: { findMany: jest.fn().mockResolvedValue([{ id: "block-1" }]) },
      expenseAllocation: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { allocatedAmount: 80 } }),
        create: jest.fn(),
      },
    };
    const prisma = { $transaction: jest.fn((operation) => operation(tx)) };
    const service = new ExpenseService(prisma as never);

    await expect((service.allocate as any)("factory-1", "expense-1", "allocation-request-1", [
      { rawBlockId: "block-1", allocatedAmount: 30, allocationMethod: "manual" },
    ])).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.expenseAllocation.create).not.toHaveBeenCalled();
  });

  it("returns the original allocation rows for an idempotent retry", async () => {
    const existing = [{
      id: "allocation-1", expenseId: "expense-1", rawBlockId: "block-1",
      allocatedAmount: 30, allocationMethod: "manual",
    }];
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: "expense-1" }]),
      expense: { findFirst: jest.fn().mockResolvedValue({ id: "expense-1", amount: 100 }) },
      rawBlock: { findMany: jest.fn() },
      expenseAllocation: {
        findMany: jest.fn().mockResolvedValue(existing), aggregate: jest.fn(), create: jest.fn(),
      },
    };
    const prisma = { $transaction: jest.fn((operation) => operation(tx)) };
    const service = new ExpenseService(prisma as never);

    await expect((service.allocate as any)("factory-1", "expense-1", "allocation-request-1", [
      { rawBlockId: "block-1", allocatedAmount: 30, allocationMethod: "manual" },
    ])).resolves.toEqual(existing);
    expect(tx.rawBlock.findMany).not.toHaveBeenCalled();
    expect(tx.expenseAllocation.create).not.toHaveBeenCalled();
  });
});
