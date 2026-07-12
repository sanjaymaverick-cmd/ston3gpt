import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthenticatedUser, CurrentUser } from "../../common/decorators/current-user.decorator";
import { CreateInvoiceDto, CreatePaymentDto } from "../../common/workflow.dto";
import { COMMERCIAL_DATA_ROLES } from "../../common/role-policy";
import { CommercialService } from "./commercial.service";

@Controller("invoices")
@UseGuards(ClerkAuthGuard, RolesGuard)
export class InvoiceController {
  constructor(private service: CommercialService) {}

  @Post()
  @Roles(...COMMERCIAL_DATA_ROLES)
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateInvoiceDto) {
    return this.service.createInvoice(user.factoryId, body);
  }
}

@Controller("payments")
@UseGuards(ClerkAuthGuard, RolesGuard)
export class PaymentController {
  constructor(private service: CommercialService) {}

  @Post()
  @Roles(...COMMERCIAL_DATA_ROLES)
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreatePaymentDto) {
    return this.service.createPayment(user.factoryId, body);
  }
}
