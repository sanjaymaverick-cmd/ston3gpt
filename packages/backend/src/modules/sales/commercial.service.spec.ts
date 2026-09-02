import { BadRequestException } from "@nestjs/common";
import { CommercialService } from "./commercial.service";

describe("CommercialService", () => {
  const invoiceInput = {
    salesOrderId: "order-1", invoiceNumber: "INV-1", invoiceDate: "2026-09-02", invoicedAmount: 1000,
  };

  it("returns the existing invoice for an identical retry without creating another receivable", async () => {
    const existingInvoice = {
      id: "invoice-1", factoryId: "factory-1", customerId: "customer-1", invoiceNumber: "INV-1",
      invoiceDate: new Date("2026-09-02"), invoicedAmount: { toString: () => "1000" }, gstAmount: { toString: () => "0" },
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: "order-1" }]),
      salesOrder: { findFirst: jest.fn().mockResolvedValue({ id: "order-1", customerId: "customer-1", status: "CONFIRMED", invoice: existingInvoice }) },
      invoice: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((operation) => operation(tx)) };
    const service = new CommercialService(prisma as never);

    await expect(service.createInvoice("factory-1", invoiceInput)).resolves.toBe(existingInvoice);
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });

  it("rejects a conflicting second invoice for an already invoiced order", async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: "order-1" }]),
      salesOrder: { findFirst: jest.fn().mockResolvedValue({
        id: "order-1", customerId: "customer-1", status: "CONFIRMED",
        invoice: { id: "invoice-1", invoiceNumber: "INV-OLD", invoiceDate: new Date("2026-09-01"), invoicedAmount: 900, gstAmount: 0 },
      }) },
      invoice: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((operation) => operation(tx)) };
    const service = new CommercialService(prisma as never);

    await expect(service.createInvoice("factory-1", invoiceInput)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });

  it("returns an existing payment for an identical idempotency-key retry", async () => {
    const existing = {
      id: "payment-1", invoiceId: "invoice-1", amount: 400,
      paymentDate: new Date("2026-09-02"), paymentMode: "bank",
    };
    const tx = {
      payment: { findUnique: jest.fn().mockResolvedValue(existing), aggregate: jest.fn(), create: jest.fn() },
      invoice: { findFirst: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((operation) => operation(tx)) };
    const service = new CommercialService(prisma as never);

    await expect(service.createPayment("factory-1", {
      invoiceId: "invoice-1", paymentDate: "2026-09-02", amount: 400, paymentMode: "bank", idempotencyKey: "bank-ref-1",
    } as never)).resolves.toBe(existing);
    expect(tx.invoice.findFirst).not.toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it("rejects a payment that exceeds the invoice remaining balance", async () => {
    const tx = {
      payment: { findUnique: jest.fn().mockResolvedValue(null), aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 800 } }), create: jest.fn() },
      $queryRaw: jest.fn().mockResolvedValue([{ id: "invoice-1" }]),
      invoice: { findFirst: jest.fn().mockResolvedValue({ id: "invoice-1", invoicedAmount: 1000 }) },
    };
    const prisma = { $transaction: jest.fn((operation) => operation(tx)) };
    const service = new CommercialService(prisma as never);

    await expect(service.createPayment("factory-1", {
      invoiceId: "invoice-1", paymentDate: "2026-09-02", amount: 300, paymentMode: "bank", idempotencyKey: "bank-ref-2",
    } as never)).rejects.toThrow("Payment exceeds the invoice remaining balance");
    expect(tx.payment.create).not.toHaveBeenCalled();
  });
});
