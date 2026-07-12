import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";

@Injectable()
export class MachineLogService {
  constructor(private prisma: PrismaService) {}

  // machineId + logDate is the unique constraint — same upsert pattern as DPR.
  async upsert(factoryId: string, machineId: string, logDate: string, fields: Record<string, unknown>) {
    const machine = await this.prisma.machine.findFirst({ where: { id: machineId, factoryId }, select: { id: true } });
    if (!machine) {
      throw new NotFoundException("Machine not found for this factory");
    }

    return this.prisma.machineRuntimeLog.upsert({
      where: { machineId_logDate: { machineId, logDate: new Date(logDate) } },
      update: fields,
      create: { machineId, logDate: new Date(logDate), ...fields },
    });
  }
}
