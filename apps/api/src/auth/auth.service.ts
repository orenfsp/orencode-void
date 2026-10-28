import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { RoleCode } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../common/prisma.service";
import { AuthUser } from "./auth.types";

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  async login(
    email: string,
    password: string,
    ip?: string,
    userAgent?: string,
  ) {
    const normalized = email.trim().toLowerCase();
    const windowMin = Number(process.env.LOGIN_WINDOW_MINUTES ?? 15);
    const maxAttempts = Number(process.env.LOGIN_MAX_ATTEMPTS ?? 5);
    const since = new Date(Date.now() - windowMin * 60 * 1000);

    const failed = await this.prisma.loginAttempt.count({
      where: {
        success: false,
        createdAt: { gte: since },
        OR: [{ email: normalized }, ...(ip ? [{ ip }] : [])],
      },
    });
    if (failed >= maxAttempts) {
      throw new UnauthorizedException(
        "Слишком много попыток входа. Повторите позже.",
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
      include: {
        roles: { include: { role: true } },
        athlete: true,
        coach: true,
        judge: true,
      },
    });

    const valid = user
      ? await bcrypt.compare(password, user.passwordHash)
      : false;
    await this.prisma.loginAttempt.create({
      data: {
        email: normalized,
        success: Boolean(user && valid && user.isActive),
        userId: user?.id,
        ip,
      },
    });

    if (!user || !valid || !user.isActive) {
      throw new UnauthorizedException("Неверный email или пароль");
    }

    const roles = user.roles.map((item) => item.role.code);
    const activeRole = roles[0];
    if (!activeRole) {
      throw new ForbiddenException("У пользователя нет назначенных ролей");
    }

    const token = randomBytes(32).toString("hex");
    const hours = Number(process.env.SESSION_TTL_HOURS ?? 12);
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(token),
        activeRoleCode: activeRole,
        expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
        ip,
        userAgent,
      },
    });

    return {
      token,
      user: this.toAuthUser(user, roles, activeRole, session.id),
    };
  }

  async resolveSession(token: string): Promise<AuthUser | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: {
        user: {
          include: {
            roles: { include: { role: true } },
            athlete: true,
            coach: true,
            judge: true,
          },
        },
      },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt < new Date() ||
      !session.user.isActive
    ) {
      return null;
    }
    const roles = session.user.roles.map((item) => item.role.code);
    if (!roles.includes(session.activeRoleCode)) {
      return null;
    }
    return this.toAuthUser(
      session.user,
      roles,
      session.activeRoleCode,
      session.id,
    );
  }

  async switchRole(user: AuthUser, role: RoleCode) {
    if (!user.roles.includes(role)) {
      throw new ForbiddenException("Эта роль недоступна пользователю");
    }
    await this.prisma.session.update({
      where: { id: user.sessionId },
      data: { activeRoleCode: role },
    });
    return { ...user, activeRole: role };
  }

  async logout(user: AuthUser) {
    await this.prisma.session.update({
      where: { id: user.sessionId },
      data: { revokedAt: new Date() },
    });
  }

  private toAuthUser(
    user: {
      id: string;
      email: string;
      lastName: string;
      firstName: string;
      middleName: string | null;
      athlete: { id: string } | null;
      coach: { id: string } | null;
      judge: { id: string } | null;
    },
    roles: RoleCode[],
    activeRole: RoleCode,
    sessionId: string,
  ): AuthUser {
    return {
      id: user.id,
      email: user.email,
      lastName: user.lastName,
      firstName: user.firstName,
      middleName: user.middleName,
      roles,
      activeRole,
      sessionId,
      athleteId: user.athlete?.id,
      coachId: user.coach?.id,
      judgeId: user.judge?.id,
    };
  }
}
