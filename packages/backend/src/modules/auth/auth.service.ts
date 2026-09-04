import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { verifyPassword } from "../../common/password";
import { createSessionToken, hashSessionToken } from "../../common/session-token";

const SESSION_DAYS = 7;

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async login(email: string, password: string) {
    const user = await this.prisma.appUser.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user?.active || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.authSession.create({
      data: { userId: user.id, tokenHash: hashSessionToken(token), expiresAt },
    });
    return { token, expiresAt, user: { id: user.id, email: user.email, name: user.name, role: user.role, factoryId: user.factoryId } };
  }

  async logout(sessionId: string) {
    await this.prisma.authSession.deleteMany({ where: { id: sessionId } });
    return { loggedOut: true };
  }
}
