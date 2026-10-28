import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AthleteStatus, RoleCode } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AuthUser } from "../auth/auth.types";
import { ok, paginated } from "../common/http";
import { PaginationQueryDto } from "../common/pagination";
import { AthletesService } from "./athletes.service";

class AthleteQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  q?: string;
  @IsOptional()
  @IsString()
  municipality?: string;
}

class ConsentDto {
  @IsOptional()
  @IsString()
  consentType?: string;
  @IsString()
  version!: string;
  @IsOptional()
  @IsString()
  representativeName?: string;
  @IsOptional()
  @IsString()
  representativeRelation?: string;
}

class AntiDopingDto {
  @IsString() courseName!: string;
  @IsDateString() completedAt!: string;
  @IsOptional() @IsString() certificateNumber?: string;
}

class CreateAthleteDto {
  @IsString()
  lastName!: string;
  @IsString()
  firstName!: string;
  @IsOptional()
  @IsString()
  middleName?: string;
  @IsDateString()
  birthDate!: string;
  @IsString()
  municipality!: string;
  @IsOptional()
  @IsUUID()
  organizationId?: string;
  @Type(() => Number)
  @IsInt()
  startedYear!: number;
  @IsOptional()
  @IsEnum(AthleteStatus)
  status?: AthleteStatus;
  @IsOptional()
  @IsString()
  guardianName?: string;
  @IsOptional()
  @IsString()
  guardianPhone?: string;
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  disciplineIds?: string[];
}

@ApiTags("athletes")
@UseGuards(AuthGuard, RolesGuard)
@Controller("athletes")
export class AthletesController {
  constructor(private readonly athletes: AthletesService) {}

  @Roles(RoleCode.FEDERATION, RoleCode.MINISTRY)
  @Get()
  async list(@Query() query: AthleteQueryDto) {
    const result = await this.athletes.list(query);
    return paginated(result.items, result.total, query.page, query.pageSize);
  }

  @Get("me")
  async me(@CurrentUser() user: AuthUser) {
    if (!user.athleteId) {
      return ok(null);
    }
    const athlete = await this.athletes.get(user.athleteId);
    return ok({
      ...athlete,
      currentRank: this.athletes.currentRank(athlete.ranks),
    });
  }

  @Roles(RoleCode.FEDERATION, RoleCode.COACH, RoleCode.MINISTRY)
  @Get("directory")
  async directory(@Query("q") q?: string) {
    return ok(await this.athletes.directory(q));
  }

  @Get(":id")
  async get(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    await this.athletes.assertCoachAccess(user, id);
    const athlete = await this.athletes.get(id);
    return ok({
      ...athlete,
      currentRank: this.athletes.currentRank(athlete.ranks),
    });
  }

  @Post(":id/consents")
  async consent(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ConsentDto,
  ) {
    return ok(await this.athletes.addConsent(user, id, dto));
  }

  @Roles(RoleCode.ATHLETE, RoleCode.FEDERATION)
  @Post(":id/anti-doping")
  async antiDoping(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: AntiDopingDto,
  ) {
    return ok(await this.athletes.addAntiDoping(user, id, dto));
  }

  @Roles(RoleCode.FEDERATION)
  @Post()
  async create(@Body() dto: CreateAthleteDto) {
    return ok(await this.athletes.create(dto));
  }
}
