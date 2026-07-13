import { BadRequestException, ValidationPipe } from "@nestjs/common";
import {
  CreateExpenseDto,
  CreateGoodsReceiptDto,
  CreateSalesOrderDto,
  InventoryAdjustmentDto,
  ProvisionUserDto,
  StartCuttingDto,
} from "./workflow.dto";

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const uuidA = "11111111-1111-4111-8111-111111111111";
const uuidB = "22222222-2222-4222-8222-222222222222";

function validate(metatype: new () => object, value: unknown) {
  return pipe.transform(value, { type: "body", metatype });
}

describe("global DTO validation contract", () => {
  it("transforms valid nested sales input", async () => {
    await expect(validate(CreateSalesOrderDto, {
      customerId: uuidA,
      orderDate: "2026-07-13",
      lineItems: [{ slabId: uuidB, quantity: 10, unitPrice: 100 }],
    })).resolves.toBeInstanceOf(CreateSalesOrderDto);
  });

  it("rejects unknown root fields", async () => {
    await expect(validate(ProvisionUserDto, {
      email: "operator@example.com",
      role: "operator",
      factoryId: "attacker-selected-factory",
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects unknown nested fields", async () => {
    await expect(validate(CreateGoodsReceiptDto, {
      receiptDate: "2026-07-13",
      lines: [{ serialNumber: "B-1", varietyName: "TEST", locationId: uuidA, ownershipType: "COMPANY_OWNED", factoryId: "foreign" }],
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    [ProvisionUserDto, { email: "not-an-email", role: "operator" }],
    [CreateExpenseDto, { category: "maintenance", amount: 0, expenseDate: "2026-07-13" }],
    [InventoryAdjustmentDto, { movementType: "ADJUSTMENT", rawBlockId: uuidA, quantity: 0, reason: "test", idempotencyKey: "adjust" }],
    [CreateGoodsReceiptDto, { receiptDate: "2026-07-13", lines: [] }],
    [StartCuttingDto, { rawBlockId: "not-a-uuid", machineId: uuidA, idempotencyKey: "cut" }],
  ])("rejects invalid %p payloads", async (metatype, value) => {
    await expect(validate(metatype as new () => object, value)).rejects.toBeInstanceOf(BadRequestException);
  });
});
