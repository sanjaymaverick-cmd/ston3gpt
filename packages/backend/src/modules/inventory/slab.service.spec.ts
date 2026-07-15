import { SlabService } from "./slab.service";

const slab = (productionStage: string) => ({
  id: productionStage,
  slabSerial: productionStage,
  productionStage,
  inventoryStatus: "AVAILABLE",
  location: { locationType: "LPM_QUEUE" },
  reservations: [],
});

describe("SlabService LPM eligibility", () => {
  const prisma = { slab: { findMany: jest.fn() } };
  const service = new SlabService(prisma as never);

  beforeEach(() => {
    prisma.slab.findMany.mockResolvedValue([slab("CUT_UNPOLISHED"), slab("GRINDED"), slab("EPOXY_APPLIED")]);
  });

  it("only sends cut slabs to grinding", async () => {
    const result = await service.eligibleForPolishing("factory-1", "GRINDING");
    expect(result.filter((item) => item.eligible).map((item) => item.productionStage)).toEqual(["CUT_UNPOLISHED"]);
  });

  it("only sends epoxy-applied slabs to polishing", async () => {
    const result = await service.eligibleForPolishing("factory-1", "POLISHING");
    expect(result.filter((item) => item.eligible).map((item) => item.productionStage)).toEqual(["EPOXY_APPLIED"]);
  });
});
