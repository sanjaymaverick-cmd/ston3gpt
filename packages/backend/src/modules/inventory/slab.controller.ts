import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { SALES_READ_ROLES } from "../../common/role-policy";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { SlabService } from "./slab.service";

@Controller("slabs")
@UseGuards(ClerkAuthGuard, RolesGuard)
export class SlabController {
  constructor(private service: SlabService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findAll(user.factoryId);
  }

  @Get("eligible-for-polishing")
  eligibleForPolishing(@CurrentUser() user: AuthenticatedUser, @Query("processType") processType?: string) {
    return this.service.eligibleForPolishing(user.factoryId, processType === "GRINDING" ? "GRINDING" : "POLISHING");
  }

  @Get("eligible-for-sale")
  @Roles(...SALES_READ_ROLES)
  eligibleForSale(@CurrentUser() user: AuthenticatedUser) {
    return this.service.eligibleForSale(user.factoryId);
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.service.findOne(user.factoryId, id);
  }
}
