import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";
import {
  InventoryKind,
  OwnershipType,
  VerificationStatus,
  InventoryMovementType,
  MachineType,
  PaymentType,
  SlabLineageStatus,
} from "@prisma/client";

export class IdParamDto {
  @IsUUID()
  id!: string;
}

export class CreateLocationDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class CreateOpeningSnapshotDto {
  @IsDateString()
  countDate!: string;
}

export class AddOpeningRawBlockDto {
  @IsString()
  @IsNotEmpty()
  serialNumber!: string;

  @IsOptional()
  @IsString()
  legacySerialNumber?: string;

  @IsString()
  @IsNotEmpty()
  varietyName!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightTons?: number;

  @IsUUID()
  locationId!: string;

  @IsEnum(OwnershipType)
  ownershipType!: OwnershipType;

  @IsEnum(VerificationStatus)
  verificationStatus!: VerificationStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AddOpeningSlabDto {
  @IsString()
  @IsNotEmpty()
  slabSerial!: string;

  @IsString()
  @IsNotEmpty()
  varietyName!: string;

  @IsEnum(InventoryKind)
  inventoryKind!: InventoryKind;

  @IsOptional()
  @IsUUID()
  parentBlockId?: string;

  @IsEnum(SlabLineageStatus)
  lineageStatus!: SlabLineageStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lengthFt?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  widthFt?: number;

  @IsUUID()
  locationId!: string;

  @IsEnum(OwnershipType)
  ownershipType!: OwnershipType;

  @IsEnum(VerificationStatus)
  verificationStatus!: VerificationStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectSnapshotDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class GoodsReceiptLineDto {
  @IsString()
  @IsNotEmpty()
  serialNumber!: string;

  @IsOptional()
  @IsString()
  legacySerialNumber?: string;

  @IsString()
  @IsNotEmpty()
  varietyName!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightTons?: number;

  @IsUUID()
  locationId!: string;

  @IsEnum(OwnershipType)
  ownershipType!: OwnershipType;
}

export class CreateGoodsReceiptDto {
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsDateString()
  receiptDate!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GoodsReceiptLineDto)
  lines!: GoodsReceiptLineDto[];
}

export class InventoryAdjustmentDto {
  @IsEnum(InventoryMovementType)
  movementType!: InventoryMovementType;

  @IsOptional()
  @IsUUID()
  rawBlockId?: string;

  @IsOptional()
  @IsUUID()
  slabId?: string;

  @IsOptional()
  @IsUUID()
  fromLocationId?: string;

  @IsOptional()
  @IsUUID()
  toLocationId?: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;
}

export class ReverseMovementDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;
}

export class CreateMachineDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(MachineType)
  machineType!: MachineType;

  @IsOptional()
  @IsInt()
  @Min(0)
  bladeCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  headCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  abrasivesPerHead?: number;
}

export class StartCuttingDto {
  @IsUUID()
  rawBlockId!: string;

  @IsUUID()
  machineId!: string;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedSlabCount?: number;

  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;
}

export class CuttingDayLogDto {
  @IsDateString()
  operationalDate!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  runtimeHours?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  powerCutMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  downtimeMinutes?: number;

  @IsOptional()
  @IsString()
  downtimeReason?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  powerConsumptionKwh?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  slabsProducedCount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CompleteCuttingDto {
  @IsOptional()
  @IsDateString()
  endedAt?: string;

  @IsInt()
  @Min(1)
  totalSlabsCut!: number;

  @IsInt()
  @Min(0)
  finalGoodSlabCount!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lengthFt?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  widthFt?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  thicknessMm?: number;

  @IsOptional()
  @IsString()
  wastageNotes?: string;

  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;
}

export class AbortWorkflowDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;
}

export class CreatePolishingDto {
  @IsUUID()
  machineId!: string;

  @IsDateString()
  operationalDate!: string;

  @IsString()
  @IsNotEmpty()
  finishType!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID("4", { each: true })
  slabIds!: string[];

  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;

