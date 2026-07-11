import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { CreateMachineDto } from "../../common/workflow.dto";
import { MachineService } from "./machine.service";

@Controller("machines")
@UseGuards(ClerkAuthGuard, RolesGuard)
export class MachineController {
  constructor(private service: MachineService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findAll(user.factoryId);
  }

  @Post()
  @Roles("owner", "manager")
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateMachineDto) {
    return this.service.create(user.factoryId, body);
  }
}
