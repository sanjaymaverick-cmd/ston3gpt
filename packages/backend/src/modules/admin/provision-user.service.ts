import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { clerkClient } from "../../common/clerk-client";
import { PrismaService } from "../../common/prisma.service";
import { OWNER_ROLE, PROVISIONABLE_ROLES } from "../../common/role-policy";

@Injectable()
export class ProvisionUserService {
  constructor(private prisma: PrismaService) {}

  // Called by an existing owner/admin to grant a teammate access. Looks
  // the person up by the email they already signed up to Clerk with —
  // they must have created a Clerk account first (sign-up flow is
  // unrestricted; this step is what actually turns "has an account" into
  // "can see Vedam Granites' data").
  async provision(factoryId: string, callerRole: string, email: string, role: string) {
    const validRoles = callerRole === OWNER_ROLE ? [OWNER_ROLE, ...PROVISIONABLE_ROLES] : PROVISIONABLE_ROLES;
    if (!validRoles.includes(role)) {
      throw new BadRequestException(`role must be one of: ${validRoles.join(", ")}`);
    }
    const existingUser = await this.prisma.appUser.findUnique({ where: { email } });
    if (existingUser?.factoryId === factoryId && existingUser.role === OWNER_ROLE && callerRole !== OWNER_ROLE) {
      throw new BadRequestException("Only an owner can change another owner's access");
    }
    const factory = await this.prisma.factory.findUniqueOrThrow({ where: { id: factoryId } });

    const { data: users } = await clerkClient.users.getUserList({ emailAddress: [email] });
    if (users.length === 0) {
      throw new NotFoundException(
        `No Clerk account found for ${email} — they need to sign up in the app first, then you can provision them.`,
      );
    }
    const clerkUser = users[0];

    await clerkClient.users.updateUserMetadata(clerkUser.id, {
      publicMetadata: { factoryId, role },
    });

    // Mirror into our own app_user table too, so the rest of the app
    // (e.g. attributing a userId on state transitions) has a local row
    // to reference rather than only living in Clerk.
    const appUser = await this.prisma.appUser.upsert({
      where: { email },
      update: { factoryId, role: role as any, active: true },
      create: { factoryId, email, name: clerkUser.firstName ?? email, role: role as any },
    });

    return { clerkUserId: clerkUser.id, appUser, factoryName: factory.name };
  }

  listUsers(factoryId: string) {
    return this.prisma.appUser.findMany({ where: { factoryId }, orderBy: { name: "asc" } });
  }
}
