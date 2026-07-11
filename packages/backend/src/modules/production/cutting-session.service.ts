import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { InventoryWorkflowService } from "../inventory/inventory-workflow.service";
import { AbortWorkflowDto, CompleteCuttingDto, CuttingDayLogDto, StartCuttingDto } from "../../common/workflow.dto";

export function operationalDateFor(timestamp: Date): Date {
  const d = new Date(timestamp);
  if (d.getHours() < 7) d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class CuttingSessionService {
  constructor(
    private prisma: PrismaService,
    private inventory: InventoryWorkflowService,
  ) {}

  findActive(factoryId: string) {
    return this.prisma.cuttingSession.findMany({
      where: { factoryId, status: "IN_PROGRESS" },
      include: { rawBlock: { include: { location: true } }, dayLogs: { orderBy: { operationalDate: "asc" } } },
    });
  }

  findAll(factoryId: string) {
    return this.prisma.cuttingSession.findMany({
      where: { factoryId },
      include: { rawBlock: true, dayLogs: true, registeredSlabs: true },
      orderBy: { startedAt: "desc" },
    });
  }

  async start(factoryId: string, userId: string, input: StartCuttingDto) {
    return this.prisma.$transaction(async (tx) => {
      const existingMovement = await tx.inventoryMovement.findUnique({
        where: { factoryId_idempotencyKey: { factoryId, idempotencyKey: input.idempotencyKey } },
      });
      if (existingMovement?.cuttingSessionId) {
        return tx.cuttingSession.findUniqueOrThrow({ where: { id: existingMovement.cuttingSessionId } });
      }

      const factory = await tx.factory.findUniqueOrThrow({ where: { id: factoryId } });
      if (factory.operatingStatus !== "LIVE") throw new BadRequestException("Factory must be live before cutting can start");

      const block = await tx.rawBlock.findFirst({ where: { id: input.rawBlockId, factoryId }, include: { location: true } });
      if (!block) throw new NotFoundException("Block not found");
      if (block.verificationStatus !== "APPROVED" && block.verificationStatus !== "PHYSICALLY_VERIFIED") throw new BadRequestException("Block is not physically verified");
      if (block.productionStage !== "RAW") throw new BadRequestException(`Block stage is ${block.productionStage}`);
      if (block.inventoryStatus !== "AVAILABLE" && block.inventoryStatus !== "RESERVED") throw new BadRequestException(`Block inventory is ${block.inventoryStatus}`);
      if (!block.inventorySourceType) throw new BadRequestException("Block has no approved inventory source");
      if (!block.location || !["RAW_YARD", "B21_QUEUE"].includes(block.location.locationType)) throw new BadRequestException("Block is not in an eligible raw-yard/B-21 queue location");

      const machine = await tx.machine.findFirst({ where: { id: input.machineId, factoryId } });
      if (!machine) throw new NotFoundException("Machine not found");
      if (machine.machineType !== "CUTTING") throw new BadRequestException("Selected machine is not a cutting machine");

      const activeReservation = await tx.inventoryReservation.findFirst({ where: { factoryId, rawBlockId: block.id, status: "ACTIVE" } });
      if (activeReservation) throw new BadRequestException("Block already has an active reservation");
      const activeSession = await tx.cuttingSession.findFirst({ where: { factoryId, rawBlockId: block.id, status: "IN_PROGRESS" } });
      if (activeSession) throw new BadRequestException("Block already has an active cutting session");

      const b21Wip = await this.inventory.locationByCode(factoryId, "B21_WIP", tx);
      const reservation = await tx.inventoryReservation.create({
        data: {
          factoryId,
          rawBlockId: block.id,
          purpose: "CUTTING",
          referenceType: "CUTTING_SESSION",
          referenceId: input.idempotencyKey,
          createdBy: userId,
        },
      });
      const session = await tx.cuttingSession.create({
        data: {
          factoryId,
          rawBlockId: block.id,
          machineId: machine.id,
          startedAt: input.startedAt ? new Date(input.startedAt) : new Date(),
          expectedSlabCount: input.expectedSlabCount,
          blockReservationId: reservation.id,
        },
      });
      await tx.inventoryReservation.update({ where: { id: reservation.id }, data: { referenceId: session.id } });
      await this.inventory.createMovement(tx, factoryId, {
        movementType: "PRODUCTION_ISSUE",
        rawBlockId: block.id,
        fromLocationId: block.locationId,
        toLocationId: b21Wip.id,
        referenceType: "CUTTING_SESSION",
        referenceId: session.id,
        cuttingSessionId: session.id,
        createdBy: userId,
        idempotencyKey: input.idempotencyKey,
      });
      await tx.rawBlock.update({
        where: { id: block.id },
        data: {
          productionStage: "UNDER_CUTTING",
          inventoryStatus: "RESERVED",
          locationId: b21Wip.id,
          currentStatus: "under_cutting",
          currentLocation: b21Wip.code,
        },
      });
      await tx.blockStateTransition.create({
        data: { rawBlockId: block.id, fromState: block.currentStatus, toState: "under_cutting", machineId: machine.id, userId },
      });
      return session;
    }, { isolationLevel: "Serializable" });
  }

  async upsertDayLog(factoryId: string, sessionId: string, userId: string, input: CuttingDayLogDto) {
    const session = await this.prisma.cuttingSession.findFirst({ where: { id: sessionId, factoryId } });
    if (!session) throw new NotFoundException("Cutting session not found");
    if (session.status !== "IN_PROGRESS") throw new BadRequestException("Cutting session is not active");
    return this.prisma.cuttingDayLog.upsert({
      where: {
        cuttingSessionId_operationalDate: {
          cuttingSessionId: sessionId,
          operationalDate: new Date(input.operationalDate),
        },
      },
      update: { ...input, operationalDate: new Date(input.operationalDate), operatorId: userId },
      create: { cuttingSessionId: sessionId, ...input, operationalDate: new Date(input.operationalDate), operatorId: userId },
    });
  }

  async complete(factoryId: string, userId: string, sessionId: string, input: CompleteCuttingDto) {
    if (input.finalGoodSlabCount > input.totalSlabsCut) throw new BadRequestException("finalGoodSlabCount cannot exceed totalSlabsCut");
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.cuttingSession.findFirst({
        where: { id: sessionId, factoryId },
        include: { rawBlock: true, blockReservation: true, registeredSlabs: true },
      });
      if (!session) throw new NotFoundException("Cutting session not found");
      if (session.status === "COMPLETED") return { session, damagedSlabCount: session.damagedSlabCount ?? 0, createdSlabs: session.registeredSlabs };
      if (session.status !== "IN_PROGRESS") throw new BadRequestException("Session is not in progress");
      const endedAt = input.endedAt ? new Date(input.endedAt) : new Date();
      if (endedAt < session.startedAt) throw new BadRequestException("Completion time cannot be before start time");

      const damagedSlabCount = input.totalSlabsCut - input.finalGoodSlabCount;
      const unpolishedStock = await this.inventory.locationByCode(factoryId, "UNPOLISHED_STOCK", tx);
      const updated = await tx.cuttingSession.update({
        where: { id: sessionId },
        data: {
          status: "COMPLETED",
          endedAt,
          totalSlabsCut: input.totalSlabsCut,
          finalGoodSlabCount: input.finalGoodSlabCount,
          damagedSlabCount,
          wastageNotes: input.wastageNotes,
        },
      });

      const createdSlabs = [];
      for (let seq = 1; seq <= input.finalGoodSlabCount; seq++) {
        const slabSerial = `${session.rawBlock.serialNumber}/${input.totalSlabsCut}/${String(seq).padStart(2, "0")}`;
        const slab = await tx.slab.create({
          data: {
            factoryId,
            parentBlockId: session.rawBlockId,
            cuttingSessionId: session.id,
            slabSerial,
            varietyName: session.rawBlock.varietyName,
            lengthFt: input.lengthFt,
            widthFt: input.widthFt,
            thicknessMm: input.thicknessMm ?? 18.0,
            productionStage: "CUT_UNPOLISHED",
            inventoryStatus: "AVAILABLE",
            locationId: unpolishedStock.id,
            inventorySourceType: "PRODUCTION_COMPLETION",
            lineageStatus: "LIVE_PARENTED",
            salesStatus: "in_stock",
            currentLocation: unpolishedStock.code,
          },
        });
        await this.inventory.createMovement(tx, factoryId, {
          movementType: "PRODUCTION_COMPLETION",
          slabId: slab.id,
          toLocationId: unpolishedStock.id,
          referenceType: "CUTTING_SESSION",
          referenceId: session.id,
          cuttingSessionId: session.id,
          createdBy: userId,
          idempotencyKey: `${input.idempotencyKey}:slab:${seq}`,
        });
        createdSlabs.push(slab);
      }

      await tx.rawBlock.update({
        where: { id: session.rawBlockId },
        data: { productionStage: "CONSUMED", inventoryStatus: "CONSUMED", currentStatus: "cut" },
      });
      if (session.blockReservationId) {
        await tx.inventoryReservation.update({ where: { id: session.blockReservationId }, data: { status: "CONSUMED", consumedBy: userId, consumedAt: new Date() } });
      }
      await tx.blockStateTransition.create({
        data: { rawBlockId: session.rawBlockId, fromState: session.rawBlock.currentStatus, toState: "cut", machineId: session.machineId, userId },
      });
      return { session: updated, damagedSlabCount, createdSlabs };
    }, { isolationLevel: "Serializable" });
  }

  async abort(factoryId: string, userId: string, sessionId: string, input: AbortWorkflowDto) {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.cuttingSession.findFirst({ where: { id: sessionId, factoryId }, include: { rawBlock: true } });
      if (!session) throw new NotFoundException("Cutting session not found");
      if (session.status !== "IN_PROGRESS") throw new BadRequestException("Only active sessions can be aborted");
      const rawYard = await this.inventory.locationByCode(factoryId, "RAW_YARD", tx);
      await tx.cuttingSession.update({ where: { id: session.id }, data: { status: "ABORTED", endedAt: new Date(), wastageNotes: input.reason } });
      if (session.blockReservationId) await tx.inventoryReservation.update({ where: { id: session.blockReservationId }, data: { status: "RELEASED", releasedBy: userId, releasedAt: new Date() } });
      await tx.rawBlock.update({ where: { id: session.rawBlockId }, data: { productionStage: "RAW", inventoryStatus: "AVAILABLE", locationId: rawYard.id, currentStatus: "in_stock", currentLocation: rawYard.code } });
      await this.inventory.createMovement(tx, factoryId, {
        movementType: "RESERVATION_RELEASE",
        rawBlockId: session.rawBlockId,
        fromLocationId: session.rawBlock.locationId,
        toLocationId: rawYard.id,
        referenceType: "CUTTING_ABORT",
        referenceId: session.id,
        cuttingSessionId: session.id,
        createdBy: userId,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
      });
      return tx.cuttingSession.findUniqueOrThrow({ where: { id: session.id }, include: { rawBlock: true } });
    });
  }
}
