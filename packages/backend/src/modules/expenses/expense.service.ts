import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { Prisma } from "@prisma/client";

// Matches the real category list surfaced from Vedam Granites' cash-book —
// see stoneos-mvp-schema.sql notes. Keep this list and the DPR entry UI's
// EXPENSE_CATEGORIES in sync manually.
export const EXPENSE_CATEGORIES = [
  "block_rent", "royalty", "block_purchase_transport", "consumables_epoxy_battery",
  "maintenance", "construction", "contractor_pay", "vehicle", "mess", "phone",
  "official", "commission", "medical", "staff_salary", "misc", "loan_payment", "gst_return_paid",
];

interface CreateExpenseInput {
  category: string;
  amount: number;
  expenseDate: string;
  vehicleId?: string;
  toWhom?: string;
}

interface AllocationInput {
  rawBlockId: string;
  allocatedAmount: number;
  allocationMethod: "by_weight" | "by_area" | "manual";
}

@Injectable()
export class ExpenseService {
  constructor(private prisma: PrismaService) {}

  findAll(factoryId: string, from?: string, to?: string) {
    return this.prisma.expense.findMany({
      where: {
        factoryId,
        ...(from && to ? { expenseDate: { gte: new Date(from), lte: new Date(to) } } : {}),
      },
      include: { vehicle: true, allocations: true },
      orderBy: { expenseDate: "desc" },
    });
  }

  async create(factoryId: string, input: CreateExpenseInput) {
    if (!EXPENSE_CATEGORIES.includes(input.category)) {
      throw new BadRequestException(`Unknown category: ${input.category}`);
    }
    if (input.category === "vehicle" && !input.vehicleId) {
      throw new BadRequestException("vehicleId is required when category is 'vehicle'");
    }
    if (input.vehicleId) {
      const vehicle = await this.prisma.vehicle.findFirst({ where: { id: input.vehicleId, factoryId }, select: { id: true } });
      if (!vehicle) throw new NotFoundException("Vehicle not found");
    }
    return this.prisma.expense.create({
      data: {
        factoryId,
        category: input.category,
        amount: input.amount,
        expenseDate: new Date(input.expenseDate),
        vehicleId: input.vehicleId,
        toWhom: input.toWhom,
      },
    });
  }

  // Cost allocation for cost-per-slab / cost-per-sqft reporting (V2 per
  // the schema notes, but the endpoint shape is worth having now). Rejects
  // over-allocation past the expense's own amount to keep the numbers honest.
  async allocate(factoryId: string, expenseId: string, idempotencyKey: string, allocations: AllocationInput[]) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "expense" WHERE id = ${expenseId} AND factory_id = ${factoryId} FOR UPDATE`);
      const expense = await tx.expense.findFirst({ where: { id: expenseId, factoryId } });
      if (!expense) throw new NotFoundException("Expense not found");

      const existing = await tx.expenseAllocation.findMany({
        where: { expenseId, allocationBatchKey: idempotencyKey }, orderBy: { rawBlockId: "asc" },
      });
      if (existing.length) {
        const requested = [...allocations].sort((a, b) => a.rawBlockId.localeCompare(b.rawBlockId));
        const matches = existing.length === requested.length && existing.every((row, index) =>
          row.rawBlockId === requested[index].rawBlockId
          && Number(row.allocatedAmount) === requested[index].allocatedAmount
          && row.allocationMethod === requested[index].allocationMethod,
        );
        if (!matches) throw new BadRequestException("Idempotency key was already used for a different allocation request");
        return existing;
      }

      const rawBlockIds = [...new Set(allocations.map((allocation) => allocation.rawBlockId))];
      if (rawBlockIds.length !== allocations.length) throw new BadRequestException("Each raw block may appear only once per allocation request");
      const rawBlocks = await tx.rawBlock.findMany({ where: { id: { in: rawBlockIds }, factoryId }, select: { id: true } });
      if (rawBlocks.length !== rawBlockIds.length) throw new NotFoundException("One or more raw blocks not found");

      const prior = await tx.expenseAllocation.aggregate({ where: { expenseId }, _sum: { allocatedAmount: true } });
      const totalAllocated = allocations.reduce((sum, allocation) => sum + allocation.allocatedAmount, Number(prior._sum.allocatedAmount ?? 0));
      if (totalAllocated > Number(expense.amount)) throw new BadRequestException("Allocated amount exceeds the expense total");

      const created = [];
      for (const allocation of allocations) {
        created.push(await tx.expenseAllocation.create({
          data: {
            expenseId, rawBlockId: allocation.rawBlockId, allocatedAmount: allocation.allocatedAmount,
            allocationMethod: allocation.allocationMethod, allocationBatchKey: idempotencyKey,
          },
        }));
      }
      return created;
    }, { isolationLevel: "Serializable" });
  }
}
