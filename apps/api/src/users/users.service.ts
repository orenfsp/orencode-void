import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, RoleCode } from "@prisma/client";
import bcrypt from "bcryptjs";
import { AuthUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";

export type AccountInput = {
  email: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  roles: RoleCode[];
  isActive: boolean;
  password?: string;
  athleteId?: string;
  updatedAt?: string;
};
const accountSelect = {
  id: true,
  email: true,
  lastName: true,
  firstName: true,
  middleName: true,
  isActive: true,
  updatedAt: true,
  athlete: { select: { id: true } },
  roles: { select: { role: { select: { code: true } } } },
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const users = await this.prisma.user.findMany({
      select: accountSelect,
      orderBy: { lastName: "asc" },
    });
    return users.map(({ roles, athlete, ...user }) => ({
      ...user,
      athleteId: athlete?.id,
      roles: roles.map((r) => r.role.code),
    }));
  }

  availableAthletes(q?: string) {
    return this.prisma.athlete.findMany({
      where: {
        userId: null,
        ...(q
          ? {
              OR: ["lastName", "firstName"].map((key) => ({
                [key]: { contains: q, mode: "insensitive" },
              })),
            }
          : {}),
      },
      select: {
        id: true,
        lastName: true,
        firstName: true,
        middleName: true,
        birthDate: true,
      },
      orderBy: { lastName: "asc" },
      take: 100,
    });
  }

  async save(actor: AuthUser, dto: AccountInput, id?: string) {
    if (!id && !dto.password)
      throw new BadRequestException("Укажите пароль нового аккаунта");
    if (!dto.firstName.trim() || !dto.lastName.trim())
      throw new BadRequestException("Заполните имя и фамилию");
    if (id === actor.id && (!dto.isActive || !dto.roles.includes("FEDERATION")))
      throw new BadRequestException(
        "Нельзя заблокировать себя или снять с себя роль федерации",
      );
    if (dto.password && Buffer.byteLength(dto.password, "utf8") > 72)
      throw new BadRequestException(
        "Пароль должен занимать не более 72 байт UTF-8",
      );
    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 12)
      : undefined;
    return this.prisma.$transaction(
      async (tx) => {
        const old = id
          ? await tx.user.findUnique({ where: { id }, select: accountSelect })
          : null;
        if (id && !old) throw new NotFoundException("Аккаунт не найден");
        if (
          old &&
          (!dto.updatedAt || old.updatedAt.toISOString() !== dto.updatedAt)
        )
          throw new ConflictException(
            "Аккаунт уже изменён. Обновите список и повторите редактирование",
          );
        if (
          old?.roles.some((r) => r.role.code === "FEDERATION") &&
          old.isActive &&
          (!dto.isActive || !dto.roles.includes("FEDERATION"))
        ) {
          const count = await tx.user.count({
            where: {
              isActive: true,
              roles: { some: { role: { code: "FEDERATION" } } },
            },
          });
          if (count <= 1)
            throw new BadRequestException(
              "Нельзя отключить последнего сотрудника федерации",
            );
        }
        const names = {
          lastName: dto.lastName.trim(),
          firstName: dto.firstName.trim(),
          middleName: dto.middleName?.trim() || null,
        };
        const data = {
          ...names,
          email: dto.email.trim().toLowerCase(),
          isActive: dto.isActive,
          ...(passwordHash ? { passwordHash } : {}),
        };
        const user = old
          ? await tx.user.update({ where: { id }, data })
          : await tx.user.create({
              data: { ...data, passwordHash: passwordHash! },
            });
        if (dto.athleteId && old?.athlete && old.athlete.id !== dto.athleteId)
          throw new BadRequestException(
            "Аккаунт уже связан с другим спортсменом",
          );
        if (dto.roles.includes("ATHLETE") && !old?.athlete) {
          if (!dto.athleteId)
            throw new BadRequestException(
              "Для роли спортсмена выберите свободный профиль из реестра",
            );
          const linked = await tx.athlete.updateMany({
            where: { id: dto.athleteId, userId: null },
            data: { userId: user.id },
          });
          if (!linked.count)
            throw new ConflictException(
              "Профиль спортсмена не найден или уже привязан",
            );
        }
        if (dto.roles.includes("COACH"))
          await tx.coach.upsert({
            where: { userId: user.id },
            create: { userId: user.id, ...names },
            update: names,
          });
        if (dto.roles.includes("JUDGE"))
          await tx.judge.upsert({
            where: { userId: user.id },
            create: { userId: user.id, ...names },
            update: names,
          });
        const roles = await tx.role.findMany({
          where: { code: { in: dto.roles } },
        });
        if (roles.length !== dto.roles.length)
          throw new BadRequestException("Неизвестные или повторяющиеся роли");
        await tx.userRole.deleteMany({ where: { userId: user.id } });
        await tx.userRole.createMany({
          data: roles.map((role) => ({ userId: user.id, roleId: role.id })),
        });
        const oldRoles = old?.roles
          .map((r) => r.role.code)
          .sort()
          .join(",");
        const securityChanged =
          old &&
          (passwordHash ||
            old.email !== data.email ||
            old.isActive !== dto.isActive ||
            oldRoles !== [...dto.roles].sort().join(","));
        if (securityChanged)
          await tx.session.updateMany({
            where: { userId: user.id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        // Passwords and their hashes never enter the audit log or response.
        await tx.auditLog.create({
          data: {
            userId: actor.id,
            action: old ? "USER_UPDATE" : "USER_CREATE",
            entityType: "User",
            entityId: user.id,
            changes: {
              email: data.email,
              roles: dto.roles,
              isActive: dto.isActive,
              passwordChanged: !!passwordHash,
              ...(old
                ? {
                    previous: {
                      email: old.email,
                      roles: old.roles.map((r) => r.role.code),
                      isActive: old.isActive,
                    },
                  }
                : {}),
            },
          },
        });
        return { id: user.id, sessionsRevoked: !!securityChanged };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
