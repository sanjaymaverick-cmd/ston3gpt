import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { hashSessionToken } from "../session-token";

@Injectable()
export class AppAuthGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers.authorization as string | undefined;
    if (!header?.startsWith("Bearer ")) throw new UnauthorizedException("Missing session token");

    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash: hashSessionToken(header.slice(7)) },
      include: { user: true },
    });
    if (!session || session.expiresAt <= new Date() || !session.user.active || !session.user.passwordHash) {
      throw new UnauthorizedException("Invalid or expired session");
    }

    request.user = {
      id: session.user.id,
      email: session.user.email,
      factoryId: session.user.factoryId,
      role: session.user.role,
    };
    request.authSessionId = session.id;
    return true;
  }
}
