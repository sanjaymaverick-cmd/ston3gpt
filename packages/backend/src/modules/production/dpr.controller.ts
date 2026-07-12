import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { UpsertDprDto } from "../../common/workflow.dto";
import { PRODUCTION_INPUT_ROLES } from "../../common/role-policy";
import { DprService } from "./dpr.service";

@Controller("dpr")
@UseGuards(ClerkAuthGuard, RolesGuard)
export class DprController {
  constructor(private service: DprService) {}

  @Get("derived")
  derived(@CurrentUser() user: AuthenticatedUser, @Query("date") date: string) {
    return this.service.derive(user.factoryId, date);
  }

  @Get()
  findByDate(@CurrentUser() user: AuthenticatedUser, @Query("date") date: string) {
    return this.service.findByDate(user.factoryId, date);
  }

  @Post()
  @Roles(...PRODUCTION_INPUT_ROLES)
  upsert(@CurrentUser() user: AuthenticatedUser, @Body() body: UpsertDprDto) {
    return this.service.upsert(user.factoryId, body);
  }
}
