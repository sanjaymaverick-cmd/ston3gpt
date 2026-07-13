import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "./common/prisma.service";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("live")
  live() {
    return { status: "ok" };
  }

  @Get()
  ready() {
    return this.checkDatabase();
  }

  @Get("ready")
  readyAlias() {
    return this.checkDatabase();
  }

  private async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ok", database: "reachable" };
    } catch {
      throw new ServiceUnavailableException({ status: "unavailable", database: "unreachable" });
    }
  }
}
