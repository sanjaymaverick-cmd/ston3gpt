import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { DailySalesBackfillDto } from "../../common/workflow.dto";
import { HISTORICAL_IMPORT_ROLES } from "../../common/role-policy";
import { DailySalesSummaryService } from "./daily-sales-summary.service";

@Controller("daily-sales-summary")
@UseGuards(ClerkAuthGuard, RolesGuard)
export class DailySalesSummaryController {
  constructor(private service: DailySalesSummaryService) {}

  @Get()
  findRange(@CurrentUser() user: AuthenticatedUser, @Query("from") from: string, @Query("to") to: string) {
    return this.service.findByDate(user.factoryId, from, to);
  }

  // For the one-time historical backfill only. Do not call this from
  // day-to-day UI — day-to-day totals are derived automatically from
  // real sales orders via SalesOrderController.
  @Post("backfill")
  @Roles(...HISTORICAL_IMPORT_ROLES)
  backfill(@CurrentUser() user: AuthenticatedUser, @Body() body: DailySalesBackfillDto) {
    return this.service.backfill(user.factoryId, body.summaryDate, body.totalQtySqft, body.invoicedAmount, body.actualAmountReceived);
  }
}
