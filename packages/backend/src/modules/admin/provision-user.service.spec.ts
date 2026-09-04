import { BadRequestException } from "@nestjs/common";
import { ProvisionUserService } from "./provision-user.service";

describe("ProvisionUserService owner protection", () => {
  it("prevents a manager from demoting an existing owner", async () => {
    const prisma = {
      appUser: { findUnique: jest.fn().mockResolvedValue({ email: "owner@example.com", factoryId: "factory-a", role: "owner" }) },
      factory: { findUniqueOrThrow: jest.fn() },
    };
    const service = new ProvisionUserService(prisma as any);

    await expect(service.provision("factory-a", "manager", "Owner", "owner@example.com", "temporary-pass", "manager")).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.factory.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("prevents a manager from revoking another manager", async () => {
    const prisma = {
      appUser: { findFirst: jest.fn().mockResolvedValue({ id: "manager-2", factoryId: "factory-a", role: "manager" }) },
    };
    const service = new ProvisionUserService(prisma as any);

    await expect(service.revoke("factory-a", "manager", "manager-2")).rejects.toBeInstanceOf(BadRequestException);
  });
});
