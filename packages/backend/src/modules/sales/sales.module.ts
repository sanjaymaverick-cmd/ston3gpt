import { Module } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { InventoryModule } from "../inventory/inventory.module";
import { SalesOrderController } from "./sales-order.controller";
import { SalesOrderService } from "./sales-order.service";
import { DailySalesSummaryController } from "./daily-sales-summary.controller";
import { DailySalesSummaryService } from "./daily-sales-summary.service";
import { CustomerController } from "./customer.controller";
import { CustomerService } from "./customer.service";
import { InvoiceController, PaymentController } from "./commercial.controller";
import { CommercialService } from "./commercial.service";

@Module({
  imports: [InventoryModule],
  controllers: [SalesOrderController, DailySalesSummaryController, CustomerController, InvoiceController, PaymentController],
  providers: [SalesOrderService, DailySalesSummaryService, CustomerService, CommercialService, PrismaService],
})
export class SalesModule {}
