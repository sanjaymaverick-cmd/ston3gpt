import { NotFoundException } from "@nestjs/common";
import { MachineLogService } from "./machine-log.service";

describe("MachineLogService", () => {
  it("rejects machine logs for machines outside the caller factory", async () => {
    const prisma = {
      machine: { findFirst: jest.fn().mockResolvedValue(null) },
      machineRuntimeLog: { upsert: jest.fn() },
    };
    const service = new MachineLogService(prisma as any);

    await expect(service.upsert("factory-a", "machine-b", "2026-07-12", { runtimeMinutes: 120 })).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.machine.findFirst).toHaveBeenCalledWith({
      where: { id: "machine-b", factoryId: "factory-a" },
      select: { id: true },
    });
    expect(prisma.machineRuntimeLog.upsert).not.toHaveBeenCalled();
  });

  it("upserts machine logs only after machine tenancy is confirmed", async () => {
    const prisma = {
      machine: { findFirst: jest.fn().mockResolvedValue({ id: "machine-a" }) },
      machineRuntimeLog: { upsert: jest.fn().mockResolvedValue({ id: "log-a" }) },
    };
    const service = new MachineLogService(prisma as any);

    await expect(service.upsert("factory-a", "machine-a", "2026-07-12", { runtimeMinutes: 120 })).resolves.toEqual({
      id: "log-a",
    });
    expect(prisma.machineRuntimeLog.upsert).toHaveBeenCalledWith({
      where: { machineId_logDate: { machineId: "machine-a", logDate: new Date("2026-07-12") } },
      update: { runtimeMinutes: 120 },
      create: { machineId: "machine-a", logDate: new Date("2026-07-12"), runtimeMinutes: 120 },
    });
  });
});
