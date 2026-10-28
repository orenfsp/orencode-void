import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ApplicationStatus,
  CalendarPlanType,
  CompetitionFormat,
  CompetitionLevel,
  Prisma,
  PublicationStatus,
  RatingBand,
} from "@prisma/client";
import { AuthUser } from "../auth/auth.types";
import { AuditService } from "../common/audit.service";
import { NotificationsService } from "../common/notifications.service";
import { PrismaService } from "../common/prisma.service";
import { ageOnDate, assignPlaces } from "../ratings/rating.engine";
import { RatingsService } from "../ratings/ratings.service";

export type CreateCompetitionInput = {
  name: string;
  disciplineId: string;
  typeId: string;
  level: CompetitionLevel;
  format: CompetitionFormat;
  ageGroupId: string;
  startsAt: string;
  endsAt: string;
  venue: string;
  description?: string;
  regulationUrl?: string;
  applicationsOpenAt: string;
  applicationsCloseAt: string;
  calendarPlanType: CalendarPlanType;
  calendarPlanNumber?: string;
  ratingBand: RatingBand;
  season: number;
};

@Injectable()
export class CompetitionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly ratings: RatingsService,
  ) {}

  async list(params: {
    page: number;
    pageSize: number;
    publicOnly?: boolean;
    disciplineId?: string;
    q?: string;
    user?: AuthUser;
  }) {
    const role = params.user?.activeRole;
    const onlyPublished =
      params.publicOnly ||
      (role != null && role !== "FEDERATION" && role !== "MINISTRY");
    const where: Prisma.CompetitionWhereInput = {
      ...(onlyPublished ? { publicationStatus: "PUBLISHED" } : {}),
      ...(params.disciplineId ? { disciplineId: params.disciplineId } : {}),
      ...(params.q
        ? { name: { contains: params.q, mode: "insensitive" } }
        : {}),
      ...(role === "JUDGE"
        ? {
            judgeAssignments: { some: { judgeId: params.user?.judgeId ?? "" } },
          }
        : {}),
    };
    const all = await this.prisma.competition.findMany({
      where,
      include: {
        discipline: true,
        type: true,
        ageGroup: true,
        protocol: true,
        _count: { select: { results: true, applications: true } },
      },
      orderBy: { startsAt: "asc" },
    });

    let visible = all;
    if (role === "ATHLETE" && params.user?.athleteId) {
      const athlete = await this.prisma.athlete.findUnique({
        where: { id: params.user.athleteId },
        include: { disciplines: true },
      });
      if (athlete) {
        const disciplineIds = new Set(
          athlete.disciplines.map((item) => item.disciplineId),
        );
        visible = all.filter((competition) => {
          if (
            disciplineIds.size &&
            !disciplineIds.has(competition.disciplineId)
          ) {
            return false;
          }
          const age = ageOnDate(athlete.birthDate, competition.startsAt);
          return (
            (competition.ageGroup.minAge == null ||
              age >= competition.ageGroup.minAge) &&
            (competition.ageGroup.maxAge == null ||
              age <= competition.ageGroup.maxAge)
          );
        });
      }
    }

    const total = visible.length;
    const start = (params.page - 1) * params.pageSize;
    return { items: visible.slice(start, start + params.pageSize), total };
  }

  async get(id: string, publicOnly = false) {
    const competition = await this.prisma.competition.findUnique({
      where: { id },
      include: {
        discipline: true,
        type: true,
        ageGroup: true,
        applications: { include: { athlete: true } },
        results: { include: { athlete: true }, orderBy: { place: "asc" } },
        protocol: true,
        judgeAssignments: { include: { judge: true } },
      },
    });
    if (
      !competition ||
      (publicOnly && competition.publicationStatus !== "PUBLISHED")
    ) {
      throw new NotFoundException("Соревнование не найдено");
    }
    return competition;
  }

  /**
   * Карточка соревнования с учётом активной роли: спортсмен видит только свои
   * заявки, тренер — заявки подопечных, судья — только опубликованные
   * результаты и состав коллегии.
   */
  async getScoped(user: AuthUser, id: string) {
    const competition = await this.get(id);
    if (user.activeRole === "FEDERATION" || user.activeRole === "MINISTRY") {
      return competition;
    }
    if (competition.publicationStatus !== "PUBLISHED") {
      throw new NotFoundException("Соревнование не найдено");
    }
    if (user.activeRole === "ATHLETE" && user.athleteId) {
      return {
        ...competition,
        applications: competition.applications.filter(
          (item) => item.athleteId === user.athleteId,
        ),
        results: competition.results.filter(
          (item) => item.status === "PUBLISHED",
        ),
      };
    }
    if (user.activeRole === "COACH" && user.coachId) {
      const links = await this.prisma.coachAthlete.findMany({
        where: {
          coachId: user.coachId,
          status: "ACTIVE",
          disciplineId: competition.disciplineId,
        },
        select: { athleteId: true },
      });
      const ids = new Set(links.map((item) => item.athleteId));
      return {
        ...competition,
        applications: competition.applications.filter((item) =>
          ids.has(item.athleteId),
        ),
        results: competition.results.filter(
          (item) => item.status === "PUBLISHED",
        ),
      };
    }
    return {
      ...competition,
      applications: [],
      results: competition.results.filter(
        (item) => item.status === "PUBLISHED",
      ),
    };
  }

  private validateDates(dto: CreateCompetitionInput) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    const applicationsOpenAt = new Date(dto.applicationsOpenAt);
    const applicationsCloseAt = new Date(dto.applicationsCloseAt);
    if (
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime()) ||
      Number.isNaN(applicationsOpenAt.getTime()) ||
      Number.isNaN(applicationsCloseAt.getTime())
    ) {
      throw new BadRequestException("Некорректные даты соревнования");
    }
    if (endsAt < startsAt) {
      throw new BadRequestException(
        "Дата окончания не может быть раньше даты начала",
      );
    }
    if (applicationsCloseAt < applicationsOpenAt) {
      throw new BadRequestException(
        "Окончание приёма заявок не может быть раньше начала",
      );
    }
    if (applicationsCloseAt > startsAt) {
      throw new BadRequestException(
        "Приём заявок должен завершиться до начала соревнования",
      );
    }

    if (!dto.name.trim() || !dto.venue.trim())
      throw new BadRequestException("Заполните название и место проведения");
    return { startsAt, endsAt, applicationsOpenAt, applicationsCloseAt };
  }

  async create(user: AuthUser, dto: CreateCompetitionInput) {
    const { startsAt, endsAt, applicationsOpenAt, applicationsCloseAt } =
      this.validateDates(dto);
    const competition = await this.prisma.competition.create({
      data: {
        ...dto,
        startsAt,
        endsAt,
        applicationsOpenAt,
        applicationsCloseAt,
        createdById: user.id,
      },
    });
    await this.audit.log({
      userId: user.id,
      action: "COMPETITION_CREATE",
      entityType: "Competition",
      entityId: competition.id,
      changes: { name: competition.name },
    });
    return competition;
  }

  async update(
    user: AuthUser,
    id: string,
    input: CreateCompetitionInput & { updatedAt: string },
  ) {
    const { updatedAt, ...dto } = input;
    const dates = this.validateDates(dto);
    return this.prisma.$transaction(
      async (tx) => {
        const previous = await tx.competition.findUnique({
          where: { id },
          include: { protocol: true },
        });
        if (!previous) throw new NotFoundException("Соревнование не найдено");
        if (previous.updatedAt.toISOString() !== updatedAt)
          throw new ConflictException(
            "Соревнование уже изменено. Обновите страницу и повторите редактирование",
          );
        const group = await tx.ageGroup.findUnique({
          where: { id: dto.ageGroupId },
        });
        if (!group)
          throw new BadRequestException("Возрастная группа не найдена");
        const eligibilityChanged =
          previous.disciplineId !== dto.disciplineId ||
          previous.ageGroupId !== dto.ageGroupId ||
          previous.startsAt.getTime() !== dates.startsAt.getTime();
        if (eligibilityChanged) {
          const applications = await tx.competitionApplication.findMany({
            where: {
              competitionId: id,
              status: { in: ["PENDING", "APPROVED"] },
            },
            include: { athlete: { include: { disciplines: true } } },
          });
          for (const { athlete } of applications) {
            const age = ageOnDate(athlete.birthDate, dates.startsAt);
            if (
              (group.minAge != null && age < group.minAge) ||
              (group.maxAge != null && age > group.maxAge) ||
              (athlete.disciplines.length &&
                !athlete.disciplines.some(
                  (d) => d.disciplineId === dto.disciplineId,
                ))
            )
              throw new BadRequestException(
                `Изменения несовместимы с активной заявкой: ${athlete.lastName} ${athlete.firstName}. Проверьте дисциплину, возрастную группу и дату начала`,
              );
          }
        }
        const data = {
          ...dto,
          ...dates,
          description: dto.description || null,
          regulationUrl: dto.regulationUrl || null,
          calendarPlanNumber: dto.calendarPlanNumber || null,
        };
        const changed = Object.keys(data).filter((key) => {
          const before = previous[key as keyof typeof previous];
          const after = data[key as keyof typeof data];
          return (
            (before instanceof Date ? before.toISOString() : before) !==
            (after instanceof Date ? after.toISOString() : after)
          );
        });
        if (!changed.length) return previous;
        const saved = await tx.competition.update({
          where: { id, updatedAt: previous.updatedAt },
          data,
        });
        const protocolReset = previous.protocol?.status === "PUBLISHED";
        if (protocolReset) {
          await tx.competitionProtocol.update({
            where: { competitionId: id },
            data: { status: "DRAFT", publishedAt: null, publishedById: null },
          });
          await tx.competitionResult.updateMany({
            where: { competitionId: id },
            data: { status: "DRAFT" },
          });
        }
        if (
          protocolReset ||
          previous.season !== dto.season ||
          previous.disciplineId !== dto.disciplineId ||
          previous.ratingBand !== dto.ratingBand
        ) {
          await this.ratings.recalculate(
            previous.season,
            previous.disciplineId,
            tx,
          );
          if (
            previous.season !== dto.season ||
            previous.disciplineId !== dto.disciplineId
          )
            await this.ratings.recalculate(dto.season, dto.disciplineId, tx);
        }
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: "COMPETITION_UPDATE",
            entityType: "Competition",
            entityId: id,
            changes: JSON.parse(
              JSON.stringify({
                fields: changed,
                before: Object.fromEntries(
                  changed.map((key) => [
                    key,
                    previous[key as keyof typeof previous],
                  ]),
                ),
                after: Object.fromEntries(
                  changed.map((key) => [key, data[key as keyof typeof data]]),
                ),
                protocolReset,
              }),
            ),
          },
        });
        return saved;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 30000,
      },
    );
  }

  async publish(user: AuthUser, id: string) {
    const competition = await this.prisma.competition.update({
      where: { id },
      data: { publicationStatus: PublicationStatus.PUBLISHED },
    });
    const athletes = await this.prisma.athlete.findMany({
      where: {
        userId: { not: null },
        disciplines: { some: { disciplineId: competition.disciplineId } },
      },
    });
    await Promise.all(
      athletes
        .filter((item) => item.userId)
        .map((item) =>
          this.notifications.notify({
            userId: item.userId as string,
            type: "COMPETITION_PUBLISHED",
            title: "Опубликовано соревнование",
            body: `Опубликовано соревнование «${competition.name}».`,
          }),
        ),
    );
    await this.audit.log({
      userId: user.id,
      action: "COMPETITION_PUBLISH",
      entityType: "Competition",
      entityId: id,
    });
    return competition;
  }

  async apply(user: AuthUser, competitionId: string, athleteId: string) {
    const competition = await this.get(competitionId);
    if (competition.publicationStatus !== "PUBLISHED") {
      throw new BadRequestException(
        "Нельзя подать заявку на неопубликованное соревнование",
      );
    }
    const now = new Date();
    if (
      now < competition.applicationsOpenAt ||
      now > competition.applicationsCloseAt
    ) {
      throw new BadRequestException("Приём заявок закрыт");
    }
    const athlete = await this.prisma.athlete.findUnique({
      where: { id: athleteId },
      include: { disciplines: true },
    });
    if (!athlete) {
      throw new NotFoundException("Спортсмен не найден");
    }
    await this.assertCanSubmit(user, athleteId, competition.disciplineId);
    if (athlete.status !== "ACTIVE") {
      throw new BadRequestException(
        "Заявку может подать только спортсмен в статусе «Активен»",
      );
    }
    const disqualification = await this.prisma.disqualification.findFirst({
      where: {
        athleteId,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
    });
    if (disqualification)
      throw new BadRequestException("У спортсмена действует дисквалификация");
    if (
      athlete.disciplines.length &&
      !athlete.disciplines.some(
        (item) => item.disciplineId === competition.disciplineId,
      )
    ) {
      throw new BadRequestException("Спортсмен не заявлен в этой дисциплине");
    }

    const age = ageOnDate(athlete.birthDate, competition.startsAt);
    if (
      (competition.ageGroup.minAge != null &&
        age < competition.ageGroup.minAge) ||
      (competition.ageGroup.maxAge != null && age > competition.ageGroup.maxAge)
    ) {
      throw new BadRequestException(
        "Спортсмен не проходит по возрастной группе",
      );
    }

    const existing = await this.prisma.competitionApplication.findFirst({
      where: {
        competitionId,
        athleteId,
        status: { in: [ApplicationStatus.PENDING, ApplicationStatus.APPROVED] },
      },
    });
    if (existing) {
      throw new BadRequestException("Активная заявка уже существует");
    }

    const application = await this.prisma.$transaction(async (tx) => {
      const created = await tx.competitionApplication.create({
        data: { competitionId, athleteId, submittedById: user.id },
      });
      await tx.applicationStatusHistory.create({
        data: {
          applicationId: created.id,
          toStatus: "PENDING",
          changedById: user.id,
        },
      });
      return created;
    });

    const federation = await this.prisma.userRole.findMany({
      where: { role: { code: "FEDERATION" } },
      select: { userId: true },
    });
    await Promise.all(
      federation.map((item) =>
        this.notifications.notify({
          userId: item.userId,
          type: "APPLICATION_SUBMITTED",
          title: "Новая заявка на соревнование",
          body: `Подана заявка на «${competition.name}».`,
        }),
      ),
    );
    await this.audit.log({
      userId: user.id,
      action: "APPLICATION_SUBMIT",
      entityType: "CompetitionApplication",
      entityId: application.id,
    });
    return application;
  }

  async reviewApplication(
    user: AuthUser,
    applicationId: string,
    status: ApplicationStatus,
    reason?: string,
  ) {
    const reviewStatuses: ApplicationStatus[] = [
      ApplicationStatus.APPROVED,
      ApplicationStatus.REJECTED,
      ApplicationStatus.WITHDRAWN,
    ];
    if (!reviewStatuses.includes(status)) {
      throw new BadRequestException("Недопустимый статус");
    }
    const application = await this.prisma.competitionApplication.findUnique({
      where: { id: applicationId },
      include: { athlete: true, competition: true },
    });
    if (!application) {
      throw new NotFoundException("Заявка не найдена");
    }
    if (status === ApplicationStatus.WITHDRAWN) {
      await this.assertCanSubmit(
        user,
        application.athleteId,
        application.competition.disciplineId,
      );
      if (application.status !== ApplicationStatus.PENDING) {
        throw new BadRequestException(
          "Отозвать можно только заявку на рассмотрении",
        );
      }
    } else if (user.activeRole !== "FEDERATION") {
      throw new ForbiddenException("Модерация доступна только федерации");
    }
    if (application.status !== ApplicationStatus.PENDING) {
      throw new BadRequestException("Заявка уже рассмотрена");
    }
    if (status === ApplicationStatus.REJECTED && !reason?.trim()) {
      throw new BadRequestException("Укажите причину отклонения");
    }
    if (status === ApplicationStatus.APPROVED) {
      const duplicate = await this.prisma.competitionApplication.findFirst({
        where: {
          competitionId: application.competitionId,
          athleteId: application.athleteId,
          status: ApplicationStatus.APPROVED,
          id: { not: application.id },
        },
      });
      if (duplicate) {
        throw new BadRequestException(
          "У спортсмена уже есть одобренная заявка",
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.competitionApplication.update({
        where: { id: applicationId, status: "PENDING" },
        data: {
          status,
          rejectionReason: reason,
          reviewedById: user.id,
        },
      });
      await tx.applicationStatusHistory.create({
        data: {
          applicationId,
          fromStatus: application.status,
          toStatus: status,
          changedById: user.id,
          comment: reason,
        },
      });
      return next;
    });

    if (application.athlete.userId) {
      await this.notifications.notify({
        userId: application.athlete.userId,
        type: "APPLICATION_STATUS",
        title: "Статус заявки изменён",
        body: `Заявка на «${application.competition.name}»: ${status}`,
      });
    }
    await this.audit.log({
      userId: user.id,
      action: "APPLICATION_REVIEW",
      entityType: "CompetitionApplication",
      entityId: applicationId,
      changes: { status },
    });
    return updated;
  }

  async upsertResults(
    user: AuthUser,
    competitionId: string,
    items: Array<{
      athleteId: string;
      score: number;
      extraMetrics?: Prisma.InputJsonValue;
    }>,
  ) {
    const competition = await this.get(competitionId);
    if (
      !items.length ||
      new Set(items.map((item) => item.athleteId)).size !== items.length
    ) {
      throw new BadRequestException(
        "Нужен непустой список результатов без повторов спортсменов",
      );
    }
    if (
      competition.protocol?.status === "PUBLISHED" &&
      user.activeRole !== "FEDERATION"
    ) {
      throw new ForbiddenException(
        "Опубликованный протокол может менять только федерация",
      );
    }

    const approved = await this.prisma.competitionApplication.findMany({
      where: { competitionId, status: "APPROVED" },
    });
    const approvedMap = new Map(approved.map((item) => [item.athleteId, item]));
    for (const item of items) {
      if (!approvedMap.has(item.athleteId)) {
        throw new BadRequestException(
          "Результат можно внести только для одобренной заявки",
        );
      }
      if (!Number.isFinite(item.score)) {
        throw new BadRequestException("Баллы должны быть числом");
      }
    }

    const existing = await this.prisma.competitionResult.findMany({
      where: { competitionId },
    });
    const scores = new Map(
      existing.map((item) => [item.athleteId, Number(item.score)]),
    );
    for (const item of items) {
      scores.set(item.athleteId, item.score);
    }
    const technicalLossIds = new Set(existing.filter(r => (r.extraMetrics as {technicalLoss?:boolean}|null)?.technicalLoss).map(r => r.athleteId));
    // Места пересчитываются по всему протоколу, чтобы изменение одного
    // результата не оставляло устаревшие места у остальных участников.
    const places = assignPlaces(
      [...scores.entries()].filter(([id]) => !technicalLossIds.has(id)).map(([id, score]) => ({ id, score })),
    );
    const results = await this.prisma.$transaction(async (tx) => {
      const saved = [];
      for (const item of items) {
        const application = approvedMap.get(item.athleteId);
        if (!application) {
          continue;
        }
        const result = await tx.competitionResult.upsert({
          where: {
            competitionId_athleteId: {
              competitionId,
              athleteId: item.athleteId,
            },
          },
          create: {
            competitionId,
            athleteId: item.athleteId,
            applicationId: application.id,
            place: places.get(item.athleteId) ?? scores.size + 1,
            score: item.score,
            extraMetrics: item.extraMetrics,
            createdById: user.id,
            updatedById: user.id,
          },
          update: {
            place: places.get(item.athleteId) ?? scores.size + 1,
            score: item.score,
            extraMetrics: item.extraMetrics,
            updatedById: user.id,
          },
        });
        saved.push(result);
      }
      for (const item of existing) {
        if (items.some((next) => next.athleteId === item.athleteId)) {
          continue;
        }
        await tx.competitionResult.update({
          where: { id: item.id },
          data: { place: places.get(item.athleteId) ?? scores.size + 1 },
        });
      }
      if (competition.protocol?.status === "PUBLISHED") {
        await tx.competitionResult.updateMany({
          where: { competitionId },
          data: { status: "DRAFT" },
        });
        await tx.competitionProtocol.update({
          where: { competitionId },
          data: { status: "DRAFT" },
        });
      }
      return saved;
    });
    await this.audit.log({
      userId: user.id,
      action: "RESULTS_UPSERT",
      entityType: "Competition",
      entityId: competitionId,
      changes: {
        items: items.map(({ athleteId, score }) => ({ athleteId, score })),
      },
    });
    if (competition.protocol?.status === "PUBLISHED") {
      await this.ratings.recalculate(
        competition.season,
        competition.disciplineId,
      );
    }
    return results;
  }

  async publishProtocol(user: AuthUser, competitionId: string) {
    const competition = await this.get(competitionId);
    const count = await this.prisma.competitionResult.count({
      where: { competitionId },
    });
    if (count === 0) {
      throw new BadRequestException(
        "Нельзя опубликовать протокол без результатов",
      );
    }
    const number = `П-${competition.season}-${competitionId.slice(0, 8).toUpperCase()}`;
    const protocol = await this.prisma.$transaction(async (tx) => {
      await tx.competitionResult.updateMany({
        where: { competitionId },
        data: { status: "PUBLISHED" },
      });
      return tx.competitionProtocol.upsert({
        where: { competitionId },
        create: {
          competitionId,
          number,
          status: "PUBLISHED",
          publishedAt: new Date(),
          publishedById: user.id,
        },
        update: {
          status: "PUBLISHED",
          publishedAt: new Date(),
          publishedById: user.id,
        },
      });
    });

    const results = await this.prisma.competitionResult.findMany({
      where: { competitionId },
      include: { athlete: true },
    });
    await Promise.all(
      results
        .filter((item) => item.athlete.userId)
        .map((item) =>
          this.notifications.notify({
            userId: item.athlete.userId as string,
            type: "PROTOCOL_PUBLISHED",
            title: "Опубликован протокол",
            body: `Опубликован протокол соревнования «${competition.name}».`,
          }),
        ),
    );
    await this.ratings.recalculate(
      competition.season,
      competition.disciplineId,
    );
    await this.audit.log({
      userId: user.id,
      action: "PROTOCOL_PUBLISH",
      entityType: "CompetitionProtocol",
      entityId: protocol.id,
    });
    return protocol;
  }

  async assignJudge(
    user: AuthUser,
    competitionId: string,
    judgeId: string,
    position: string,
  ) {
    const duplicate = await this.prisma.judgeAssignment.findFirst({
      where: { competitionId, judgeId, position, endedAt: null },
    });
    if (duplicate) {
      throw new BadRequestException("Судья уже назначен на эту должность");
    }
    const assignment = await this.prisma.judgeAssignment.create({
      data: { competitionId, judgeId, position, assignedById: user.id },
    });
    await this.audit.log({
      userId: user.id,
      action: "JUDGE_ASSIGN",
      entityType: "JudgeAssignment",
      entityId: assignment.id,
    });
    return assignment;
  }

  private async assertCanSubmit(
    user: AuthUser,
    athleteId: string,
    disciplineId: string,
  ) {
    if (user.activeRole === "FEDERATION") {
      return;
    }
    if (user.activeRole === "ATHLETE" && user.athleteId === athleteId) {
      return;
    }
    if (user.activeRole === "COACH" && user.coachId) {
      const link = await this.prisma.coachAthlete.findFirst({
        where: {
          coachId: user.coachId,
          athleteId,
          disciplineId,
          status: "ACTIVE",
        },
      });
      if (link) {
        return;
      }
    }
    throw new ForbiddenException(
      "Нет права подавать заявку за этого спортсмена",
    );
  }
}
