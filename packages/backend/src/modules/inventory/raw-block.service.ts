import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";

interface CreateRawBlockInput {
  serialNumber: string;
  varietyName: string;
  supplierId?: string;
  weightTons?: number;
  purchaseDate?: string;
  invoicedAmount?: number;
  actualAmountPaid?: number;
  gstRate?: number;
}

interface TransitionInput {
  toState: string;
  machineId?: string;
  userId: string;
  notes?: string;
}

@Injectable()
export class RawBlockService {
  constructor(private prisma: PrismaService) {}

  findAll(factoryId: string) {
    return this.prisma.rawBlock.findMany({
      where: { factoryId },
      include: { location: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async eligibleForCutting(factoryId: string) {
    const factory = await this.prisma.factory.findUniqueOrThrow({ where: { id: factoryId } });
    const blocks = await this.prisma.rawBlock.findMany({ where: { factoryId }, include: { location: true, reservations: { where: { status: "ACTIVE" } } } });
    return blocks.map((block) => {
      const reasons: string[] = [];
      if (factory.operatingStatus !== "LIVE") reasons.push("factory is not live");
      if (block.verificationStatus !== "APPROVED" && block.verificationStatus !== "PHYSICALLY_VERIFIED") reasons.push("not physically verified");
      if (block.productionStage !== "RAW") reasons.push(`production stage is ${block.productionStage}`);
      if (block.inventoryStatus !== "AVAILABLE" && block.inventoryStatus !== "RESERVED") reasons.push(`inventory status is ${block.inventoryStatus}`);
      if (!block.location || !["RAW_YARD", "B21_QUEUE"].includes(block.location.locationType)) reasons.push("not in raw yard or B-21 queue");
      if (!block.inventorySourceType) reasons.push("missing approved inventory source");
      if (block.reservations.length > 0) reasons.push("already reserved");
      return { ...block, eligible: reasons.length === 0, ineligibleReasons: reasons };
    });
  }

  findOne(factoryId: string, id: string) {
    return this.prisma.rawBlock.findFirst({
      where: { id, factoryId },
      include: { transitions: { orderBy: { occurredAt: "asc" } }, slabs: true },
    });
  }

  create(factoryId: string, input: CreateRawBlockInput) {
    return this.prisma.rawBlock.create({
      data: { factoryId, currentStatus: "in_stock", ...input },
    });
  }

  // The ONLY way a block's status changes. Never PATCH currentStatus
  // directly — this keeps the transition log the single source of truth,
  // which is the whole point of the traceability design.
  async transition(factoryId: string, blockId: string, input: TransitionInput) {
    const block = await this.prisma.rawBlock.findFirstOrThrow({ where: { id: blockId, factoryId } });

    return this.prisma.$transaction([
      this.prisma.blockStateTransition.create({
        data: {
          rawBlockId: blockId,
          fromState: block.currentStatus,
          toState: input.toState,
          machineId: input.machineId,
          userId: input.userId,
          notes: input.notes,
        },
      }),
      this.prisma.rawBlock.update({
        where: { id: blockId },
        data: { currentStatus: input.toState },
      }),
    ]);
  }
}
