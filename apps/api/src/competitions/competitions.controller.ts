import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  ApplicationStatus,
  CalendarPlanType,
  CompetitionFormat,
  CompetitionLevel,
  Prisma,
  RatingBand,
  RoleCode,
} from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  MinLength,
  Min,
  Max,
  IsUrl,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from "class-validator";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AuthUser } from "../auth/auth.types";
import { ok, paginated } from "../common/http";
import { PaginationQueryDto } from "../common/pagination";
import { CompetitionsService } from "./competitions.service";

class CompetitionQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  disciplineId?: string;
  @IsOptional()
  @IsString()
  q?: string;
}

class CreateCompetitionDto {
  @IsString()
  @MinLength(3)
  name!: string;
  @IsUUID()
  disciplineId!: string;
  @IsUUID()
  typeId!: string;
  @IsEnum(CompetitionLevel)
  level!: CompetitionLevel;
  @IsEnum(CompetitionFormat)
  format!: CompetitionFormat;
  @IsUUID()
  ageGroupId!: string;
  @IsDateString()
  startsAt!: string;
  @IsDateString()
  endsAt!: string;
  @IsString()
  @MinLength(1)
  venue!: string;
  @IsOptional()
  @IsString()
  description?: string;
  @IsOptional()
  @IsUrl({ protocols: ["http", "https"], require_protocol: true })
  regulationUrl?: string;
  @IsDateString()
  applicationsOpenAt!: string;
  @IsDateString()
  applicationsCloseAt!: string;
  @IsEnum(CalendarPlanType)
  calendarPlanType!: CalendarPlanType;
  @IsOptional()
  @IsString()
  calendarPlanNumber?: string;
  @IsEnum(RatingBand)
  ratingBand!: RatingBand;
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  season!: number;
}

class UpdateCompetitionDto extends CreateCompetitionDto {
  @IsDateString()
  updatedAt!: string;
}

class ApplyDto {
  @IsUUID()
  athleteId!: string;
}

class ReviewDto {
  @IsEnum(ApplicationStatus)
  status!: ApplicationStatus;
  @IsOptional()
  @IsString()
  reason?: string;
}

class ResultItemDto {
  @IsUUID()
  athleteId!: string;
  @Type(() => Number)
  @IsNumber()
  score!: number;
  @IsOptional()
  @IsObject()
  extraMetrics?: Record<string, unknown>;
}

class ResultsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ResultItemDto)
  items!: ResultItemDto[];
}

class AssignJudgeDto {
  @IsUUID()
  judgeId!: string;
  @IsString()
  position!: string;
}

@ApiTags("competitions")
@Controller("competitions")
export class CompetitionsController {
  constructor(private readonly competitions: CompetitionsService) {}

  @Get("public")
  async publicList(@Query() query: CompetitionQueryDto) {
    const result = await this.competitions.list({ ...query, publicOnly: true });
    return paginated(result.items, result.total, query.page, query.pageSize);
  }

  @Get("public/:id")
  async publicGet(@Param("id") id: string) {
    const competition = await this.competitions.get(id, true);
    return ok({
      id: competition.id,
      name: competition.name,
      description: competition.description,
      discipline: competition.discipline,
      type: competition.type,
      ageGroup: competition.ageGroup,
      level: competition.level,
      format: competition.format,
      startsAt: competition.startsAt,
      endsAt: competition.endsAt,
      venue: competition.venue,
      regulationUrl: competition.regulationUrl,
      applicationsOpenAt: competition.applicationsOpenAt,
      applicationsCloseAt: competition.applicationsCloseAt,
      results: competition.results
        .filter((item) => item.status === "PUBLISHED")
        .map((item) => ({
          id: item.id,
          place: item.place,
          score: item.score,
          participant: `Участник ${item.athleteId.slice(0, 8).toUpperCase()}`,
        })),
      protocol:
        competition.protocol?.status === "PUBLISHED"
          ? { number: competition.protocol.number }
          : null,
    });
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query() query: CompetitionQueryDto,
  ) {
    const result = await this.competitions.list({ ...query, user });
    return paginated(result.items, result.total, query.page, query.pageSize);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Get(":id")
  async get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return ok(await this.competitions.getScoped(user, id));
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RoleCode.FEDERATION)
  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCompetitionDto,
  ) {
    return ok(await this.competitions.create(user, dto));
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RoleCode.FEDERATION)
  @Put(":id")
  async update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateCompetitionDto,
  ) {
    return ok(await this.competitions.update(user, id, dto));
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RoleCode.FEDERATION)
  @Post(":id/publish")
  async publish(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return ok(await this.competitions.publish(user, id));
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Post(":id/applications")
  async apply(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: ApplyDto,
  ) {
    return ok(await this.competitions.apply(user, id, dto.athleteId));
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Post("applications/:applicationId/review")
  async review(
    @CurrentUser() user: AuthUser,
    @Param("applicationId") applicationId: string,
    @Body() dto: ReviewDto,
  ) {
    return ok(
      await this.competitions.reviewApplication(
        user,
        applicationId,
        dto.status,
        dto.reason,
      ),
    );
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RoleCode.FEDERATION)
  @Post(":id/results")
  async results(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: ResultsDto,
  ) {
    return ok(
      await this.competitions.upsertResults(
        user,
        id,
        dto.items.map((item) => ({
          athleteId: item.athleteId,
          score: item.score,
          extraMetrics: item.extraMetrics as Prisma.InputJsonValue | undefined,
        })),
      ),
    );
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RoleCode.FEDERATION)
  @Post(":id/protocol")
  async protocol(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return ok(await this.competitions.publishProtocol(user, id));
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RoleCode.FEDERATION)
  @Post(":id/judges")
  async assign(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: AssignJudgeDto,
  ) {
    return ok(
      await this.competitions.assignJudge(user, id, dto.judgeId, dto.position),
    );
  }
}
