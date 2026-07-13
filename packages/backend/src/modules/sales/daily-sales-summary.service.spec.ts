import { DailySalesSummaryService } from "./daily-sales-summary.service";

describe("DailySalesSummaryService historical audit", () => {
  it("persists import reason, actor and timestamp on backfill", async () => {
    const upsert = jest.fn().mockResolvedValue({ id: "summary-a" });
    const service = new DailySalesSummaryService({ dailySalesSummary: { upsert } } as any);

    await service.backfill("factory-a", "manager-a", "2026-07-12", 100, 2000, 1500, "Imported from signed cash book page 12");

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ importReason: "Imported from signed cash book page 12", importedBy: "manager-a", importedAt: expect.any(Date) }),
      create: expect.objectContaining({ importReason: "Imported from signed cash book page 12", importedBy: "manager-a", importedAt: expect.any(Date) }),
    }));
  });
});
