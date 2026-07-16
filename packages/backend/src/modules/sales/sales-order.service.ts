import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { InventoryWorkflowService } from "../inventory/inventory-workflow.service";
import { CreateSalesOrderDto, CustomerReturnDto, DeliveryDto } from "../../common/workflow.dto";

@Injectable()
export class SalesOrderService {
  constructor(
    private prisma: PrismaService,
    private inventory: InventoryWorkflowService,
  ) {}

  findAll(factoryId: string) {
    return this.prisma.salesOrder.findMany({
      where: { factoryId },
      include: { lineItems: { include: { slab: true } }, customer: true, invoice: { include: { payments: true } }, reservations: true, deliveries: { include: { lines: true } } },
      orderBy: { orderDate: "desc" },
    });
  }

  findOne(factoryId: string, id: string) {
    return this.prisma.salesOrder.findFirst({
      where: { id, factoryId },
      include: { lineItems: { include: { slab: true } }, customer: true, invoice: true, reservations: true, deliveries: { include: { lines: true } } },
    });
  }

  async recoveryReport(factoryId: string) {
    const blocks = await this.prisma.rawBlock.findMany({
      where: { factoryId },
      select: {
        id: true,
        serialNumber: true,
        weightTons: true,
        cuttingSessions: { select: { damagedSlabCount: true, damagedCostAmount: true } },
        slabs: { select: { salesLines: { select: { quantity: true } } } },
      },
      orderBy: { serialNumber: "asc" },
    });
    return blocks.map((block) => {
      const soldSqft = block.slabs.reduce((total, slab) => total + slab.salesLines.reduce((sum, line) => sum + Number(line.quantity), 0), 0);
      const weightTons = Number(block.weightTons ?? 0);
      const sqftPerTon = weightTons > 0 ? soldSqft / weightTons : null;
      return {
        rawBlockId: block.id,
        serialNumber: block.serialNumber,
        weightTons: weightTons || null,
        soldSqft,
        sqftPerTon,
        benchmarkSqftPerTon: 105,
        varianceFromBenchmark: sqftPerTon === null ? null : sqftPerTon - 105,
        damagedSlabCount: block.cuttingSessions.reduce((sum, session) => sum + (session.damagedSlabCount ?? 0), 0),
        damagedCostAmount: block.cuttingSessions.reduce((sum, session) => sum + Number(session.damagedCostAmount ?? 0), 0),
      };
    });
  }

