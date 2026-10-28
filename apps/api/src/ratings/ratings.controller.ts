import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RatingBand, RoleCode } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AuthUser } from "../auth/auth.types";
import { ok } from "../common/http";
import { RatingsService } from "./ratings.service";

class ListDto {
  @Type(() => Number)
  @IsInt()
  season!: number;
  @IsOptional()
  @IsUUID()
  disciplineId?: string;
  @IsOptional()
  @IsUUID()
  ageGroupId?: string;
  @IsOptional()
  @IsString()
  minRank?: string;
}

class RecalcDto {
  @Type(() => Number)
  @IsInt()
  season!: number;
  @IsOptional()
  @IsUUID()
  disciplineId?: string;
}

class RuleDto {
  @Type(() => Number)
  @IsInt()
  season!: number;
  @IsEnum(RatingBand)
  band!: RatingBand;
  @Type(() => Number)
  @IsInt()
  @Min(1)
  place!: number;
  @Type(() => Number)
  @IsInt()
  @Min(0)
  points!: number;
}

@ApiTags("ratings")
@UseGuards(AuthGuard, RolesGuard)
@Controller("ratings")
export class RatingsController {
  constructor(private readonly ratings: RatingsService) {}

  @Get()
  async list(@Query() query: ListDto) {
    return ok(
      await this.ratings.list(
        query.season,
        query.disciplineId,
        query.ageGroupId,
        query.minRank,
      ),
    );
  }

  @Get("rules")
  async rules(@Query("season") season: string) {
    return ok(await this.ratings.rules(Number(season)));
  }

  @Get("me")
  async me(@CurrentUser() user: AuthUser, @Query("season") season: string) {
    if (!user.athleteId) {
      return ok([]);
    }
    const items = await this.ratings.list(Number(season));
    return ok(items.filter((item) => item.athleteId === user.athleteId));
  }

  @Roles(RoleCode.FEDERATION)
  @Post("recalculate")
  async recalc(@Body() dto: RecalcDto) {
    await this.ratings.recalculate(dto.season, dto.disciplineId);
    return ok({ recalculated: true });
  }

  @Roles(RoleCode.FEDERATION)
  @Post("rules")
  async rule(@Body() dto: RuleDto) {
    const rule = await this.ratings.updateRule(
      dto.season,
      dto.band,
      dto.place,
      dto.points,
    );
    await this.ratings.recalculate(dto.season);
    return ok(rule);
  }
}
