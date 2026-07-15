import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import {
  BlockProductionStage,
  FactoryOperatingStatus,
  GoodsReceiptStatus,
  InventoryKind,
  InventoryMovementType,
  InventorySourceType,
  InventoryStatus,
  InventoryLocationType,
  OpeningSnapshotStatus,
  Prisma,
  SlabLineageStatus,
  SlabProductionStage,
  VerificationStatus,
} from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import {
  AddOpeningRawBlockDto,
  AddOpeningSlabDto,
  CreateGoodsReceiptDto,
  CreateOpeningSnapshotDto,
  InventoryAdjustmentDto,
  ReverseMovementDto,
} from "../../common/workflow.dto";

const REQUIRED_LOCATIONS: Array<{ code: string; name: string; locationType: InventoryLocationType }> = [
  { code: "RAW_YARD", name: "Raw Yard", locationType: "RAW_YARD" },
  { code: "B21_QUEUE", name: "B-21 Queue", locationType: "B21_QUEUE" },
  { code: "B21_WIP", name: "B-21 WIP", locationType: "B21_WIP" },
  { code: "UNPOLISHED_STOCK", name: "Unpolished Stock", locationType: "UNPOLISHED_STOCK" },
  { code: "LPM_QUEUE", name: "LPM Queue", locationType: "LPM_QUEUE" },
  { code: "LPM_WIP", name: "LPM WIP", locationType: "LPM_WIP" },
  { code: "FINISHED_STOCK", name: "Finished Stock", locationType: "FINISHED_STOCK" },
  { code: "HOLD", name: "Hold", locationType: "HOLD" },
  { code: "DELIVERED", name: "Delivered", locationType: "DELIVERED" },
];

type InventoryItemSnapshot = {
  id: string;
  locationId: string | null;
  inventoryStatus: InventoryStatus;
};

type ManualMovementSnapshotInput = {
  rawBlockId?: string | null;
  slabId?: string | null;
  fromLocationId?: string | null;
  toLocationId?: string | null;
};

@Injectable()
export class InventoryWorkflowService {
  constructor(private prisma: PrismaService) {}

  async ensureDefaultLocations(factoryId: string) {
    const factoryExists = await this.prisma.factory.count({ where: { id: factoryId } });
    if (!factoryExists) {
      throw new UnauthorizedException("Your factory access is no longer valid. Ask an owner to provision this account again.");
    }
    for (const loc of REQUIRED_LOCATIONS) {
      await this.prisma.inventoryLocation.upsert({
        where: { factoryId_code: { factoryId, code: loc.code } },
        update: { name: loc.name, locationType: loc.locationType, active: true },
        create: { factoryId, ...loc },
      });
    }
    return this.findLocations(factoryId);
  }

  findLocations(factoryId: string) {
    return this.prisma.inventoryLocation.findMany({ where: { factoryId, active: true }, orderBy: { code: "asc" } });
  }

  async locationByCode(factoryId: string, code: string, tx: Prisma.TransactionClient = this.prisma) {
    return tx.inventoryLocation.findFirstOrThrow({ where: { factoryId, code, active: true } });
  }

  async createOpeningSnapshot(factoryId: string, userId: string, input: CreateOpeningSnapshotDto) {
    await this.ensureDefaultLocations(factoryId);
    return this.prisma.$transaction(async (tx) => {
      await tx.factory.update({ where: { id: factoryId }, data: { operatingStatus: "OPENING_COUNT_IN_PROGRESS" } });
      return tx.openingInventorySnapshot.create({
        data: { factoryId, countDate: new Date(input.countDate), createdBy: userId },
        include: { lines: true },
      });
    });
  }

  listOpeningSnapshots(factoryId: string) {
    return this.prisma.openingInventorySnapshot.findMany({
      where: { factoryId },
      include: { lines: true },
      orderBy: { createdAt: "desc" },
    });
  }

  private async requireDraftSnapshot(factoryId: string, snapshotId: string, tx: Prisma.TransactionClient = this.prisma) {
    const snapshot = await tx.openingInventorySnapshot.findFirst({ where: { id: snapshotId, factoryId } });
    if (!snapshot) throw new NotFoundException("Opening snapshot not found");
    if (snapshot.status !== "DRAFT") throw new BadRequestException("Opening snapshot is no longer editable");
    return snapshot;
  }

