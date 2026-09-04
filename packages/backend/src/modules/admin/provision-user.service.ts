import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { clerkClient } from "../../common/clerk-client";
import { PrismaService } from "../../common/prisma.service";
import { OWNER_ROLE, PROVISIONABLE_ROLES } from "../../common/role-policy";

@Injectable()
export class ProvisionUserService {
  constructor(private prisma: PrismaService) {}

  async provision(factoryId: string, callerRole: string, name: string, email: string, password: string, role: string) {
    const validRoles = callerRole === OWNER_ROLE ? [OWNER_ROLE, ...PROVISIONABLE_ROLES] : PROVISIONABLE_ROLES;
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

    const { data: users } = await clerkClient.users.getUserList({ emailAddress: [normalizedEmail] });
    if (users.length > 0) {
      throw new ConflictException("A login already exists with this email; revoke it before recreating access");
    }

    const clerkUser = await clerkClient.users.createUser({
      emailAddress: [normalizedEmail],
      password,
      firstName: name.trim(),
      publicMetadata: { factoryId, role },
    });

    const appUser = await this.prisma.appUser.upsert({
      where: { email: normalizedEmail },
      update: { factoryId, name: name.trim(), role: role as any, active: true },
      create: { factoryId, email: normalizedEmail, name: name.trim(), role: role as any },
    });

    return { clerkUserId: clerkUser.id, appUser, factoryName: factory.name };
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

    const { data: clerkUsers } = await clerkClient.users.getUserList({ emailAddress: [appUser.email] });
    await Promise.all(clerkUsers.map((user) => clerkClient.users.deleteUser(user.id)));
    const revokedUser = await this.prisma.appUser.update({
      where: { id: appUser.id },
      data: { active: false },
    });

    return { revoked: true, user: revokedUser };
  }

  listUsers(factoryId: string) {
    return this.prisma.appUser.findMany({ where: { factoryId }, orderBy: { name: "asc" } });
  }
}