  async create(factoryId: string, userId: string, input: CreateSalesOrderDto) {
    if (new Set(input.lineItems.map((line) => line.slabId)).size !== input.lineItems.length) {
      throw new BadRequestException("Duplicate slab IDs are not allowed");
    }
    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({ where: { id: input.customerId, factoryId } });
      if (!customer) throw new NotFoundException("Customer not found");
      const slabIds = input.lineItems.map((line) => line.slabId);
      const slabs = await tx.slab.findMany({ where: { id: { in: slabIds }, factoryId }, include: { location: true, reservations: { where: { status: "ACTIVE" } } } });
      if (slabs.length !== slabIds.length) throw new BadRequestException("One or more slabs not found in this factory");
      for (const slab of slabs) {
        if (slab.productionStage !== "POLISHED") throw new BadRequestException(`Slab ${slab.slabSerial} is not polished`);
        if (slab.inventoryStatus !== "AVAILABLE") throw new BadRequestException(`Slab ${slab.slabSerial} is not available`);
        if (!slab.location || slab.location.locationType !== "FINISHED_STOCK") throw new BadRequestException(`Slab ${slab.slabSerial} is not in finished stock`);
        if (slab.reservations.length) throw new BadRequestException(`Slab ${slab.slabSerial} already has an active reservation`);
      }

      const order = await tx.salesOrder.create({
        data: { factoryId, customerId: input.customerId, orderDate: new Date(input.orderDate), status: "CONFIRMED" },
      });
      for (const item of input.lineItems) {
        const slab = slabs.find((s) => s.id === item.slabId)!;
        const line = await tx.salesLineItem.create({
          data: {
            salesOrderId: order.id,
            slabId: slab.id,
            varietyName: slab.varietyName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            paymentType: "invoiced",
          },
        });
        const reservation = await tx.inventoryReservation.create({
          data: {
            factoryId,
            slabId: slab.id,
            purpose: "SALES",
            referenceType: "SALES_ORDER",
            referenceId: order.id,
            createdBy: userId,
          },
        });
        await tx.salesReservation.create({
          data: { factoryId, salesOrderId: order.id, salesLineItemId: line.id, slabId: slab.id, reservationId: reservation.id },
        });
        await tx.slab.update({ where: { id: slab.id }, data: { inventoryStatus: "RESERVED", salesStatus: "reserved" } });
        await this.inventory.createMovement(tx, factoryId, {
          movementType: "SALES_RESERVATION",
          slabId: slab.id,
          fromLocationId: slab.locationId,
          toLocationId: slab.locationId,
          referenceType: "SALES_ORDER",
          referenceId: order.id,
          createdBy: userId,
          idempotencyKey: `sales-order:${order.id}:reserve:${slab.id}`,
        });
      }

      return tx.salesOrder.findUniqueOrThrow({ where: { id: order.id }, include: { lineItems: true, reservations: true } });
    }, { isolationLevel: "Serializable" });
  }

  async cancel(factoryId: string, userId: string, orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findFirst({ where: { id: orderId, factoryId }, include: { reservations: { include: { reservation: true } }, deliveries: true } });
      if (!order) throw new NotFoundException("Sales order not found");
      if (order.deliveries.length > 0) throw new BadRequestException("Delivered orders require a return workflow");
      for (const salesReservation of order.reservations) {
        if (salesReservation.status !== "ACTIVE") continue;
        await tx.salesReservation.update({ where: { id: salesReservation.id }, data: { status: "RELEASED" } });
        await tx.inventoryReservation.update({ where: { id: salesReservation.reservationId }, data: { status: "RELEASED", releasedBy: userId, releasedAt: new Date() } });
        await tx.slab.update({ where: { id: salesReservation.slabId }, data: { inventoryStatus: "AVAILABLE", salesStatus: "polished" } });
      }
      return tx.salesOrder.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
    });
  }

  async deliver(factoryId: string, userId: string, orderId: string, input: DeliveryDto) {
    if (new Set(input.slabIds).size !== input.slabIds.length) throw new BadRequestException("Duplicate slab IDs are not allowed");
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findFirst({
        where: { id: orderId, factoryId },
        include: { reservations: { include: { reservation: true } }, lineItems: true },
      });
      if (!order) throw new NotFoundException("Sales order not found");
      if (order.status === "CANCELLED") throw new BadRequestException("Cannot deliver a cancelled order");
      const delivered = await this.inventory.locationByCode(factoryId, "DELIVERED", tx);
      const delivery = await tx.delivery.create({
        data: { factoryId, salesOrderId: order.id, deliveryDate: new Date(input.deliveryDate), vehicleNumber: input.vehicleNumber, createdBy: userId },
      });
      for (const slabId of input.slabIds) {
        const salesReservation = order.reservations.find((reservation) => reservation.slabId === slabId && reservation.status === "ACTIVE");
        if (!salesReservation) throw new BadRequestException(`No active sales reservation for slab ${slabId}`);
        const slab = await tx.slab.findFirstOrThrow({ where: { id: slabId, factoryId } });
        const line = await tx.deliveryLine.create({ data: { deliveryId: delivery.id, slabId, salesReservationId: salesReservation.id } });
        await tx.slab.update({ where: { id: slabId }, data: { inventoryStatus: "DELIVERED", locationId: delivered.id, salesStatus: "sold", currentLocation: delivered.code } });
        await tx.salesReservation.update({ where: { id: salesReservation.id }, data: { status: "CONSUMED" } });
        await tx.inventoryReservation.update({ where: { id: salesReservation.reservationId }, data: { status: "CONSUMED", consumedBy: userId, consumedAt: new Date() } });
        await this.inventory.createMovement(tx, factoryId, {
          movementType: "DELIVERY",
          slabId,
          fromLocationId: slab.locationId,
          toLocationId: delivered.id,
          referenceType: "DELIVERY",
          referenceId: delivery.id,
          deliveryLineId: line.id,
          createdBy: userId,
          idempotencyKey: `${input.idempotencyKey}:delivery:${slabId}`,
        });
      }
      const remaining = await tx.salesReservation.count({ where: { salesOrderId: order.id, status: "ACTIVE" } });
      await tx.salesOrder.update({ where: { id: order.id }, data: { status: remaining === 0 ? "DELIVERED" : "PARTIALLY_DELIVERED" } });
      return tx.delivery.findUniqueOrThrow({ where: { id: delivery.id }, include: { lines: { include: { slab: true } } } });
    }, { isolationLevel: "Serializable" });
  }

  async returnDelivered(factoryId: string, userId: string, input: CustomerReturnDto) {
    if (new Set(input.slabIds).size !== input.slabIds.length) throw new BadRequestException("Duplicate slab IDs are not allowed");
    return this.prisma.$transaction(async (tx) => {
      const existingMovement = await tx.inventoryMovement.findUnique({
        where: { factoryId_idempotencyKey: { factoryId, idempotencyKey: `${input.idempotencyKey}:return:${input.slabIds[0]}` } },
      });
      if (existingMovement) return tx.customerReturn.findUniqueOrThrow({ where: { id: existingMovement.referenceId }, include: { lines: { include: { slab: true } } } });

      const delivery = await tx.delivery.findFirst({ where: { id: input.deliveryId, factoryId }, include: { lines: true } });
      if (!delivery) throw new NotFoundException("Delivery not found");
      const deliveredSlabIds = new Set(delivery.lines.map((line) => line.slabId));
      if (input.slabIds.some((id) => !deliveredSlabIds.has(id))) throw new BadRequestException("Every returned slab must belong to the selected delivery");
      const alreadyReturned = await tx.customerReturnLine.findFirst({ where: { slabId: { in: input.slabIds } } });
      if (alreadyReturned) throw new BadRequestException("One or more slabs were already returned");

      const finishedStock = await this.inventory.locationByCode(factoryId, "FINISHED_STOCK", tx);
      const customerReturn = await tx.customerReturn.create({
        data: { factoryId, deliveryId: delivery.id, returnDate: new Date(input.returnDate), reason: input.reason, createdBy: userId },
      });
      for (const slabId of input.slabIds) {
        const slab = await tx.slab.findFirst({ where: { id: slabId, factoryId } });
        if (!slab || slab.inventoryStatus !== "DELIVERED") throw new BadRequestException(`Slab ${slabId} is not currently delivered`);
        await tx.customerReturnLine.create({ data: { customerReturnId: customerReturn.id, slabId } });
        await tx.slab.update({ where: { id: slabId }, data: { inventoryStatus: "AVAILABLE", locationId: finishedStock.id, inventorySourceType: "CUSTOMER_RETURN", salesStatus: "polished", currentLocation: finishedStock.code } });
        await this.inventory.createMovement(tx, factoryId, {
          movementType: "RETURN",
          slabId,
          fromLocationId: slab.locationId,
          toLocationId: finishedStock.id,
          referenceType: "CUSTOMER_RETURN",
          referenceId: customerReturn.id,
          createdBy: userId,
          reason: input.reason,
          idempotencyKey: `${input.idempotencyKey}:return:${slabId}`,
        });
      }
      return tx.customerReturn.findUniqueOrThrow({ where: { id: customerReturn.id }, include: { lines: { include: { slab: true } } } });
    }, { isolationLevel: "Serializable" });
  }
}