  @IsOptional() @IsNumber() @Min(0) runtimeHours?: number;
  @IsOptional() @IsNumber() @Min(0) powerConsumptionKwh?: number;
  @IsOptional() @IsInt() @Min(0) downtimeMinutes?: number;
  @IsOptional() @IsString() downtimeReason?: string;
  @IsOptional() @IsString() notes?: string;
}

export class SalesLineDto {
  @IsUUID()
  slabId!: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;
}

export class CreateSalesOrderDto {
  @IsUUID()
  customerId!: string;

  @IsDateString()
  orderDate!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SalesLineDto)
  lineItems!: SalesLineDto[];
}

export class DeliveryDto {
  @IsDateString()
  deliveryDate!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID("4", { each: true })
  slabIds!: string[];

  @IsOptional()
  @IsString()
  vehicleNumber?: string;

  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;
}

export class CreateInvoiceDto {
  @IsUUID()
  salesOrderId!: string;

  @IsString()
  @IsNotEmpty()
  invoiceNumber!: string;

  @IsDateString()
  invoiceDate!: string;

  @IsNumber()
  @Min(0)
  invoicedAmount!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  gstAmount?: number;
}

export class CreatePaymentDto {
  @IsUUID()
  invoiceId!: string;

  @IsNumber()
  @Min(0.001)
  amount!: number;

  @IsDateString()
  paymentDate!: string;

  @IsOptional()
  @IsString()
  paymentMode?: string;
}

export class UpsertDprDto {
  @IsDateString()
  reportDate!: string;

  @IsString()
  @IsNotEmpty()
  department!: string;

  @IsOptional() @IsNumber() @Min(0) productionQty?: number;
  @IsOptional() @IsNumber() @Min(0) machineUtilisationPct?: number;
  @IsOptional() @IsNumber() @Min(0) recoveryPct?: number;
  @IsOptional() @IsNumber() @Min(0) rejectionPct?: number;
  @IsOptional() @IsNumber() @Min(0) reworkPct?: number;
  @IsOptional() @IsInt() @Min(0) downtimeMinutes?: number;
  @IsOptional() @IsNumber() @Min(0) labourHours?: number;
  @IsOptional() @IsInt() @Min(0) labourHeadcount?: number;
  @IsOptional() @IsNumber() @Min(0) rawBlockConsumption?: number;
  @IsOptional() @IsInt() @Min(0) finishedSlabCount?: number;
  @IsOptional() @IsNumber() @Min(0) dispatchQty?: number;
  @IsOptional() @IsString() manualNotes?: string;
}

export class MachineLogDto {
  @IsDateString()
  logDate!: string;

  @IsOptional() @IsInt() @Min(0) runtimeMinutes?: number;
  @IsOptional() @IsInt() @Min(0) downtimeMinutes?: number;
  @IsOptional() @IsString() downtimeReason?: string;
  @IsOptional() @IsString() operatorId?: string;
  @IsOptional() @IsNumber() @Min(0) powerConsumptionKwh?: number;
  @IsOptional() @IsString() bladeOrHeadUsage?: string;
}

export class DailySalesBackfillDto {
  @IsDateString()
  summaryDate!: string;

  @IsNumber() @Min(0) totalQtySqft!: number;
  @IsNumber() @Min(0) invoicedAmount!: number;
  @IsNumber() @Min(0) actualAmountReceived!: number;
}

export class CreateExpenseDto {
  @IsString() @IsNotEmpty() category!: string;
  @IsNumber() @Min(0.001) amount!: number;
  @IsDateString() expenseDate!: string;
  @IsOptional() @IsUUID() vehicleId?: string;
  @IsOptional() @IsString() toWhom?: string;
}

export class ExpenseAllocationDto {
  @IsUUID() rawBlockId!: string;
  @IsNumber() @Min(0.001) allocatedAmount!: number;
  @IsIn(["by_weight", "by_area", "manual"])
  allocationMethod!: "by_weight" | "by_area" | "manual";
}

export class AllocateExpenseDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExpenseAllocationDto)
  allocations!: ExpenseAllocationDto[];
}
