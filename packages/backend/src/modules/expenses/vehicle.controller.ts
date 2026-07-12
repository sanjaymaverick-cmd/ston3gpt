import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { OPERATIONAL_DATA_ROLES } from "../../common/role-policy";
import { CreateVehicleDto } from "../../common/workflow.dto";
import { VehicleService } from "./vehicle.service";

@Controller("vehicles")
@UseGuards(ClerkAuthGuard, RolesGuard)
export class VehicleController {
  constructor(private service: VehicleService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findAll(user.factoryId);
  }

  @Post()
  @Roles(...OPERATIONAL_DATA_ROLES)
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateVehicleDto) {
    return this.service.create(user.factoryId, body.name, body.vehicleType, body.purchaseDate);
  }
}
