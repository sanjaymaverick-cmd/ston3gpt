import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { AppAuthGuard } from "../../common/guards/app-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { USER_MANAGEMENT_ROLES } from "../../common/role-policy";
import { ProvisionUserDto } from "../../common/workflow.dto";
import { ProvisionUserService } from "./provision-user.service";

@Controller("admin/users")
@UseGuards(AppAuthGuard, RolesGuard)
export class ProvisionUserController {
  constructor(private service: ProvisionUserService) {}

  @Get()
  @Roles(...USER_MANAGEMENT_ROLES)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listUsers(user.factoryId);
  }

  @Post()
  @Roles(...USER_MANAGEMENT_ROLES)
  provision(@CurrentUser() user: AuthenticatedUser, @Body() body: ProvisionUserDto) {
    // Always provisions into the CALLER's own factory — an owner can
    // never accidentally (or deliberately) grant access to a different
    // factory's data than their own.
    return this.service.provision(user.factoryId, user.role, body.name, body.email, body.password, body.role);
  }

  @Delete(":id")
  @Roles(...USER_MANAGEMENT_ROLES)
  revoke(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.service.revoke(user.factoryId, user.role, id);
  }
}
