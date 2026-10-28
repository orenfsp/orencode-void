import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuthUser } from "../auth/auth.types";
import { AuditService } from "../common/audit.service";
import { NotificationsService } from "../common/notifications.service";
import { PrismaService } from "../common/prisma.service";
import { AwardDatesDto, awardDates } from "../common/award";

@Injectable()
export class RanksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async listApplications(user: AuthUser) {
    let where: Prisma.RankApplicationWhereInput;
    if (user.activeRole === "FEDERATION" || user.activeRole === "MINISTRY") {
      where = {};
    } else if (user.activeRole === "ATHLETE" && user.athleteId) {
      where = { athleteId: user.athleteId };
    } else if (user.activeRole === "COACH" && user.coachId) {
      where = {
        athlete: {
          coaches: { some: { coachId: user.coachId, status: "ACTIVE" } },
        },
      };
    } else {
      return [];
    }
    return this.prisma.rankApplication.findMany({
      where,
      include: { athlete: true, competition: true, result: true },
      orderBy: { submittedAt: "desc" },
    });
  }

  requirements() {
    return this.prisma.rankRequirement.findMany({
      orderBy: { rankType: "asc" },
    });
  }

  expiring(days = 60) {
    const until = new Date();
    until.setDate(until.getDate() + days);
    return this.prisma.sportsRank.findMany({
      where: { expiresAt: { lte: until, gte: new Date() } },
      include: { athlete: true },
      orderBy: { expiresAt: "asc" },
    });
  }

  async apply(
    user: AuthUser,
    athleteId: string,
    rankType: string,
    competitionId?: string,
    resultId?: string,
  ) {
    if (!["ATHLETE", "COACH", "FEDERATION"].includes(user.activeRole)) {
      throw new ForbiddenException("Роль не может подавать заявку на разряд");
    }
    if (user.activeRole === "ATHLETE" && user.athleteId !== athleteId) {
      throw new ForbiddenException("Можно подавать заявку только за себя");
    }
    if (user.activeRole === "COACH") {
      if (!user.coachId) {
        throw new ForbiddenException("Профиль тренера не найден");
      }
      const link = await this.prisma.coachAthlete.findFirst({
        where: { coachId: user.coachId, athleteId, status: "ACTIVE" },
      });
      if (!link) {
        throw new ForbiddenException("Нет подтверждённой связи со спортсменом");
      }
    }
    if (resultId) {
      const result = await this.prisma.competitionResult.findUnique({
        where: { id: resultId },
      });
      if (
        !result ||
        result.athleteId !== athleteId ||
        result.status !== "PUBLISHED" ||
        (competitionId && result.competitionId !== competitionId)
      ) {
        throw new BadRequestException("Результат не принадлежит спортсмену");
      }
    }
    const pending = await this.prisma.rankApplication.findFirst({
      where: { athleteId, rankType, status: "PENDING" },
    });
    if (pending) {
      throw new BadRequestException(
        "Заявка на этот разряд уже на рассмотрении",
      );
    }
    const application = await this.prisma.rankApplication.create({
      data: {
        athleteId,
        submittedById: user.id,
        rankType,
        competitionId,
        resultId,
      },
    });
    const federation = await this.prisma.userRole.findMany({
      where: { role: { code: "FEDERATION" } },
      select: { userId: true },
    });
    await Promise.all(
      federation.map((item) =>
        this.notifications.notify({
          userId: item.userId,
          type: "RANK_APPLICATION",
          title: "Заявка на спортивный разряд",
          body: `Подана заявка на разряд «${rankType}».`,
        }),
      ),
    );
    return application;
  }

  async review(
    user: AuthUser,
    id: string,
    approve: boolean,
    comment?: string,
    award?: AwardDatesDto,
  ) {
    const dates = approve ? awardDates(award) : null;
    if (!approve && !comment?.trim())
      throw new BadRequestException("Укажите причину отклонения");
    const application = await this.prisma.rankApplication.findUnique({
      where: { id },
    });
    if (!application) {
      throw new NotFoundException("Заявка не найдена");
    }
    if (application.status !== "PENDING") {
      throw new BadRequestException("Заявка уже рассмотрена");
    }
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.rankApplication.update({
        where: { id, status: "PENDING" },
        data: {
          status: approve ? "APPROVED" : "REJECTED",
          comment,
          reviewedById: user.id,
          reviewedAt: new Date(),
        },
      });
      if (dates) {
        await tx.sportsRank.create({
          data: {
            athleteId: application.athleteId,
            rankType: application.rankType,
            ...dates,
            competitionId: application.competitionId,
            resultId: application.resultId,
            assignedById: user.id,
          },
        });
      }
      return updated;
    });
    await this.audit.log({
      userId: user.id,
      action: approve ? "RANK_APPROVE" : "RANK_REJECT",
      entityType: "RankApplication",
      entityId: id,
    });
    return result;
  }
}
