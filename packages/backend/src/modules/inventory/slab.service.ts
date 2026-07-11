import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";

interface CreateSlabInput {
  parentBlockId: string;
  slabSerial: string;
  varietyName: string;
  thicknessMm?: number;
  lengthFt?: number;
  widthFt?: number;
  finish?: string;
}

@Injectable()
export class SlabService {
  constructor(private prisma: PrismaService) {}

  findAll(factoryId: string) {
    return this.prisma.slab.findMany({ where: { factoryId }, include: { location: true, parentBlock: true, reservations: { where: { status: "ACTIVE" } } }, orderBy: { createdAt: "desc" } });
  }

  async eligibleForPolishing(factoryId: string) {
    const slabs = await this.prisma.slab.findMany({ where: { factoryId }, include: { location: true, reservations: { where: { status: "ACTIVE" } } } });
    return slabs.map((slab) => {
      const reasons: string[] = [];
      if (slab.productionStage !== "CUT_UNPOLISHED") reasons.push(`production stage is ${slab.productionStage}`);
      if (slab.inventoryStatus !== "AVAILABLE" && slab.inventoryStatus !== "RESERVED") reasons.push(`inventory status is ${slab.inventoryStatus}`);
      if (!slab.location || !["UNPOLISHED_STOCK", "LPM_QUEUE"].includes(slab.location.locationType)) reasons.push("not in unpolished stock or LPM queue");
      if (slab.reservations.length > 0) reasons.push("already reserved");
      return { ...slab, eligible: reasons.length === 0, ineligibleReasons: reasons };
    });
  }

  async eligibleForSale(factoryId: string) {
    const slabs = await this.prisma.slab.findMany({ where: { factoryId }, include: { location: true, reservations: { where: { status: "ACTIVE" } } } });
    return slabs.map((slab) => {
      const reasons: string[] = [];
      if (slab.productionStage !== "POLISHED") reasons.push(`production stage is ${slab.productionStage}`);
      if (slab.inventoryStatus !== "AVAILABLE") reasons.push(`inventory status is ${slab.inventoryStatus}`);
      if (!slab.location || slab.location.locationType !== "FINISHED_STOCK") reasons.push("not in finished stock");
      if (slab.reservations.length > 0) reasons.push("already reserved");
      return { ...slab, eligible: reasons.length === 0, ineligibleReasons: reasons };
    });
  }

  findOne(factoryId: string, id: string) {
    return this.prisma.slab.findFirst({
      where: { id, factoryId },
      include: { transitions: { orderBy: { occurredAt: "asc" } }, parentBlock: true },
    });
  }

  create(factoryId: string, input: CreateSlabInput) {
    return this.prisma.slab.create({
      data: { factoryId, salesStatus: "in_stock", ...input },
    });
  }

  async transition(factoryId: string, slabId: string, toState: string, userId: string, machineId?: string, notes?: string) {
    const slab = await this.prisma.slab.findFirstOrThrow({ where: { id: slabId, factoryId } });

    return this.prisma.$transaction([
      this.prisma.slabStateTransition.create({
        data: { slabId, fromState: slab.salesStatus, toState, machineId, userId, notes },
      }),
      this.prisma.slab.update({ where: { id: slabId }, data: { salesStatus: toState } }),
    ]);
  }
}
