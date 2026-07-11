import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { CreateInvoiceDto, CreatePaymentDto } from "../../common/workflow.dto";

@Injectable()
export class CommercialService {
  constructor(private prisma: PrismaService) {}

  async createInvoice(factoryId: string, input: CreateInvoiceDto) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findFirst({ where: { id: input.salesOrderId, factoryId } });
      if (!order) throw new NotFoundException("Sales order not found");
      if (order.status === "CANCELLED") throw new BadRequestException("Cannot invoice a cancelled order");
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
    });
  }

  async createPayment(factoryId: string, input: CreatePaymentDto) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id: input.invoiceId, factoryId } });
    if (!invoice) throw new NotFoundException("Invoice not found");
    return this.prisma.payment.create({
      data: {
        factoryId,
        invoiceId: input.invoiceId,
        amount: input.amount,
        paymentDate: new Date(input.paymentDate),
        paymentMode: input.paymentMode,
      },
    });
  }
}
