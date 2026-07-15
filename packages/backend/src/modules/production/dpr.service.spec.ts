import { DprService } from "./dpr.service";

describe("DprService derived operations summary", () => {
  it("combines cutting, polishing, machine and dispatch records without double-counting runtime", async () => {
    const prisma = {
      cuttingDayLog: { findMany: jest.fn().mockResolvedValue([{ runtimeHours: 8, downtimeMinutes: 20, slabsProducedCount: 12, powerConsumptionKwh: 40 }]) },
      polishingSession: { findMany: jest.fn().mockResolvedValue([
        { status: "COMPLETED", processType: "POLISHING", runtimeHours: 4, downtimeMinutes: 10, slabsPolishedCount: 9, powerConsumptionKwh: 20 },
        { status: "COMPLETED", processType: "GRINDING", runtimeHours: 2, downtimeMinutes: 0, slabsPolishedCount: 9, powerConsumptionKwh: 10 },
      ]) },
      machineRuntimeLog: { findMany: jest.fn().mockResolvedValue([{ runtimeMinutes: 900, downtimeMinutes: 60, powerConsumptionKwh: 5 }]) },
      delivery: { findMany: jest.fn().mockResolvedValue([{ lines: [{}, {}] }]) },
      cuttingSession: { count: jest.fn().mockResolvedValue(1) },
      dailyProductionReport: { findUnique: jest.fn().mockResolvedValue({ manualNotes: "Good operating day" }) },
    };
    const service = new DprService(prisma as any);

    await expect(service.derive("factory-a", "2026-07-12")).resolves.toEqual(expect.objectContaining({
      activeBlocks: 1,
      slabsCut: 12,
      slabsPolished: 9,
      slabsDispatched: 2,
      runtimeHours: 14,
      downtimeMinutes: 30,
      managerNotes: "Good operating day",
    }));
  });

  it("rejects management notes through the general production endpoint", async () => {
    const service = new DprService({ dailyProductionReport: { upsert: jest.fn() } } as any);
    expect(() => service.upsert("factory-a", { reportDate: "2026-07-12", department: "management", manualNotes: "not allowed" })).toThrow("Management notes require");
  });
});
