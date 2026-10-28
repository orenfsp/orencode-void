import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { ageOnDate } from "../ratings/rating.engine";

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async headcount() {
    const athletes = await this.prisma.athlete.findMany({
      include: {
        organization: true,
        disciplines: { include: { discipline: true } },
      },
    });
    const byDiscipline = new Map<string, number>();
    const byOrganization = new Map<string, number>();
    const byMunicipality = new Map<string, number>();
    const byAgeGroup = new Map<string, number>();
    const byYearStarted = new Map<number, number>();
    const now = new Date();

    for (const athlete of athletes) {
      for (const link of athlete.disciplines) {
        byDiscipline.set(
          link.discipline.name,
          (byDiscipline.get(link.discipline.name) ?? 0) + 1,
        );
      }
      const org = athlete.organization?.name ?? "Без организации";
      byOrganization.set(org, (byOrganization.get(org) ?? 0) + 1);
      byMunicipality.set(
        athlete.municipality,
        (byMunicipality.get(athlete.municipality) ?? 0) + 1,
      );
      const age = ageOnDate(athlete.birthDate, now);
      const bucket =
        age < 14 ? "до 14" : age < 18 ? "14–17" : age < 21 ? "18–20" : "21+";
      byAgeGroup.set(bucket, (byAgeGroup.get(bucket) ?? 0) + 1);
      byYearStarted.set(
        athlete.startedYear,
        (byYearStarted.get(athlete.startedYear) ?? 0) + 1,
      );
    }

    const organizations = await this.prisma.organization.count({
      where: { status: "ACTIVE" },
    });
    const competitions = await this.prisma.competition.count({
      where: { publicationStatus: "PUBLISHED" },
    });
    const firstYear = Math.min(now.getFullYear() - 1, ...byYearStarted.keys());
    const years = Array.from(
      { length: Math.max(2, now.getFullYear() - firstYear + 1) },
      (_, i) => firstYear + i,
    );
    const dynamics = years.map((year) => ({
      year,
      count: athletes.filter((item) => item.startedYear <= year).length,
    }));

    return {
      demoLabel: "Демонстрационные данные",
      dynamicsLabel:
        "Численность по году начала занятий, накопительно; не исторический срез статусов",
      total: athletes.length,
      organizations,
      officialCompetitions: competitions,
      dynamics,
      byDiscipline: [...byDiscipline.entries()].map(([name, count]) => ({
        name,
        count,
      })),
      byOrganization: [...byOrganization.entries()].map(([name, count]) => ({
        name,
        count,
      })),
      byMunicipality: [...byMunicipality.entries()].map(([name, count]) => ({
        name,
        count,
      })),
      byAgeGroup: [...byAgeGroup.entries()].map(([name, count]) => ({
        name,
        count,
      })),
    };
  }

  async dashboard() {
    const [
      athletes,
      coaches,
      judges,
      organizations,
      upcoming,
      pendingApps,
      pendingRanks,
      pendingCats,
      expiringRanks,
      expiringCategories,
    ] = await Promise.all([
      this.prisma.athlete.count(),
      this.prisma.coach.count(),
      this.prisma.judge.count(),
      this.prisma.organization.count({ where: { status: "ACTIVE" } }),
      this.prisma.competition.findMany({
        where: {
          publicationStatus: "PUBLISHED",
          startsAt: { gte: new Date() },
        },
        include: { discipline: true },
        orderBy: { startsAt: "asc" },
        take: 5,
      }),
      this.prisma.competitionApplication.count({
        where: { status: "PENDING" },
      }),
      this.prisma.rankApplication.count({ where: { status: "PENDING" } }),
      this.prisma.judgeCategoryApplication.count({
        where: { status: "PENDING" },
      }),
      this.prisma.sportsRank.count({
        where: {
          expiresAt: {
            lte: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            gte: new Date(),
          },
        },
      }),
      this.prisma.judgeCategory.count({
        where: {
          expiresAt: {
            lte: new Date(Date.now() + 60 * 86400000),
            gte: new Date(),
          },
        },
      }),
    ]);
    const headcount = await this.headcount();
    return {
      athletes,
      coaches,
      judges,
      organizations,
      upcoming,
      pendingApps,
      pendingRanks,
      pendingCats,
      expiringRanks,
      expiringCategories,
      dynamics: headcount.dynamics,
      demoLabel: headcount.demoLabel,
    };
  }
}
