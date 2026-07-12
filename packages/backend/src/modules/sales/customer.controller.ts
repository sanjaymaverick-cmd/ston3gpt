import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { SALES_DATA_ROLES } from "../../common/role-policy";
import { CreateCustomerDto } from "../../common/workflow.dto";
import { CustomerService } from "./customer.service";

@Controller("customers")
@UseGuards(ClerkAuthGuard, RolesGuard)
export class CustomerController {
  constructor(private service: CustomerService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findAll(user.factoryId);
  }

  @Post()
  @Roles(...SALES_DATA_ROLES)
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateCustomerDto) {
    return this.service.create(user.factoryId, body.name, body.contactInfo, body.creditLimit);
  }
}
