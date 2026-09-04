import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { hashPassword } from "../../common/password";
import { MANAGER_ROLE, OWNER_ROLE, PROVISIONABLE_ROLES } from "../../common/role-policy";

@Injectable()
export class ProvisionUserService {
  constructor(private prisma: PrismaService) {}

  async provision(factoryId: string, callerRole: string, name: string, email: string, password: string, role: string) {
    const validRoles = callerRole === OWNER_ROLE ? [MANAGER_ROLE, ...PROVISIONABLE_ROLES] : PROVISIONABLE_ROLES;
    if (!validRoles.includes(role)) {
      throw new BadRequestException(`role must be one of: ${validRoles.join(", ")}`);
    }
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await this.prisma.appUser.findUnique({ where: { email: normalizedEmail } });
    if (existingUser?.factoryId === factoryId && existingUser.role === OWNER_ROLE && callerRole !== OWNER_ROLE) {
      throw new BadRequestException("Only an owner can change another owner's access");
    }
    if (existingUser?.active) {
      throw new ConflictException("An active user already exists with this email");
    }
    const factory = await this.prisma.factory.findUniqueOrThrow({ where: { id: factoryId } });
    const passwordHash = await hashPassword(password);

    const appUser = await this.prisma.appUser.upsert({
      where: { email: normalizedEmail },
      update: { factoryId, name: name.trim(), passwordHash, role: role as any, active: true },
      create: { factoryId, email: normalizedEmail, name: name.trim(), passwordHash, role: role as any },
    });

    return { appUser: { ...appUser, passwordHash: undefined }, factoryName: factory.name };
  }

  async revoke(factoryId: string, callerRole: string, appUserId: string) {
    const appUser = await this.prisma.appUser.findFirst({ where: { id: appUserId, factoryId } });
    if (!appUser) throw new NotFoundException("User not found in your factory");
    if (appUser.role === OWNER_ROLE) {
      throw new BadRequestException("Owner credentials cannot be revoked from team administration");
    }
    if (callerRole !== OWNER_ROLE && appUser.role === "manager") {
      throw new BadRequestException("Only an owner can revoke a manager");
    }

    const [, revokedUser] = await this.prisma.$transaction([
      this.prisma.authSession.deleteMany({ where: { userId: appUser.id } }),
      this.prisma.appUser.update({ where: { id: appUser.id }, data: { active: false, passwordHash: null } }),
    ]);

    return { revoked: true, user: { ...revokedUser, passwordHash: undefined } };
  }

  listUsers(factoryId: string) {
    return this.prisma.appUser.findMany({
      where: { factoryId },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
      orderBy: { name: "asc" },
    });
  }
}
