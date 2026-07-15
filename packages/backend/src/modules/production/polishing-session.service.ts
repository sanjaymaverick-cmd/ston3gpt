import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { InventoryWorkflowService } from "../inventory/inventory-workflow.service";
import { AbortWorkflowDto, ApplyEpoxyDto, CreatePolishingDto } from "../../common/workflow.dto";

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
      const requiredStage = input.processType === "GRINDING" ? "CUT_UNPOLISHED" : "EPOXY_APPLIED";
      for (const slab of slabs) {
        if (slab.productionStage !== requiredStage) throw new BadRequestException(`Slab ${slab.slabSerial} must be ${requiredStage} before ${input.processType.toLowerCase()}`);
        if (slab.inventoryStatus !== "AVAILABLE" && slab.inventoryStatus !== "RESERVED") throw new BadRequestException(`Slab ${slab.slabSerial} is not available for LPM processing`);
        const eligibleLocations = input.processType === "GRINDING" ? ["UNPOLISHED_STOCK", "LPM_QUEUE"] : ["LPM_QUEUE"];
        if (!slab.location || !eligibleLocations.includes(slab.location.locationType)) throw new BadRequestException(`Slab ${slab.slabSerial} is not in an eligible LPM issue location`);
        if (slab.reservations.length) throw new BadRequestException(`Slab ${slab.slabSerial} already has an active reservation`);
      }

      const lpmWip = await this.inventory.locationByCode(factoryId, "LPM_WIP", tx);
      const session = await tx.polishingSession.create({
        data: {
          factoryId,
          machineId: input.machineId,
          operationalDate: new Date(input.operationalDate),
          processType: input.processType,
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
        const underProcess = input.processType === "GRINDING" ? "under_grinding" : "under_polishing";
        await tx.slabStateTransition.create({ data: { slabId: slab.id, fromState: slab.salesStatus, toState: underProcess, machineId: input.machineId, userId } });
        await tx.slab.update({
          where: { id: slab.id },
          data: {
            productionStage: input.processType === "GRINDING" ? "UNDER_GRINDING" : "UNDER_POLISHING",
            inventoryStatus: "RESERVED",
            locationId: lpmWip.id,
            currentLocation: lpmWip.code,
            salesStatus: underProcess,
          },
        });
        await this.inventory.createMovement(tx, factoryId, {
          movementType: "POLISHING_ISSUE",
          slabId: slab.id,
          fromLocationId: slab.locationId,
          toLocationId: lpmWip.id,
          referenceType: `${input.processType}_SESSION`,
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
      const isGrinding = session.processType === "GRINDING";
      const expectedStage = isGrinding ? "UNDER_GRINDING" : "UNDER_POLISHING";
      const lpmWip = await this.inventory.locationByCode(factoryId, "LPM_WIP", tx);
      const targetLocation = await this.inventory.locationByCode(factoryId, isGrinding ? "LPM_QUEUE" : "FINISHED_STOCK", tx);
      const activeReservationSlabIds = new Set(session.reservations.map((reservation) => reservation.slabId));
      for (const row of session.slabs) {
        if (
          row.slab.productionStage !== expectedStage
          || row.slab.inventoryStatus !== "RESERVED"
          || row.slab.locationId !== lpmWip.id
          || !activeReservationSlabIds.has(row.slabId)
        ) {
          throw new BadRequestException(`Slab ${row.slab.slabSerial} changed after this LPM session started; reconcile inventory before completion`);
        }
        const updated = await tx.slab.updateMany({
          where: {
            id: row.slabId,
            factoryId,
            productionStage: expectedStage,
            inventoryStatus: "RESERVED",
            locationId: lpmWip.id,
          },
          data: {
            productionStage: isGrinding ? "GRINDED" : "POLISHED",
            inventoryStatus: "AVAILABLE",
            locationId: targetLocation.id,
            ...(isGrinding ? {} : { finish: session.finishType, polishFinishType: session.finishType }),
            salesStatus: isGrinding ? "grinded" : "polished",
            currentLocation: targetLocation.code,
          },
        });
        if (updated.count !== 1) throw new BadRequestException(`Slab ${row.slab.slabSerial} changed during LPM completion; retry after reconciling inventory`);
        await tx.slabStateTransition.create({ data: { slabId: row.slabId, fromState: row.slab.salesStatus, toState: isGrinding ? "grinded" : "polished", machineId: session.machineId, userId } });
        await this.inventory.createMovement(tx, factoryId, {
          movementType: "POLISHING_COMPLETION",
          slabId: row.slabId,
          fromLocationId: row.slab.locationId,
          toLocationId: targetLocation.id,
          referenceType: `${session.processType}_SESSION`,
          referenceId: session.id,
          polishingSessionId: session.id,
          createdBy: userId,
          idempotencyKey: `${idempotencyKey}:complete:${row.slabId}`,
        });
      }
      const consumed = await tx.inventoryReservation.updateMany({ where: { factoryId, polishingSessionId: session.id, status: "ACTIVE" }, data: { status: "CONSUMED", consumedBy: userId, consumedAt: new Date() } });
      if (consumed.count !== session.slabs.length) throw new BadRequestException("LPM reservations changed during completion; retry after reconciling inventory");
      return tx.polishingSession.update({ where: { id: session.id }, data: { status: "COMPLETED", slabsPolishedCount: session.slabs.length }, include: { slabs: { include: { slab: true } } } });
    }, { isolationLevel: "Serializable" });
  }

  async abort(factoryId: string, userId: string, sessionId: string, input: AbortWorkflowDto) {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.polishingSession.findFirst({
        where: { id: sessionId, factoryId },
        include: { slabs: { include: { slab: true } }, reservations: { where: { status: "ACTIVE" } } },
      });
      if (!session) throw new NotFoundException("Polishing session not found");
      if (session.status !== "IN_PROGRESS") throw new BadRequestException("Only active polishing sessions can be aborted");
      const isGrinding = session.processType === "GRINDING";
      const expectedStage = isGrinding ? "UNDER_GRINDING" : "UNDER_POLISHING";
      const lpmWip = await this.inventory.locationByCode(factoryId, "LPM_WIP", tx);
      const stock = await this.inventory.locationByCode(factoryId, isGrinding ? "UNPOLISHED_STOCK" : "LPM_QUEUE", tx);
      const activeReservationSlabIds = new Set(session.reservations.map((reservation) => reservation.slabId));
      for (const row of session.slabs) {
        if (
          row.slab.productionStage !== expectedStage
          || row.slab.inventoryStatus !== "RESERVED"
          || row.slab.locationId !== lpmWip.id
          || !activeReservationSlabIds.has(row.slabId)
        ) {
          throw new BadRequestException(`Slab ${row.slab.slabSerial} changed after this LPM session started; reconcile inventory before aborting`);
        }
        const updated = await tx.slab.updateMany({
          where: {
            id: row.slabId,
            factoryId,
            productionStage: expectedStage,
            inventoryStatus: "RESERVED",
            locationId: lpmWip.id,
          },
          data: { productionStage: isGrinding ? "CUT_UNPOLISHED" : "EPOXY_APPLIED", inventoryStatus: "AVAILABLE", locationId: stock.id, salesStatus: isGrinding ? "in_stock" : "epoxy_applied", currentLocation: stock.code },
        });
        if (updated.count !== 1) throw new BadRequestException(`Slab ${row.slab.slabSerial} changed during LPM abort; retry after reconciling inventory`);
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
      const released = await tx.inventoryReservation.updateMany({ where: { factoryId, polishingSessionId: session.id, status: "ACTIVE" }, data: { status: "RELEASED", releasedBy: userId, releasedAt: new Date() } });
      if (released.count !== session.slabs.length) throw new BadRequestException("LPM reservations changed during abort; retry after reconciling inventory");
      return tx.polishingSession.update({ where: { id: session.id }, data: { status: "ABORTED", notes: input.reason }, include: { slabs: { include: { slab: true } } } });
    });
  }

  async applyEpoxy(factoryId: string, userId: string, input: ApplyEpoxyDto) {
    if (new Set(input.slabIds).size !== input.slabIds.length) throw new BadRequestException("Duplicate slab IDs are not allowed");
    return this.prisma.$transaction(async (tx) => {
      const slabs = await tx.slab.findMany({
        where: { id: { in: input.slabIds }, factoryId },
        include: { location: true, reservations: { where: { status: "ACTIVE" } } },
      });
      if (slabs.length !== input.slabIds.length) throw new BadRequestException("One or more slabs not found in this factory");
      for (const slab of slabs) {
        if (!["GRINDED", "EPOXY_APPLIED"].includes(slab.productionStage)) throw new BadRequestException(`Slab ${slab.slabSerial} must be grinded before epoxy`);
        if (slab.inventoryStatus !== "AVAILABLE") throw new BadRequestException(`Slab ${slab.slabSerial} is not available for epoxy`);
        if (!slab.location || slab.location.locationType !== "LPM_QUEUE") throw new BadRequestException(`Slab ${slab.slabSerial} is not in the LPM queue`);
        if (slab.reservations.length) throw new BadRequestException(`Slab ${slab.slabSerial} already has an active reservation`);
        if (slab.productionStage === "EPOXY_APPLIED") continue;
        await tx.slab.update({ where: { id: slab.id }, data: { productionStage: "EPOXY_APPLIED", salesStatus: "epoxy_applied" } });
        await tx.slabStateTransition.create({ data: { slabId: slab.id, fromState: slab.salesStatus, toState: "epoxy_applied", userId, notes: input.notes } });
        await this.inventory.createMovement(tx, factoryId, {
          movementType: "TRANSFER",
          slabId: slab.id,
          fromLocationId: slab.locationId,
          toLocationId: slab.locationId,
          referenceType: "EPOXY_APPLICATION",
          referenceId: input.idempotencyKey,
          createdBy: userId,
          reason: input.notes ?? "Epoxy applied after grinding",
          idempotencyKey: `${input.idempotencyKey}:epoxy:${slab.id}`,
        });
      }
      return tx.slab.findMany({ where: { id: { in: input.slabIds }, factoryId }, include: { location: true } });
    }, { isolationLevel: "Serializable" });
  }
}
