import { Module } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { RawBlockController } from "./raw-block.controller";
import { RawBlockService } from "./raw-block.service";
import { SlabController } from "./slab.controller";
import { SlabService } from "./slab.service";
import { InventoryWorkflowService } from "./inventory-workflow.service";
import {
  FactoryWorkflowController,
  GoodsReceiptController,
  InventoryWorkflowController,
  OpeningInventoryController,
} from "./inventory-workflow.controller";

@Module({
  controllers: [
    RawBlockController,
    SlabController,
    OpeningInventoryController,
    FactoryWorkflowController,
    GoodsReceiptController,
    InventoryWorkflowController,
  ],
  providers: [RawBlockService, SlabService, InventoryWorkflowService, PrismaService],
  exports: [InventoryWorkflowService],
})
export class InventoryModule {}
