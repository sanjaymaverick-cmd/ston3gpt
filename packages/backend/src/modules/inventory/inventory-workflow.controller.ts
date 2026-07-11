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
  @Roles("owner", "manager", "supervisor")
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateOpeningSnapshotDto) {
    return this.service.createOpeningSnapshot(user.factoryId, user.id, body);
  }

  @Post("snapshots/:id/raw-blocks")
  @Roles("owner", "manager", "supervisor")
  addRawBlock(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: AddOpeningRawBlockDto) {
    return this.service.addOpeningRawBlock(user.factoryId, id, body);
  }

  @Post("snapshots/:id/slabs")
  @Roles("owner", "manager", "supervisor")
  addSlab(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: AddOpeningSlabDto) {
    return this.service.addOpeningSlab(user.factoryId, id, body);
  }

  @Post("snapshots/:id/submit")
  @Roles("owner", "manager", "supervisor")
  submit(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.service.submitOpeningSnapshot(user.factoryId, user.id, id);
  }

  @Post("snapshots/:id/approve")
  @Roles("owner", "admin")
  approve(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.service.approveOpeningSnapshot(user.factoryId, user.id, id);
  }

  @Post("snapshots/:id/reject")
  @Roles("owner", "admin")
  reject(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: RejectSnapshotDto) {
    return this.service.rejectOpeningSnapshot(user.factoryId, user.id, id, body.reason);
  }
}

@Controller("factory")
@UseGuards(ClerkAuthGuard, RolesGuard)
export class FactoryWorkflowController {
  constructor(private service: InventoryWorkflowService) {}

  @Post("go-live")
  @Roles("owner", "admin")
  goLive(@CurrentUser() user: AuthenticatedUser) {
    return this.service.goLive(user.factoryId, user.id);
  }
}

@Controller("goods-receipts")
@UseGuards(ClerkAuthGuard, RolesGuard)
export class GoodsReceiptController {
  constructor(private service: InventoryWorkflowService) {}

  @Post()
  @Roles("owner", "manager", "supervisor", "inventory")
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateGoodsReceiptDto) {
    return this.service.createGoodsReceipt(user.factoryId, user.id, body);
  }

  @Post(":id/submit")
  @Roles("owner", "manager", "supervisor", "inventory")
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
