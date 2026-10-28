import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { TeamMemberSource } from "@prisma/client";
import { AuthUser } from "../auth/auth.types";
import { AuditService } from "../common/audit.service";
import { PrismaService } from "../common/prisma.service";
import { ageOnDate } from "../ratings/rating.engine";

@Injectable()
export class NationalTeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(season?: number) {
    return this.prisma.nationalTeam.findMany({
      where: season ? { season } : undefined,
      include: {
        discipline: true,
        ageGroup: true,
        members: { include: { athlete: true } },
        history: { orderBy: { createdAt: "desc" }, take: 50 },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async upsert(
    user: AuthUser,
    data: {
      season: number;
      disciplineId: string;
      ageGroupId: string;
      title: string;
    },
  ) {
    const team = await this.prisma.nationalTeam.upsert({
      where: {
        season_disciplineId_ageGroupId: {
          season: data.season,
          disciplineId: data.disciplineId,
          ageGroupId: data.ageGroupId,
        },
      },
      create: { ...data, createdById: user.id },
      update: { title: data.title },
    });
    await this.audit.log({
      userId: user.id,
      action: "NATIONAL_TEAM_UPSERT",
      entityType: "NationalTeam",
      entityId: team.id,
    });
    return team;
  }

  async addMember(
    user: AuthUser,
    teamId: string,
    athleteId: string,
    source: TeamMemberSource,
    note?: string,
  ) {
    const [team, athlete] = await Promise.all([
      this.prisma.nationalTeam.findUnique({
        where: { id: teamId },
        include: { ageGroup: true },
      }),
      this.prisma.athlete.findUnique({
        where: { id: athleteId },
        include: { disciplines: true, disqualifications: true },
      }),
    ]);
    if (!team || !athlete)
      throw new NotFoundException("Сборная или спортсмен не найдены");
    const now = new Date();
    const age = ageOnDate(
      athlete.birthDate,
      new Date(`${team.season}-12-31T12:00:00Z`),
    );
    if (
      athlete.status !== "ACTIVE" ||
      athlete.disqualifications.some(
        (d) => d.startsAt <= now && (!d.endsAt || d.endsAt >= now),
      )
    )
      throw new BadRequestException("Спортсмен отстранён или неактивен");
    if (!athlete.disciplines.some((d) => d.disciplineId === team.disciplineId))
      throw new BadRequestException(
        "Дисциплина спортсмена не соответствует сборной",
      );
    if (
      (team.ageGroup.minAge != null && age < team.ageGroup.minAge) ||
      (team.ageGroup.maxAge != null && age > team.ageGroup.maxAge)
    )
      throw new BadRequestException(
        "Возраст на конец сезона не соответствует группе сборной",
      );
    if (
      source === "RATING" &&
      !(await this.prisma.athleteSeasonRating.findUnique({
        where: {
          athleteId_disciplineId_season: {
            athleteId,
            disciplineId: team.disciplineId,
            season: team.season,
          },
        },
      }))
    )
      throw new BadRequestException(
        "У спортсмена нет рейтинга по этой дисциплине за сезон",
      );
    const member = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.nationalTeamMember.upsert({
        where: { teamId_athleteId: { teamId, athleteId } },
        create: { teamId, athleteId, source, note },
        update: { source, note },
      });
      await tx.nationalTeamMemberHistory.create({
        data: {
          teamId,
          athleteId,
          action: "ADD",
          userId: user.id,
          payload: { source, note },
        },
      });
      return saved;
    });
    await this.audit.log({
      userId: user.id,
      action: "NATIONAL_TEAM_ADD_MEMBER",
      entityType: "NationalTeam",
      entityId: teamId,
      changes: { athleteId, source },
    });
    return member;
  }

  async removeMember(user: AuthUser, teamId: string, athleteId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.nationalTeamMember.delete({
        where: { teamId_athleteId: { teamId, athleteId } },
      });
      await tx.nationalTeamMemberHistory.create({
        data: { teamId, athleteId, action: "REMOVE", userId: user.id },
      });
    });
    await this.audit.log({
      userId: user.id,
      action: "NATIONAL_TEAM_REMOVE_MEMBER",
      entityType: "NationalTeam",
      entityId: teamId,
      changes: { athleteId },
    });
    return { removed: true };
  }
}
