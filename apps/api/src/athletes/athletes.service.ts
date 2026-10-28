import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AthleteStatus, Prisma } from "@prisma/client";
import { AuthUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { skipTake } from "../common/pagination";
import { ageOnDate } from "../ratings/rating.engine";

@Injectable()
export class AthletesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: {
    q?: string;
    page: number;
    pageSize: number;
    municipality?: string;
  }) {
    const where: Prisma.AthleteWhereInput = {
      ...(params.municipality ? { municipality: params.municipality } : {}),
      ...(params.q
        ? {
            OR: [
              { lastName: { contains: params.q, mode: "insensitive" } },
              { firstName: { contains: params.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.athlete.findMany({
        where,
        include: {
          organization: true,
          disciplines: { include: { discipline: true } },
          ranks: true,
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        ...skipTake(params.page, params.pageSize),
      }),
      this.prisma.athlete.count({ where }),
    ]);
    return { items, total };
  }

  async get(id: string) {
    const athlete = await this.prisma.athlete.findUnique({
      where: { id },
      include: {
        organization: true,
        disciplines: { include: { discipline: true } },
        ranks: { orderBy: { assignedAt: "desc" } },
        results: {
          where: { status: "PUBLISHED" },
          include: { competition: { include: { discipline: true } } },
          orderBy: { createdAt: "desc" },
        },
        coaches: { include: { coach: true, discipline: true } },
        antiDoping: { orderBy: { completedAt: "desc" } },
        consents: true,
        disqualifications: true,
      },
    });
    if (!athlete) {
      throw new NotFoundException("Спортсмен не найден");
    }
    return athlete;
  }

  currentRank(
    ranks: Array<{ assignedAt: Date; expiresAt: Date; rankType: string }>,
    now = new Date(),
  ) {
    return (
      ranks
        .filter((item) => item.assignedAt <= now && item.expiresAt >= now)
        .sort((a, b) => b.assignedAt.getTime() - a.assignedAt.getTime())[0] ??
      null
    );
  }

  async assertCoachAccess(user: AuthUser, athleteId: string) {
    if (user.activeRole === "FEDERATION" || user.activeRole === "MINISTRY") {
      return;
    }
    if (user.activeRole === "ATHLETE" && user.athleteId === athleteId) {
      return;
    }
    if (user.activeRole === "COACH" && user.coachId) {
      const link = await this.prisma.coachAthlete.findFirst({
        where: { coachId: user.coachId, athleteId, status: "ACTIVE" },
      });
      if (link) {
        return;
      }
    }
    throw new ForbiddenException("Нет доступа к данным спортсмена");
  }

  /** Ограниченная карточка для выбора спортсмена тренером при запросе связи. */
  async directory(q?: string) {
    return this.prisma.athlete.findMany({
      where: {
        status: "ACTIVE",
        ...(q
          ? {
              OR: [
                { lastName: { contains: q, mode: "insensitive" } },
                { firstName: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        lastName: true,
        firstName: true,
        middleName: true,
        municipality: true,
        organization: { select: { name: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 50,
    });
  }

  async addConsent(
    user: AuthUser,
    athleteId: string,
    data: {
      consentType?: string;
      version: string;
      representativeName?: string;
      representativeRelation?: string;
    },
  ) {
    const athlete = await this.prisma.athlete.findUnique({
      where: { id: athleteId },
    });
    if (!athlete) {
      throw new NotFoundException("Спортсмен не найден");
    }
    const isSelf =
      user.activeRole === "ATHLETE" && user.athleteId === athleteId;
    if (!isSelf && user.activeRole !== "FEDERATION") {
      throw new ForbiddenException(
        "Согласие может зафиксировать спортсмен или федерация",
      );
    }
    const isMinor = ageOnDate(athlete.birthDate, new Date()) < 18;
    const representativeName = data.representativeName?.trim();
    if (
      isMinor &&
      (!representativeName || !data.representativeRelation?.trim())
    ) {
      throw new BadRequestException(
        "Для несовершеннолетнего требуется согласие законного представителя",
      );
    }
    return this.prisma.consent.create({
      data: {
        subjectType: "ATHLETE",
        athleteId,
        userId: athlete.userId,
        consentType: data.consentType ?? "PERSONAL_DATA",
        version: data.version,
        grantedByUserId: user.id,
        representativeName: isMinor
          ? representativeName
          : data.representativeName,
        representativeRelation: isMinor
          ? data.representativeRelation
          : undefined,
      },
    });
  }

  async addAntiDoping(
    user: AuthUser,
    athleteId: string,
    data: {
      courseName: string;
      completedAt: string;
      certificateNumber?: string;
    },
  ) {
    await this.assertCoachAccess(user, athleteId);
    if (!data.courseName.trim() || new Date(data.completedAt) > new Date()) {
      throw new BadRequestException(
        "Укажите название курса и дату прохождения не позднее сегодняшней",
      );
    }
    return this.prisma.antiDopingRecord.create({
      data: { athleteId, ...data, completedAt: new Date(data.completedAt) },
    });
  }

  async create(data: {
    lastName: string;
    firstName: string;
    middleName?: string;
    birthDate: string;
    municipality: string;
    organizationId?: string;
    startedYear: number;
    status?: AthleteStatus;
    guardianName?: string;
    guardianPhone?: string;
    disciplineIds?: string[];
    userId?: string;
  }) {
    const birthDate = new Date(data.birthDate);
    if (
      !data.firstName.trim() ||
      !data.lastName.trim() ||
      !data.municipality.trim() ||
      birthDate > new Date() ||
      data.startedYear < birthDate.getFullYear() ||
      data.startedYear > new Date().getFullYear()
    ) {
      throw new BadRequestException(
        "Проверьте ФИО, муниципалитет, дату рождения и год начала занятий",
      );
    }
    return this.prisma.athlete.create({
      data: {
        lastName: data.lastName,
        firstName: data.firstName,
        middleName: data.middleName,
        birthDate: new Date(data.birthDate),
        municipality: data.municipality,
        organizationId: data.organizationId,
        startedYear: data.startedYear,
        status: data.status ?? AthleteStatus.ACTIVE,
        guardianName: data.guardianName,
        guardianPhone: data.guardianPhone,
        userId: data.userId,
        disciplines: data.disciplineIds
          ? {
              create: data.disciplineIds.map((disciplineId) => ({
                disciplineId,
              })),
            }
          : undefined,
      },
    });
  }
}