  async addOpeningRawBlock(factoryId: string, snapshotId: string, input: AddOpeningRawBlockDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.requireDraftSnapshot(factoryId, snapshotId, tx);
      const location = await tx.inventoryLocation.findFirstOrThrow({ where: { id: input.locationId, factoryId } });
      const line = await tx.openingInventoryLine.create({
        data: {
          snapshotId,
          inventoryKind: location.locationType === "B21_WIP" ? "B21_WIP" : "RAW_BLOCK",
          count: 1,
          locationId: input.locationId,
          ownershipType: input.ownershipType,
          verificationStatus: input.verificationStatus,
          notes: input.notes,
        },
      });
      const block = await tx.rawBlock.create({
        data: {
          factoryId,
          serialNumber: input.serialNumber,
          legacySerialNumber: input.legacySerialNumber,
          varietyName: input.varietyName,
          weightTons: input.weightTons,
          ownershipType: input.ownershipType,
          verificationStatus: input.verificationStatus,
          productionStage: location.locationType === "B21_WIP" ? "UNDER_CUTTING" : "RAW",
          inventoryStatus: "DRAFT",
          locationId: input.locationId,
          inventorySourceType: "OPENING_INVENTORY",
          openingInventoryLineId: line.id,
          informationConfidence: "OPENING_LEGACY",
          physicallyVerifiedAt: input.verificationStatus === "PHYSICALLY_VERIFIED" || input.verificationStatus === "APPROVED" ? new Date() : undefined,
          currentStatus: "opening_draft",
          currentLocation: location.code,
        },
      });
      return tx.openingInventoryLine.update({ where: { id: line.id }, data: { rawBlockId: block.id }, include: { rawBlock: true } });
    });
  }

  async addOpeningSlab(factoryId: string, snapshotId: string, input: AddOpeningSlabDto) {
    if (!["UNPOLISHED_SLAB", "POLISHED_SLAB"].includes(input.inventoryKind)) {
      throw new BadRequestException("Opening slab inventoryKind must be UNPOLISHED_SLAB or POLISHED_SLAB");
    }
    if (!input.parentBlockId && input.lineageStatus !== "LEGACY_UNKNOWN") {
      throw new BadRequestException("Unknown opening parentage must use LEGACY_UNKNOWN");
    }
    return this.prisma.$transaction(async (tx) => {
      await this.requireDraftSnapshot(factoryId, snapshotId, tx);
      await tx.inventoryLocation.findFirstOrThrow({ where: { id: input.locationId, factoryId, active: true } });
      if (input.parentBlockId) {
        await tx.rawBlock.findFirstOrThrow({ where: { id: input.parentBlockId, factoryId } });
      }
      const line = await tx.openingInventoryLine.create({
        data: {
          snapshotId,
          inventoryKind: input.inventoryKind,
          count: 1,
          locationId: input.locationId,
          ownershipType: input.ownershipType,
          verificationStatus: input.verificationStatus,
          notes: input.notes,
        },
      });
      const slab = await tx.slab.create({
        data: {
          factoryId,
          parentBlockId: input.parentBlockId,
          slabSerial: input.slabSerial,
          varietyName: input.varietyName,
          lengthFt: input.lengthFt,
          widthFt: input.widthFt,
          productionStage: input.inventoryKind === "POLISHED_SLAB" ? "POLISHED" : "CUT_UNPOLISHED",
          inventoryStatus: "DRAFT",
          locationId: input.locationId,
          inventorySourceType: "OPENING_INVENTORY",
          openingInventoryLineId: line.id,
          lineageStatus: input.lineageStatus,
          salesStatus: "opening_draft",
          currentLocation: input.locationId,
        },
      });
      return tx.openingInventoryLine.update({ where: { id: line.id }, data: { slabId: slab.id }, include: { slab: true } });
    });
  }

  async submitOpeningSnapshot(factoryId: string, userId: string, snapshotId: string) {
    const snapshot = await this.prisma.openingInventorySnapshot.findFirst({ where: { id: snapshotId, factoryId }, include: { lines: true } });
    if (!snapshot) throw new NotFoundException("Opening snapshot not found");
    if (snapshot.status !== "DRAFT") return snapshot;
    return this.prisma.$transaction(async (tx) => {
      await tx.factory.update({ where: { id: factoryId }, data: { operatingStatus: "OPENING_PENDING_APPROVAL" } });
      return tx.openingInventorySnapshot.update({
        where: { id: snapshotId },
        data: { status: "SUBMITTED", submittedBy: userId, submittedAt: new Date() },
        include: { lines: true },
      });
    });
  }

  async approveOpeningSnapshot(factoryId: string, userId: string, snapshotId: string) {
    return this.prisma.$transaction(async (tx) => {
      const snapshot = await tx.openingInventorySnapshot.findFirst({
        where: { id: snapshotId, factoryId },
        include: { lines: { include: { location: true, rawBlock: true, slab: true } } },
      });
      if (!snapshot) throw new NotFoundException("Opening snapshot not found");
      if (snapshot.status === "APPROVED" || snapshot.status === "LOCKED") return snapshot;
      if (snapshot.status !== "SUBMITTED") throw new BadRequestException("Only submitted snapshots can be approved");

      for (const line of snapshot.lines) {
        if (line.verificationStatus !== "PHYSICALLY_VERIFIED" && line.verificationStatus !== "APPROVED") {
          throw new BadRequestException("Every opening line must be physically verified before approval");
        }
        if (line.rawBlock) {
          await tx.rawBlock.update({
            where: { id: line.rawBlock.id },
            data: {
              verificationStatus: "APPROVED",
              inventoryStatus: "AVAILABLE",
              inventorySourceType: "OPENING_INVENTORY",
              approvedBy: userId,
              approvedAt: new Date(),
              currentStatus: line.location.locationType === "B21_WIP" ? "under_cutting" : "in_stock",
              currentLocation: line.location.code,
            },
          });
          await this.createMovement(tx, factoryId, {
            movementType: "OPENING_RECEIPT",
            rawBlockId: line.rawBlock.id,
            toLocationId: line.locationId,
            referenceType: "OPENING_INVENTORY",
            referenceId: snapshot.id,
            openingInventoryLineId: line.id,
            createdBy: userId,
            idempotencyKey: `opening:${snapshot.id}:block:${line.rawBlock.id}`,
          });
        }
        if (line.slab) {
          await tx.slab.update({
            where: { id: line.slab.id },
            data: {
              inventoryStatus: "AVAILABLE",
              inventorySourceType: "OPENING_INVENTORY",
              salesStatus: line.slab.productionStage === "POLISHED" ? "polished" : "in_stock",
              currentLocation: line.location.code,
            },
          });
          await this.createMovement(tx, factoryId, {
            movementType: "OPENING_RECEIPT",
            slabId: line.slab.id,
            toLocationId: line.locationId,
            referenceType: "OPENING_INVENTORY",
            referenceId: snapshot.id,
            openingInventoryLineId: line.id,
            createdBy: userId,
            idempotencyKey: `opening:${snapshot.id}:slab:${line.slab.id}`,
          });
        }
      }

      await tx.factory.update({
        where: { id: factoryId },
        data: { openingSnapshotApprovedAt: new Date(), openingSnapshotApprovedBy: userId, operatingStatus: "LIVE", goLiveDate: new Date() },
      });
      return tx.openingInventorySnapshot.update({
        where: { id: snapshotId },
        data: { status: "APPROVED", approvedBy: userId, approvedAt: new Date() },
        include: { lines: true },
      });
    });
  }

  async rejectOpeningSnapshot(factoryId: string, userId: string, snapshotId: string, reason: string) {
    const snapshot = await this.prisma.openingInventorySnapshot.findFirst({ where: { id: snapshotId, factoryId } });
    if (!snapshot) throw new NotFoundException("Opening snapshot not found");
    if (snapshot.status !== "SUBMITTED") throw new BadRequestException("Only submitted snapshots can be rejected");
    return this.prisma.openingInventorySnapshot.update({
      where: { id: snapshotId },
      data: { status: "REJECTED", rejectedBy: userId, rejectedAt: new Date(), rejectionReason: reason },
    });
  }

  async goLive(factoryId: string, userId: string) {
    const approved = await this.prisma.openingInventorySnapshot.findFirst({ where: { factoryId, status: "APPROVED" } });
    if (!approved) throw new BadRequestException("Approve opening inventory before go-live");
    return this.prisma.factory.update({ where: { id: factoryId }, data: { operatingStatus: "LIVE", goLiveDate: new Date(), openingSnapshotApprovedBy: userId } });
  }

  async createGoodsReceipt(factoryId: string, userId: string, input: CreateGoodsReceiptDto) {
    await this.ensureDefaultLocations(factoryId);
    if (input.supplierId) await this.prisma.supplier.findFirstOrThrow({ where: { id: input.supplierId, factoryId } });
    const locationIds = [...new Set(input.lines.map((line) => line.locationId))];
    const locations = await this.prisma.inventoryLocation.findMany({
      where: { id: { in: locationIds }, factoryId, active: true },
      select: { id: true },
    });
    if (locations.length !== locationIds.length) {
      throw new BadRequestException("One or more receipt locations belong to another factory");
    }
    return this.prisma.goodsReceipt.create({
      data: {
        factoryId,
        supplierId: input.supplierId,
        receiptDate: new Date(input.receiptDate),
        createdBy: userId,
        lines: {
          create: input.lines.map((line) => ({
            serialNumber: line.serialNumber,
            legacySerialNumber: line.legacySerialNumber,
            varietyName: line.varietyName,
            weightTons: line.weightTons,
            locationId: line.locationId,
            ownershipType: line.ownershipType,
          })),
        },
      },
      include: { lines: true },
    });
  }

  async submitGoodsReceipt(factoryId: string, userId: string, receiptId: string) {
    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.goodsReceipt.findFirst({ where: { id: receiptId, factoryId }, include: { lines: { include: { location: true } } } });
      if (!receipt) throw new NotFoundException("Goods receipt not found");
      if (receipt.status === "SUBMITTED") return receipt;
      for (const line of receipt.lines) {
        if (line.location.factoryId !== factoryId) throw new BadRequestException("Receipt location belongs to another factory");
        const block = await tx.rawBlock.create({
          data: {
            factoryId,
            serialNumber: line.serialNumber,
            legacySerialNumber: line.legacySerialNumber,
            varietyName: line.varietyName,
            supplierId: receipt.supplierId,
            weightTons: line.weightTons,
            ownershipType: line.ownershipType,
            verificationStatus: "PHYSICALLY_VERIFIED",
            productionStage: "RAW",
            inventoryStatus: "AVAILABLE",
            locationId: line.locationId,
            inventorySourceType: "GOODS_RECEIPT",
            goodsReceiptLineId: line.id,
            physicallyVerifiedBy: userId,
            physicallyVerifiedAt: new Date(),
            currentStatus: "in_stock",
            currentLocation: line.location.code,
          },
        });
        await tx.goodsReceiptLine.update({ where: { id: line.id }, data: { rawBlockId: block.id } });
        await this.createMovement(tx, factoryId, {
          movementType: "GOODS_RECEIPT",
          rawBlockId: block.id,
          toLocationId: line.locationId,
          referenceType: "GOODS_RECEIPT",
          referenceId: receipt.id,
          goodsReceiptLineId: line.id,
          createdBy: userId,
          idempotencyKey: `goods-receipt:${receipt.id}:line:${line.id}`,
        });
      }
      return tx.goodsReceipt.update({ where: { id: receipt.id }, data: { status: GoodsReceiptStatus.SUBMITTED, submittedBy: userId, submittedAt: new Date() }, include: { lines: true } });
    });
  }

  listMovements(factoryId: string) {
    return this.prisma.inventoryMovement.findMany({
      where: { factoryId },
      include: { rawBlock: true, slab: true, fromLocation: true, toLocation: true },
      orderBy: { occurredAt: "desc" },
    });
  }

  onHand(factoryId: string) {
    return Promise.all([
      this.prisma.rawBlock.findMany({ where: { factoryId, inventoryStatus: { in: ["AVAILABLE", "RESERVED", "HOLD"] } }, include: { location: true } }),
      this.prisma.slab.findMany({ where: { factoryId, inventoryStatus: { in: ["AVAILABLE", "RESERVED", "HOLD"] } }, include: { location: true, parentBlock: true } }),
    ]).then(([rawBlocks, slabs]) => ({ rawBlocks, slabs }));
  }

  async adjust(factoryId: string, userId: string, input: InventoryAdjustmentDto) {
    if (input.movementType !== "ADJUSTMENT") throw new BadRequestException("Use ADJUSTMENT for stock adjustments");
    if (Number(input.quantity) !== 1) throw new BadRequestException("Item-level inventory adjustments require quantity 1");
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.inventoryMovement.findUnique({ where: { factoryId_idempotencyKey: { factoryId, idempotencyKey: input.idempotencyKey } } });
      if (existing) return existing;

      await this.validateManualMovementSnapshot(tx, factoryId, input);
      const movement = await this.createMovement(tx, factoryId, {
        ...input,
        referenceType: "ADJUSTMENT",
        referenceId: input.rawBlockId ?? input.slabId ?? "factory",
        createdBy: userId,
        reason: input.reason,
      });
      await this.applyManualMovementSnapshot(tx, factoryId, input);
      return movement;
    });
  }

  async reverseMovement(factoryId: string, userId: string, movementId: string, input: ReverseMovementDto) {
    return this.prisma.$transaction(async (tx) => {
      const existingIdempotencyKey = await tx.inventoryMovement.findUnique({
        where: { factoryId_idempotencyKey: { factoryId, idempotencyKey: input.idempotencyKey } },
      });
      if (existingIdempotencyKey) throw new BadRequestException("Duplicate reversal idempotency key");

      const movement = await tx.inventoryMovement.findFirst({ where: { id: movementId, factoryId } });
      if (!movement) throw new NotFoundException("Movement not found");
      if (movement.movementType === "REVERSAL") throw new BadRequestException("Cannot reverse a reversal");
      const existingReversal = await tx.inventoryMovement.findFirst({ where: { factoryId, reversesMovementId: movement.id } });
      if (existingReversal) throw new BadRequestException("Movement has already been reversed");

      const reversesEpoxyApplication = movement.referenceType === "EPOXY_APPLICATION";
      if (reversesEpoxyApplication) {
        if (!movement.slabId) throw new BadRequestException("Epoxy application movement is missing its slab reference");
        const slab = await tx.slab.findFirst({
          where: { id: movement.slabId, factoryId },
          include: { reservations: { where: { status: "ACTIVE" } } },
        });
        if (!slab) throw new NotFoundException("Slab not found");
        if (
          slab.productionStage !== "EPOXY_APPLIED"
          || slab.inventoryStatus !== "AVAILABLE"
          || slab.locationId !== movement.toLocationId
          || slab.reservations.length > 0
        ) {
          throw new BadRequestException("Epoxy can only be reversed while the slab is available in the epoxy-applied LPM queue");
        }
      }

      const reversalInput = {
        movementType: "REVERSAL" as InventoryMovementType,
        rawBlockId: movement.rawBlockId ?? undefined,
        slabId: movement.slabId ?? undefined,
        fromLocationId: movement.toLocationId ?? undefined,
        toLocationId: movement.fromLocationId ?? undefined,
        quantity: movement.quantity,
        areaSqft: movement.areaSqft ?? undefined,
        referenceType: "REVERSAL",
        referenceId: movement.id,
        reversesMovementId: movement.id,
        createdBy: userId,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
      };
      await this.validateManualMovementSnapshot(tx, factoryId, reversalInput);
      const reversal = await this.createMovement(tx, factoryId, reversalInput);
      await this.applyManualMovementSnapshot(tx, factoryId, reversalInput);
      if (reversesEpoxyApplication) {
        await tx.slab.update({
          where: { id: movement.slabId! },
          data: { productionStage: "GRINDED", salesStatus: "grinded" },
        });
        await tx.slabStateTransition.create({
          data: {
            slabId: movement.slabId!,
            fromState: "epoxy_applied",
            toState: "grinded",
            userId,
            notes: input.reason,
          },
        });
      }
      return reversal;
    });
  }

  private async validateManualMovementSnapshot(tx: Prisma.TransactionClient, factoryId: string, data: ManualMovementSnapshotInput) {
    if (Boolean(data.rawBlockId) === Boolean(data.slabId)) {
      throw new BadRequestException("Inventory adjustment must reference exactly one raw block or slab");
    }
    if (!data.fromLocationId && !data.toLocationId) {
      throw new BadRequestException("Inventory adjustment must include a source or destination location");
    }

    const item = await this.findManualMovementItem(tx, factoryId, data);
    if (data.fromLocationId) {
      if (item.locationId !== data.fromLocationId) {
        throw new BadRequestException("Cannot move stock out of a location where the item is not currently present");
      }
      if (!["AVAILABLE", "RESERVED", "HOLD", "DELIVERED"].includes(item.inventoryStatus)) {
        throw new BadRequestException(`Cannot adjust stock with inventory status ${item.inventoryStatus}`);
      }
    }
  }

  private async applyManualMovementSnapshot(tx: Prisma.TransactionClient, factoryId: string, data: ManualMovementSnapshotInput) {
    const toLocation = data.toLocationId
      ? await tx.inventoryLocation.findFirstOrThrow({ where: { id: data.toLocationId, factoryId }, select: { id: true, code: true } })
      : null;
    const snapshot = toLocation
      ? { inventoryStatus: "AVAILABLE" as InventoryStatus, locationId: toLocation.id, currentLocation: toLocation.code }
      : { inventoryStatus: "SCRAPPED" as InventoryStatus, locationId: null, currentLocation: null };

    if (data.rawBlockId) {
      await tx.rawBlock.update({
        where: { id: data.rawBlockId },
        data: {
          inventoryStatus: snapshot.inventoryStatus,
          locationId: snapshot.locationId,
          currentLocation: snapshot.currentLocation,
          currentStatus: snapshot.inventoryStatus === "SCRAPPED" ? "scrapped" : "in_stock",
          productionStage: snapshot.inventoryStatus === "SCRAPPED" ? "REJECTED" : "RAW",
        },
      });
      return;
    }

    await tx.slab.update({
      where: { id: data.slabId! },
      data: {
        inventoryStatus: snapshot.inventoryStatus,
        locationId: snapshot.locationId,
        currentLocation: snapshot.currentLocation,
        salesStatus: snapshot.inventoryStatus === "SCRAPPED" ? "scrapped" : "in_stock",
      },
    });
  }

  private async findManualMovementItem(tx: Prisma.TransactionClient, factoryId: string, data: ManualMovementSnapshotInput): Promise<InventoryItemSnapshot> {
    if (data.rawBlockId) {
      const block = await tx.rawBlock.findFirst({
        where: { id: data.rawBlockId, factoryId },
        select: { id: true, locationId: true, inventoryStatus: true },
      });
      if (!block) throw new NotFoundException("Raw block not found");
      return block;
    }

    const slab = await tx.slab.findFirst({
      where: { id: data.slabId!, factoryId },
      select: { id: true, locationId: true, inventoryStatus: true },
    });
    if (!slab) throw new NotFoundException("Slab not found");
    return slab;
  }

  async createMovement(tx: Prisma.TransactionClient, factoryId: string, data: {
    movementType: InventoryMovementType;
    rawBlockId?: string | null;
    slabId?: string | null;
    fromLocationId?: string | null;
    toLocationId?: string | null;
    quantity?: number | Prisma.Decimal;
    areaSqft?: number | Prisma.Decimal;
    referenceType: string;
    referenceId: string;
    reversesMovementId?: string | null;
    createdBy: string;
    reason?: string | null;
    idempotencyKey: string;
    cuttingSessionId?: string | null;
    polishingSessionId?: string | null;
    openingInventoryLineId?: string | null;
    goodsReceiptLineId?: string | null;
    deliveryLineId?: string | null;
  }) {
    const quantity = data.quantity ?? 1;
    if (Number(quantity) <= 0) throw new BadRequestException("Inventory movement quantity must be positive");
    const existing = await tx.inventoryMovement.findUnique({ where: { factoryId_idempotencyKey: { factoryId, idempotencyKey: data.idempotencyKey } } });
    if (existing) return existing;
    if (data.fromLocationId) await tx.inventoryLocation.findFirstOrThrow({ where: { id: data.fromLocationId, factoryId } });
    if (data.toLocationId) await tx.inventoryLocation.findFirstOrThrow({ where: { id: data.toLocationId, factoryId } });
    return tx.inventoryMovement.create({
      data: {
        factoryId,
        movementType: data.movementType,
        rawBlockId: data.rawBlockId ?? undefined,
        slabId: data.slabId ?? undefined,
        fromLocationId: data.fromLocationId ?? undefined,
        toLocationId: data.toLocationId ?? undefined,
        quantity,
        areaSqft: data.areaSqft,
        referenceType: data.referenceType,
        referenceId: data.referenceId,
        reversesMovementId: data.reversesMovementId ?? undefined,
        createdBy: data.createdBy,
        reason: data.reason ?? undefined,
        idempotencyKey: data.idempotencyKey,
        cuttingSessionId: data.cuttingSessionId ?? undefined,
        polishingSessionId: data.polishingSessionId ?? undefined,
        openingInventoryLineId: data.openingInventoryLineId ?? undefined,
        goodsReceiptLineId: data.goodsReceiptLineId ?? undefined,
        deliveryLineId: data.deliveryLineId ?? undefined,
      },
    });
  }
}
