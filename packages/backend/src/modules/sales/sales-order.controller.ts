import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { CreateSalesOrderDto, CustomerReturnDto, DeliveryDto } from "../../common/workflow.dto";
import { SALES_DATA_ROLES, SALES_READ_ROLES } from "../../common/role-policy";
import { SalesOrderService } from "./sales-order.service";
import { DailySalesSummaryService } from "./daily-sales-summary.service";

@Controller("sales-orders")
@UseGuards(ClerkAuthGuard, RolesGuard)
export class SalesOrderController {
  constructor(
    private service: SalesOrderService,
    private summaryService: DailySalesSummaryService,
  ) {}

  @Get()
  @Roles(...SALES_READ_ROLES)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findAll(user.factoryId);
  }

  @Get("reports/recovery")
  @Roles(...SALES_READ_ROLES)
  recoveryReport(@CurrentUser() user: AuthenticatedUser) {
    return this.service.recoveryReport(user.factoryId);
  }

  @Get(":id")
  @Roles(...SALES_READ_ROLES)
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.service.findOne(user.factoryId, id);
  }

  @Post()
  @Roles(...SALES_DATA_ROLES)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateSalesOrderDto) {
    const order = await this.service.create(user.factoryId, user.id, body);
    await this.summaryService.recomputeFromLineItems(user.factoryId, body.orderDate);
    return order;
  }

  @Post(":id/cancel")
  @Roles(...SALES_DATA_ROLES)
  cancel(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.service.cancel(user.factoryId, user.id, id);
  }

  @Post(":id/deliveries")
  @Roles(...SALES_DATA_ROLES, "inventory")
  deliver(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: DeliveryDto) {
    return this.service.deliver(user.factoryId, user.id, id, body);
  }

  @Post("returns")
  @Roles(...SALES_DATA_ROLES, "inventory")
  returnDelivered(@CurrentUser() user: AuthenticatedUser, @Body() body: CustomerReturnDto) {
    return this.service.returnDelivered(user.factoryId, user.id, body);
  }
}
