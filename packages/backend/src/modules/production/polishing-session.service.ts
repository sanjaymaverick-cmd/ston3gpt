import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { InventoryWorkflowService } from "../inventory/inventory-workflow.service";
import { AbortWorkflowDto, CreatePolishingDto } from "../../common/workflow.dto";

@Injectable()
export class PolishingSessionService {
  constructor(
    private prisma: PrismaService,
    private inventory: InventoryWorkflowService,
  ) {}

  findByDate(factoryId: string, operationalDate: string) {
    return this.prisma.polishingSession.findMany({
      where: { factoryId, operationalDate: new Date(operationalDate) },
      include: { slabs: { include: { slab: true } } },
    });
  }

  async create(factoryId: string, userId: string, input: CreatePolishingDto) {
    if (new Set(input.slabIds).size !== input.slabIds.length) throw new BadRequestException("Duplicate slab IDs are not allowed");
    return this.prisma.$transaction(async (tx) => {
      const machine = await tx.machine.findFirst({ where: { id: input.machineId, factoryId } });
      if (!machine) throw new NotFoundException("Machine not found");
      if (machine.machineType !== "POLISHING") throw new BadRequestException("Selected machine is not a polishing machine");

      const slabs = await tx.slab.findMany({ where: { id: { in: input.slabIds }, factoryId }, include: { location: true, reservations: { where: { status: "ACTIVE" } } } });
      if (slabs.length !== input.slabIds.length) throw new BadRequestException("One or more slabs not found in this factory");
      for (const slab of slabs) {
        if (slab.productionStage !== "CUT_UNPOLISHED") throw new BadRequestException(`Slab ${slab.slabSerial} is not cut/unpolished`);
        if (slab.inventoryStatus !== "AVAILABLE" && slab.inventoryStatus !== "RESERVED") throw new BadRequestException(`Slab ${slab.slabSerial} is not available for polishing`);
        if (!slab.location || !["UNPOLISHED_STOCK", "LPM_QUEUE"].includes(slab.location.locationType)) throw new BadRequestException(`Slab ${slab.slabSerial} is not in an LPM issue location`);
        if (slab.reservations.length) throw new BadRequestException(`Slab ${slab.slabSerial} already has an active reservation`);
      }

      const lpmWip = await this.inventory.locationByCode(factoryId, "LPM_WIP", tx);
      const session = await tx.polishingSession.create({
        data: {
          factoryId,
          machineId: input.machineId,
          operationalDate: new Date(input.operationalDate),
          finishType: input.finishType,
          runtimeHours: input.runtimeHours,
          powerConsumptionKwh: input.powerConsumptionKwh,
          downtimeMinutes: input.downtimeMinutes,
          downtimeReason: input.downtimeReason,
          operatorId: userId,
          notes: input.notes,
        },
      });

      for (const slab of slabs) {
        const reservation = await tx.inventoryReservation.create({
          data: {
            factoryId,
            slabId: slab.id,
            purpose: "POLISHING",
            referenceType: "POLISHING_SESSION",
            referenceId: session.id,
            polishingSessionId: session.id,
            createdBy: userId,
          },
        });
        await tx.polishingSessionSlab.create({ data: { polishingSessionId: session.id, slabId: slab.id } });
        await tx.slabStateTransition.create({ data: { slabId: slab.id, fromState: slab.salesStatus, toState: "under_polishing", machineId: input.machineId, userId } });
        await tx.slab.update({
          where: { id: slab.id },
          data: {
            productionStage: "UNDER_POLISHING",
            inventoryStatus: "RESERVED",
            locationId: lpmWip.id,
            currentLocation: lpmWip.code,
            salesStatus: "under_polishing",
          },
        });
        await this.inventory.createMovement(tx, factoryId, {
          movementType: "POLISHING_ISSUE",
          slabId: slab.id,
          fromLocationId: slab.locationId,
          toLocationId: lpmWip.id,
          referenceType: "POLISHING_SESSION",
          referenceId: session.id,
          polishingSessionId: session.id,
          createdBy: userId,
          idempotencyKey: `${input.idempotencyKey}:issue:${slab.id}:${reservation.id}`,
        });
      }

      return tx.polishingSession.findUniqueOrThrow({ where: { id: session.id }, include: { slabs: { include: { slab: true } } } });
    }, { isolationLevel: "Serializable" });
  }

