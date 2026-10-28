import { Injectable } from "@nestjs/common";
import { meetsMinRank } from "@fsp/shared";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { ageOnDate, computeSeasonRating } from "./rating.engine";

@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

  async recalculate(
    season: number,
    disciplineId?: string,
    transaction?: Prisma.TransactionClient,
  ) {
    const db = transaction ?? this.prisma;
    const disciplines = disciplineId
      ? [{ id: disciplineId }]
      : await db.discipline.findMany({ select: { id: true } });
    const rules = await db.ratingRule.findMany({ where: { season } });
    const now = new Date();

    for (const discipline of disciplines) {
      const results = await db.competitionResult.findMany({
        where: {
          status: "PUBLISHED",
          competition: { season, disciplineId: discipline.id },
        },
        include: {
          competition: true,
          athlete: { include: { disqualifications: true } },
        },
      });
      const byAthlete = new Map<string, typeof results>();
      const excludedIds: string[] = [];
      for (const result of results) {
        const list = byAthlete.get(result.athleteId) ?? [];
        list.push(result);
        byAthlete.set(result.athleteId, list);
      }

      for (const [athleteId, athleteResults] of byAthlete.entries()) {
        const athlete = athleteResults[0].athlete;
        const disqualified =
          athlete.disqualifications.some(
            (item) =>
              item.startsAt <= now && (!item.endsAt || item.endsAt >= now),
          ) ||
          athlete.status === "DISQUALIFIED" ||
          athlete.status === "SUSPENDED";
        const computed = computeSeasonRating(
          athleteResults.map((item) => ({
            competitionId: item.competitionId,
            resultId: item.id,
            place: item.place,
            band: item.competition.ratingBand,
          })),
          rules,
          disqualified,
        );

        const saveRating = async (tx: Prisma.TransactionClient) => {
          await tx.athleteSeasonRating.deleteMany({
            where: { athleteId, disciplineId: discipline.id, season },
          });
          if (computed.excluded) {
            excludedIds.push(athleteId);
            return;
          }
          const rating = await tx.athleteSeasonRating.create({
            data: {
              athleteId,
              disciplineId: discipline.id,
              season,
              totalPoints: new Prisma.Decimal(computed.totalPoints),
              stabilityApplied: computed.stabilityApplied,
              prizeCount: computed.prizeCount,
            },
          });
          if (computed.entries.length) {
            await tx.athleteRatingEntry.createMany({
              data: computed.entries.map((entry) => ({
                seasonRatingId: rating.id,
                competitionId: entry.competitionId,
                resultId: entry.resultId,
                basePoints: entry.basePoints,
                coefficient: new Prisma.Decimal(entry.coefficient),
                finalPoints: new Prisma.Decimal(entry.finalPoints),
              })),
            });
          }
        };
        if (transaction) await saveRating(transaction);
        else await this.prisma.$transaction(saveRating);
      }

      // Если результаты спортсмена исчезли из выборки, старый рейтинг не
      // должен оставаться в таблице как устаревшая запись.
      const keepIds = [...byAthlete.keys()].filter(
        (id) => !excludedIds.includes(id),
      );
      await db.athleteSeasonRating.deleteMany({
        where: {
          disciplineId: discipline.id,
          season,
          athleteId: { notIn: keepIds },
        },
      });
    }
  }

  async list(
    season: number,
    disciplineId?: string,
    ageGroupId?: string,
    minRank?: string,
  ) {
    const ratings = await this.prisma.athleteSeasonRating.findMany({
      where: { season, ...(disciplineId ? { disciplineId } : {}) },
      include: {
        athlete: { include: { ranks: true, disqualifications: true } },
        discipline: true,
        entries: { include: { competition: true, result: true } },
      },
      orderBy: { totalPoints: "desc" },
    });
    const group = ageGroupId
      ? await this.prisma.ageGroup.findUnique({ where: { id: ageGroupId } })
      : null;
    const today = new Date();
    return ratings.filter((item) => {
      if (
        ["DISQUALIFIED", "SUSPENDED"].includes(item.athlete.status) ||
        item.athlete.disqualifications.some(
          (entry) =>
            entry.startsAt <= today && (!entry.endsAt || entry.endsAt >= today),
        )
      )
        return false;
      if (group) {
        const age = ageOnDate(item.athlete.birthDate, today);
        if (
          (group.minAge != null && age < group.minAge) ||
          (group.maxAge != null && age > group.maxAge)
        ) {
          return false;
        }
      }
      if (minRank) {
        const current = item.athlete.ranks
          .filter((rank) => rank.assignedAt <= today && rank.expiresAt >= today)
          .sort((a, b) => b.assignedAt.getTime() - a.assignedAt.getTime())[0];
        if (!meetsMinRank(current?.rankType, minRank)) {
          return false;
        }
      }
      return true;
    });
  }

  rules(season: number) {
    return this.prisma.ratingRule.findMany({
      where: { season },
      orderBy: [{ band: "asc" }, { place: "asc" }],
    });
  }

  async updateRule(
    season: number,
    band: Prisma.RatingRuleCreateInput["band"],
    place: number,
    points: number,
  ) {
    return this.prisma.ratingRule.upsert({
      where: { season_band_place: { season, band, place } },
      create: { season, band, place, points },
      update: { points },
    });
  }
}
