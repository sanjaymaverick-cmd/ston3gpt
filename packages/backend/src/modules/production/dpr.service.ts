import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";

interface UpsertDprInput {
  reportDate: string;
  department: string;
  productionQty?: number;
  machineUtilisationPct?: number;
  recoveryPct?: number;
  rejectionPct?: number;
  reworkPct?: number;
  downtimeMinutes?: number;
  labourHours?: number;
  labourHeadcount?: number;
  rawBlockConsumption?: number;
  finishedSlabCount?: number;
  dispatchQty?: number;
  manualNotes?: string;
}

@Injectable()
export class DprService {
  constructor(private prisma: PrismaService) {}

  async derive(factoryId: string, reportDate: string) {
    const date = new Date(reportDate);
    const [cuttingLogs, polishingRuns, machineLogs, deliveries, activeBlocks, management] = await Promise.all([
      this.prisma.cuttingDayLog.findMany({ where: { operationalDate: date, session: { factoryId } } }),
      this.prisma.polishingSession.findMany({ where: { factoryId, operationalDate: date } }),
      this.prisma.machineRuntimeLog.findMany({ where: { logDate: date, machine: { factoryId } } }),
      this.prisma.delivery.findMany({ where: { factoryId, deliveryDate: date }, include: { lines: true } }),
      this.prisma.cuttingSession.count({ where: { factoryId, status: "IN_PROGRESS" } }),
      this.prisma.dailyProductionReport.findUnique({ where: { factoryId_reportDate_department: { factoryId, reportDate: date, department: "management" } } }),
    ]);

    const sum = (rows: any[], field: string) => rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
    const sessionRuntimeMinutes = sum(cuttingLogs, "runtimeHours") * 60 + sum(polishingRuns, "runtimeHours") * 60;
    const sessionDowntimeMinutes = sum(cuttingLogs, "downtimeMinutes") + sum(polishingRuns, "downtimeMinutes");
    const runtimeMinutes = sessionRuntimeMinutes || sum(machineLogs, "runtimeMinutes");
    const downtimeMinutes = sessionDowntimeMinutes || sum(machineLogs, "downtimeMinutes");
    const machineUtilisationPct = machineLogs.length ? Math.min(100, (sum(machineLogs, "runtimeMinutes") / (machineLogs.length * 1440)) * 100) : null;

    return {
      reportDate,
      activeBlocks,
      slabsCut: sum(cuttingLogs, "slabsProducedCount"),
      slabsPolished: sum(polishingRuns.filter((run) => run.status === "COMPLETED"), "slabsPolishedCount"),
      slabsDispatched: deliveries.reduce((total, delivery) => total + delivery.lines.length, 0),
      runtimeHours: Number((runtimeMinutes / 60).toFixed(2)),
      downtimeMinutes,
      powerConsumptionKwh: (sum(cuttingLogs, "powerConsumptionKwh") + sum(polishingRuns, "powerConsumptionKwh")) || sum(machineLogs, "powerConsumptionKwh"),
      machineUtilisationPct: machineUtilisationPct == null ? null : Number(machineUtilisationPct.toFixed(1)),
      managerNotes: management?.manualNotes ?? null,
    };
  }

  findByDate(factoryId: string, reportDate: string) {
    return this.prisma.dailyProductionReport.findMany({
      where: { factoryId, reportDate: new Date(reportDate) },
    });
  }

  // One row per (factory, date, department) — the DPR entry UI submits
  // one upsert call per department, matching the schema's unique constraint.
  upsert(factoryId: string, input: UpsertDprInput) {
    const { reportDate, department, ...fields } = input;
    if (department === "management") throw new BadRequestException("Management notes require the management-notes endpoint");
    return this.writeRow(factoryId, reportDate, department, fields);
  }

  upsertManagement(factoryId: string, input: UpsertDprInput) {
    const { reportDate, manualNotes } = input;
    return this.writeRow(factoryId, reportDate, "management", { manualNotes });
  }

  private writeRow(factoryId: string, reportDate: string, department: string, fields: Omit<UpsertDprInput, "reportDate" | "department">) {
    return this.prisma.dailyProductionReport.upsert({
      where: {
        factoryId_reportDate_department: {
          factoryId,
          reportDate: new Date(reportDate),
          department,
        },
      },
      update: { ...fields, isDerived: false },
      create: { factoryId, reportDate: new Date(reportDate), department, ...fields, isDerived: false },
    });
  }
}
