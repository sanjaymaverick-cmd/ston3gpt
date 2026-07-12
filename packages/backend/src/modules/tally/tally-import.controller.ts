import { Controller, Get, Post, UploadedFile, UseGuards, UseInterceptors, BadRequestException } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { HISTORICAL_IMPORT_ROLES } from "../../common/role-policy";
import { TallyImportService } from "./tally-import.service";

@Controller("tally-import")
@UseGuards(ClerkAuthGuard, RolesGuard)
export class TallyImportController {
  constructor(private service: TallyImportService) {}

  @Get("batches")
  findBatches(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findBatches(user.factoryId);
  }

  @Post("daybook")
  @Roles(...HISTORICAL_IMPORT_ROLES)
  @UseInterceptors(FileInterceptor("file"))
  importDaybook(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("No file uploaded — field name must be 'file'");
    return this.service.importDaybook(user.factoryId, file.buffer, file.originalname);
  }

  @Post("trial-balance")
  @Roles(...HISTORICAL_IMPORT_ROLES)
  @UseInterceptors(FileInterceptor("file"))
  importTrialBalance(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("No file uploaded — field name must be 'file'");
    return this.service.importTrialBalance(user.factoryId, file.buffer, file.originalname);
  }
}
