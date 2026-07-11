import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { SlabService } from "./slab.service";

@Controller("slabs")
@UseGuards(ClerkAuthGuard)
export class SlabController {
  constructor(private service: SlabService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findAll(user.factoryId);
  }

  @Get("eligible-for-polishing")
  eligibleForPolishing(@CurrentUser() user: AuthenticatedUser) {
    return this.service.eligibleForPolishing(user.factoryId);
  }

  @Get("eligible-for-sale")
  eligibleForSale(@CurrentUser() user: AuthenticatedUser) {
    return this.service.eligibleForSale(user.factoryId);
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.service.findOne(user.factoryId, id);
  }
}
