import { UnauthorizedException } from "@nestjs/common";
import { hashPassword } from "../../common/password";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  it("creates a hashed, expiring session for valid credentials", async () => {
    const user = {
      id: "user-1", factoryId: "factory-1", email: "owner@example.com", name: "Owner",
      role: "owner", active: true, passwordHash: await hashPassword("a sufficiently long password"),
    };
    const prisma = {
      appUser: { findUnique: jest.fn().mockResolvedValue(user) },
      authSession: { create: jest.fn().mockResolvedValue({}) },
    };
    const result = await new AuthService(prisma as any).login(user.email, "a sufficiently long password");

    expect(result.token).toHaveLength(43);
    expect(prisma.authSession.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: user.id, tokenHash: expect.not.stringContaining(result.token) }) });
    expect(result.user).not.toHaveProperty("passwordHash");
  });

  it("rejects inactive users", async () => {
    const prisma = { appUser: { findUnique: jest.fn().mockResolvedValue({ active: false }) } };
    await expect(new AuthService(prisma as any).login("former@example.com", "password"))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("changes the password and revokes all sessions", async () => {
    const user = { id: "user-1", active: true, passwordHash: await hashPassword("old password long enough") };
    const update = jest.fn().mockReturnValue({ operation: "update" });
    const deleteMany = jest.fn().mockReturnValue({ operation: "deleteMany" });
    const transaction = jest.fn().mockResolvedValue([]);
    const prisma = {
      appUser: { findUnique: jest.fn().mockResolvedValue(user), update },
      authSession: { deleteMany },
      $transaction: transaction,
    };

    await expect(new AuthService(prisma as any).changePassword(user.id, "old password long enough", "new password long enough"))
      .resolves.toEqual({ passwordChanged: true });
    expect(update).toHaveBeenCalledWith({ where: { id: user.id }, data: { passwordHash: expect.stringContaining("scrypt$") } });
    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: user.id } });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("rejects a password change when the current password is wrong", async () => {
    const prisma = {
      appUser: { findUnique: jest.fn().mockResolvedValue({ active: true, passwordHash: await hashPassword("correct password long") }) },
    };
    await expect(new AuthService(prisma as any).changePassword("user-1", "wrong password", "new password long enough"))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });
});
