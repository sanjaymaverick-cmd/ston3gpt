import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { CreateInvoiceDto, CreatePaymentDto } from "../../common/workflow.dto";
import { Prisma } from "@prisma/client";

@Injectable()
export class CommercialService {
  constructor(private prisma: PrismaService) {}

  async createInvoice(factoryId: string, input: CreateInvoiceDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "sales_order" WHERE id = ${input.salesOrderId} AND factory_id = ${factoryId} FOR UPDATE`);
      const order = await tx.salesOrder.findFirst({ where: { id: input.salesOrderId, factoryId }, include: { invoice: true } });
      if (!order) throw new NotFoundException("Sales order not found");
      if (order.status === "CANCELLED") throw new BadRequestException("Cannot invoice a cancelled order");
      if (order.invoice) {
        const sameRequest = order.invoice.invoiceNumber === input.invoiceNumber
          && order.invoice.invoiceDate.toISOString().slice(0, 10) === input.invoiceDate.slice(0, 10)
          && Number(order.invoice.invoicedAmount) === input.invoicedAmount
          && Number(order.invoice.gstAmount) === (input.gstAmount ?? 0);
        if (!sameRequest) throw new BadRequestException("Sales order has already been invoiced");
        return order.invoice;
      }
      const invoice = await tx.invoice.create({
        data: {
          factoryId,
          customerId: order.customerId,
          invoiceNumber: input.invoiceNumber,
          invoiceDate: new Date(input.invoiceDate),
          invoicedAmount: input.invoicedAmount,
          gstAmount: input.gstAmount ?? 0,
        },
      });
      await tx.salesOrder.update({ where: { id: order.id }, data: { invoiceId: invoice.id } });
      return invoice;
    }, { isolationLevel: "Serializable" });
  }

  async createPayment(factoryId: string, input: CreatePaymentDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.payment.findUnique({
        where: { factoryId_idempotencyKey: { factoryId, idempotencyKey: input.idempotencyKey } },
      });
      if (existing) {
        const sameRequest = existing.invoiceId === input.invoiceId
          && Number(existing.amount) === input.amount
          && existing.paymentDate.toISOString().slice(0, 10) === input.paymentDate.slice(0, 10)
          && existing.paymentMode === (input.paymentMode ?? null);
        if (!sameRequest) throw new BadRequestException("Idempotency key was already used for a different payment request");
        return existing;
      }

      await tx.$queryRaw(Prisma.sql`SELECT id FROM "invoice" WHERE id = ${input.invoiceId} AND factory_id = ${factoryId} FOR UPDATE`);
      const invoice = await tx.invoice.findFirst({ where: { id: input.invoiceId, factoryId } });
      if (!invoice) throw new NotFoundException("Invoice not found");
      const paid = await tx.payment.aggregate({ where: { invoiceId: invoice.id, factoryId }, _sum: { amount: true } });
      const remaining = Number(invoice.invoicedAmount) - Number(paid._sum.amount ?? 0);
      if (input.amount > remaining) throw new BadRequestException("Payment exceeds the invoice remaining balance");
      return tx.payment.create({
        data: {
          factoryId, invoiceId: input.invoiceId, amount: input.amount, paymentDate: new Date(input.paymentDate),
          paymentMode: input.paymentMode, idempotencyKey: input.idempotencyKey,
        },
      });
    }, { isolationLevel: "Serializable" });
  }
}
