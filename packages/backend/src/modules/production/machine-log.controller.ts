import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { MachineLogDto } from "../../common/workflow.dto";
import { MachineLogService } from "./machine-log.service";

@Controller("machines/:machineId/log")
@UseGuards(ClerkAuthGuard)
export class MachineLogController {
  constructor(private service: MachineLogService) {}

  @Post()
  upsert(@Param("machineId") machineId: string, @Body() body: MachineLogDto) {
    const { logDate, ...fields } = body;
    return this.service.upsert(machineId, logDate, fields);
  }
}
