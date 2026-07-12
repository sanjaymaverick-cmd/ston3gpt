import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthenticatedUser, CurrentUser } from "../../common/decorators/current-user.decorator";
import {
  AddOpeningRawBlockDto,
  AddOpeningSlabDto,
  CreateGoodsReceiptDto,
  CreateOpeningSnapshotDto,
  InventoryAdjustmentDto,
  RejectSnapshotDto,
  ReverseMovementDto,
} from "../../common/workflow.dto";
import { HISTORICAL_IMPORT_ROLES, INVENTORY_DATA_ROLES, USER_MANAGEMENT_ROLES } from "../../common/role-policy";
import { InventoryWorkflowService } from "./inventory-workflow.service";

@Controller("opening-inventory")
@UseGuards(ClerkAuthGuard, RolesGuard)
export class OpeningInventoryController {
  constructor(private service: InventoryWorkflowService) {}

  @Get("snapshots")
  @Roles("owner", "manager", "supervisor", "auditor")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listOpeningSnapshots(user.factoryId);
  }

  @Post("snapshots")
  @Roles(...HISTORICAL_IMPORT_ROLES)
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateOpeningSnapshotDto) {
    return this.service.createOpeningSnapshot(user.factoryId, user.id, body);
  }

  @Post("snapshots/:id/raw-blocks")
  @Roles(...HISTORICAL_IMPORT_ROLES)
  addRawBlock(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: AddOpeningRawBlockDto) {
    return this.service.addOpeningRawBlock(user.factoryId, id, body);
  }

  @Post("snapshots/:id/slabs")
  @Roles(...HISTORICAL_IMPORT_ROLES)
  addSlab(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: AddOpeningSlabDto) {
    return this.service.addOpeningSlab(user.factoryId, id, body);
  }

  @Post("snapshots/:id/submit")
  @Roles(...HISTORICAL_IMPORT_ROLES)
  submit(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.service.submitOpeningSnapshot(user.factoryId, user.id, id);
  }

  @Post("snapshots/:id/approve")
  @Roles(...HISTORICAL_IMPORT_ROLES)
  approve(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.service.approveOpeningSnapshot(user.factoryId, user.id, id);
  }

  @Post("snapshots/:id/reject")
  @Roles(...HISTORICAL_IMPORT_ROLES)
  reject(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: RejectSnapshotDto) {
    return this.service.rejectOpeningSnapshot(user.factoryId, user.id, id, body.reason);
  }
}

@Controller("factory")
@UseGuards(ClerkAuthGuard, RolesGuard)
export class FactoryWorkflowController {
  constructor(private service: InventoryWorkflowService) {}

  @Post("go-live")
  @Roles(...USER_MANAGEMENT_ROLES)
  goLive(@CurrentUser() user: AuthenticatedUser) {
    return this.service.goLive(user.factoryId, user.id);
  }
}

@Controller("goods-receipts")
@UseGuards(ClerkAuthGuard, RolesGuard)
export class GoodsReceiptController {
  constructor(private service: InventoryWorkflowService) {}

  @Post()
  @Roles(...INVENTORY_DATA_ROLES)
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateGoodsReceiptDto) {
    return this.service.createGoodsReceipt(user.factoryId, user.id, body);
  }

  @Post(":id/submit")
  @Roles(...INVENTORY_DATA_ROLES)
  submit(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.service.submitGoodsReceipt(user.factoryId, user.id, id);
  }
}

@Controller("inventory")
@UseGuards(ClerkAuthGuard, RolesGuard)
export class InventoryWorkflowController {
  constructor(private service: InventoryWorkflowService) {}

  @Get("locations")
  @Roles("owner", "manager", "supervisor", "operator", "inventory", "sales", "auditor")
  locations(@CurrentUser() user: AuthenticatedUser) {
    return this.service.ensureDefaultLocations(user.factoryId);
  }

  @Get("on-hand")
  @Roles("owner", "manager", "supervisor", "operator", "inventory", "sales", "auditor")
  onHand(@CurrentUser() user: AuthenticatedUser) {
    return this.service.onHand(user.factoryId);
  }

  @Get("movements")
  @Roles("owner", "manager", "auditor")
  movements(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listMovements(user.factoryId);
  }

  @Post("adjustments")
  @Roles("owner", "manager")
  adjust(@CurrentUser() user: AuthenticatedUser, @Body() body: InventoryAdjustmentDto) {
    return this.service.adjust(user.factoryId, user.id, body);
  }

  @Post("movements/:id/reverse")
  @Roles("owner", "manager")
  reverse(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: ReverseMovementDto) {
    return this.service.reverseMovement(user.factoryId, user.id, id, body);
  }
}
