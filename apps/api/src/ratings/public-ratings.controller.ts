import { Controller, Get, Query } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";
import { ok } from "../common/http";
import { RatingsService } from "./ratings.service";

class PublicRatingQuery {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  season = new Date().getFullYear();
  @IsOptional() @IsUUID() disciplineId?: string;
}

@Controller("public/ratings")
export class PublicRatingsController {
  constructor(private readonly ratings: RatingsService) {}
  @Get()
  async list(@Query() query: PublicRatingQuery) {
    const rows = await this.ratings.list(query.season, query.disciplineId);
    return ok(
      rows.map((row) => ({
        id: row.id,
        participant: `Участник ${row.athleteId.slice(0, 8).toUpperCase()}`,
        discipline: row.discipline,
        totalPoints: row.totalPoints,
        prizeCount: row.prizeCount,
        stabilityApplied: row.stabilityApplied,
      })),
    );
  }
}
