import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { AbortWorkflowDto, ApplyEpoxyDto, CompleteCuttingDto, CreatePolishingDto, StartCuttingDto, CuttingDayLogDto } from "../../common/workflow.dto";
import { CuttingSessionService } from "./cutting-session.service";
import { PolishingSessionService } from "./polishing-session.service";

@Controller("cutting-sessions")
@UseGuards(ClerkAuthGuard, RolesGuard)
export class CuttingSessionController {
  constructor(private service: CuttingSessionService) {}

  @Get("active")
  findActive(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findActive(user.factoryId);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findAll(user.factoryId);
  }

  @Post()
  @Roles("owner", "manager", "supervisor", "operator")
  start(@CurrentUser() user: AuthenticatedUser, @Body() body: StartCuttingDto) {
    return this.service.start(user.factoryId, user.id, body);
  }

  @Post(":id/day-logs")
  @Roles("owner", "manager", "supervisor", "operator")
  dayLog(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: CuttingDayLogDto) {
    return this.service.upsertDayLog(user.factoryId, id, user.id, body);
  }

  @Post(":id/complete")
  @Roles("owner", "manager", "supervisor", "operator")
  complete(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: CompleteCuttingDto) {
    return this.service.complete(user.factoryId, user.id, id, body);
  }

  @Post(":id/abort")
  @Roles("owner", "manager", "supervisor")
  abort(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: AbortWorkflowDto) {
    return this.service.abort(user.factoryId, user.id, id, body);
  }
}

@Controller("polishing-sessions")
@UseGuards(ClerkAuthGuard, RolesGuard)
export class PolishingSessionController {
  constructor(private service: PolishingSessionService) {}

  @Get()
  findByDate(@CurrentUser() user: AuthenticatedUser, @Query("date") date: string) {
    return this.service.findByDate(user.factoryId, date);
  }

  @Post()
  @Roles("owner", "manager", "supervisor", "operator")
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreatePolishingDto) {
    return this.service.create(user.factoryId, user.id, body);
  }

  @Post("epoxy")
  @Roles("owner", "manager", "supervisor", "operator")
  applyEpoxy(@CurrentUser() user: AuthenticatedUser, @Body() body: ApplyEpoxyDto) {
    return this.service.applyEpoxy(user.factoryId, user.id, body);
  }

  @Post(":id/complete")
  @Roles("owner", "manager", "supervisor", "operator")
  complete(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: AbortWorkflowDto) {
    return this.service.complete(user.factoryId, user.id, id, body.idempotencyKey);
  }

  @Post(":id/abort")
  @Roles("owner", "manager", "supervisor")
  abort(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: AbortWorkflowDto) {
    return this.service.abort(user.factoryId, user.id, id, body);
  }
}
