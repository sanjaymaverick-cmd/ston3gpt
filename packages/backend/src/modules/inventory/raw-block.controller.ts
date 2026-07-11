import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { RawBlockService } from "./raw-block.service";

@Controller("raw-blocks")
@UseGuards(ClerkAuthGuard)
export class RawBlockController {
  constructor(private service: RawBlockService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findAll(user.factoryId);
  }

  @Get("eligible-for-cutting")
  eligibleForCutting(@CurrentUser() user: AuthenticatedUser) {
    return this.service.eligibleForCutting(user.factoryId);
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.service.findOne(user.factoryId, id);
  }
}