  async complete(factoryId: string, userId: string, sessionId: string, idempotencyKey: string) {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.polishingSession.findFirst({
        where: { id: sessionId, factoryId },
        include: { slabs: { include: { slab: true } }, reservations: { where: { status: "ACTIVE" } } },
      });
      if (!session) throw new NotFoundException("Polishing session not found");
      if (session.status === "COMPLETED") return session;
      if (session.status !== "IN_PROGRESS") throw new BadRequestException("Polishing session is not active");
      const finishedStock = await this.inventory.locationByCode(factoryId, "FINISHED_STOCK", tx);
      for (const row of session.slabs) {
        await tx.slab.update({
          where: { id: row.slabId },
          data: {
            productionStage: "POLISHED",
            inventoryStatus: "AVAILABLE",
            locationId: finishedStock.id,
            finish: session.finishType,
            polishFinishType: session.finishType,
            salesStatus: "polished",
            currentLocation: finishedStock.code,
          },
        });
        await tx.slabStateTransition.create({ data: { slabId: row.slabId, fromState: row.slab.salesStatus, toState: "polished", machineId: session.machineId, userId } });
        await this.inventory.createMovement(tx, factoryId, {
          movementType: "POLISHING_COMPLETION",
          slabId: row.slabId,
          fromLocationId: row.slab.locationId,
          toLocationId: finishedStock.id,
          referenceType: "POLISHING_SESSION",
          referenceId: session.id,
          polishingSessionId: session.id,
          createdBy: userId,
          idempotencyKey: `${idempotencyKey}:complete:${row.slabId}`,
        });
      }
      await tx.inventoryReservation.updateMany({ where: { factoryId, polishingSessionId: session.id, status: "ACTIVE" }, data: { status: "CONSUMED", consumedBy: userId, consumedAt: new Date() } });
      return tx.polishingSession.update({ where: { id: session.id }, data: { status: "COMPLETED", slabsPolishedCount: session.slabs.length }, include: { slabs: { include: { slab: true } } } });
    }, { isolationLevel: "Serializable" });
  }

  async abort(factoryId: string, userId: string, sessionId: string, input: AbortWorkflowDto) {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.polishingSession.findFirst({ where: { id: sessionId, factoryId }, include: { slabs: { include: { slab: true } } } });
      if (!session) throw new NotFoundException("Polishing session not found");
      if (session.status !== "IN_PROGRESS") throw new BadRequestException("Only active polishing sessions can be aborted");
      const stock = await this.inventory.locationByCode(factoryId, "UNPOLISHED_STOCK", tx);
      for (const row of session.slabs) {
        await tx.slab.update({ where: { id: row.slabId }, data: { productionStage: "CUT_UNPOLISHED", inventoryStatus: "AVAILABLE", locationId: stock.id, salesStatus: "in_stock", currentLocation: stock.code } });
        await this.inventory.createMovement(tx, factoryId, {
          movementType: "RESERVATION_RELEASE",
          slabId: row.slabId,
          fromLocationId: row.slab.locationId,
          toLocationId: stock.id,
          referenceType: "POLISHING_ABORT",
          referenceId: session.id,
          polishingSessionId: session.id,
          createdBy: userId,
          reason: input.reason,
          idempotencyKey: `${input.idempotencyKey}:release:${row.slabId}`,
        });
      }
      await tx.inventoryReservation.updateMany({ where: { factoryId, polishingSessionId: session.id, status: "ACTIVE" }, data: { status: "RELEASED", releasedBy: userId, releasedAt: new Date() } });
      return tx.polishingSession.update({ where: { id: session.id }, data: { status: "ABORTED", notes: input.reason }, include: { slabs: { include: { slab: true } } } });
    });
  }
}
