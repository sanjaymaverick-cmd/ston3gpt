import { BadRequestException } from "@nestjs/common";
import { ProvisionUserService } from "./provision-user.service";

describe("ProvisionUserService owner protection", () => {
  it("prevents a manager from demoting an existing owner", async () => {
    const prisma = {
      appUser: { findUnique: jest.fn().mockResolvedValue({ email: "owner@example.com", factoryId: "factory-a", role: "owner" }) },
      factory: { findUniqueOrThrow: jest.fn() },
    };
    const service = new ProvisionUserService(prisma as any);

    await expect(service.provision("factory-a", "manager", "owner@example.com", "manager")).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.factory.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
