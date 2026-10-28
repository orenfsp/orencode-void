import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CoachAthleteStatus } from "@prisma/client";
import { AuthUser } from "../auth/auth.types";
import { AuditService } from "../common/audit.service";
import { NotificationsService } from "../common/notifications.service";
import { PrismaService } from "../common/prisma.service";

@Injectable()
export class CoachesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  list() {
    return this.prisma.coach.findMany({
      include: {
        organization: true,
        disciplines: { include: { discipline: true } },
        user: { select: { email: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
  }

  async myAthletes(user: AuthUser) {
    if (!user.coachId) {
      throw new ForbiddenException("Профиль тренера не найден");
    }
    return this.prisma.coachAthlete.findMany({
      where: { coachId: user.coachId },
      include: {
        athlete: {
          select: {
            id: true,
            lastName: true,
            firstName: true,
            middleName: true,
            municipality: true,
          },
        },
        discipline: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async requestLink(user: AuthUser, athleteId: string, disciplineId: string) {
    if (!user.coachId) {
      throw new ForbiddenException("Профиль тренера не найден");
    }
    const [athlete, coachDiscipline, existing] = await Promise.all([
      this.prisma.athlete.findUnique({ where: { id: athleteId } }),
      this.prisma.coachDiscipline.findUnique({
        where: {
          coachId_disciplineId: { coachId: user.coachId, disciplineId },
        },
      }),
      this.prisma.coachAthlete.findUnique({
        where: {
          coachId_athleteId_disciplineId: {
            coachId: user.coachId,
            athleteId,
            disciplineId,
          },
        },
      }),
    ]);
    if (!athlete) {
      throw new NotFoundException("Спортсмен не найден");
    }
    if (!coachDiscipline) {
      throw new BadRequestException("Тренер не заявлен по этой дисциплине");
    }
    if (existing && existing.status !== "ENDED") {
      throw new BadRequestException("Связь уже существует");
    }
    const link = existing
      ? await this.prisma.coachAthlete.update({
          where: { id: existing.id },
          data: { status: "PENDING", endedAt: null, confirmedAt: null },
          include: { athlete: true },
        })
      : await this.prisma.coachAthlete.create({
          data: {
            coachId: user.coachId,
            athleteId,
            disciplineId,
            status: "PENDING",
          },
          include: { athlete: true },
        });
    await this.prisma.coachAthleteStatusHistory.create({
      data: {
        coachAthleteId: link.id,
        toStatus: "PENDING",
        changedById: user.id,
      },
    });
    if (link.athlete.userId) {
      await this.notifications.notify({
        userId: link.athlete.userId,
        type: "COACH_LINK_REQUEST",
        title: "Запрос на привязку тренера",
        body: "Тренер запросил подтверждение связи со спортсменом.",
      });
    }
    return link;
  }

  async respondLink(
    user: AuthUser,
    linkId: string,
    status: CoachAthleteStatus,
  ) {
    const link = await this.prisma.coachAthlete.findUnique({
      where: { id: linkId },
      include: { athlete: true, coach: true },
    });
    if (!link) {
      throw new NotFoundException("Связь не найдена");
    }
    const allowed =
      (user.activeRole === "ATHLETE" && user.athleteId === link.athleteId) ||
      user.activeRole === "FEDERATION";
    if (!allowed) {
      throw new ForbiddenException(
        "Подтвердить связь может спортсмен или федерация",
      );
    }
    const transitions: Record<CoachAthleteStatus, CoachAthleteStatus[]> = {
      PENDING: ["ACTIVE", "ENDED"],
      ACTIVE: ["SUSPENDED", "ENDED"],
      SUSPENDED: ["ACTIVE", "ENDED"],
      ENDED: [],
    };
    if (!transitions[link.status].includes(status)) {
      throw new BadRequestException("Недопустимый переход статуса связи");
    }
    const updated = await this.prisma.coachAthlete.update({
      where: { id: linkId },
      data: {
        status,
        confirmedAt: status === "ACTIVE" ? new Date() : link.confirmedAt,
        endedAt: status === "ENDED" ? new Date() : null,
      },
    });
    await this.prisma.coachAthleteStatusHistory.create({
      data: {
        coachAthleteId: linkId,
        fromStatus: link.status,
        toStatus: status,
        changedById: user.id,
      },
    });
    await this.notifications.notify({
      userId: link.coach.userId,
      type: "COACH_LINK_UPDATED",
      title: "Статус связи со спортсменом изменён",
      body: `Новый статус: ${status}`,
    });
    return updated;
  }
}
