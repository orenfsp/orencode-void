import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RoleCode, TeamMemberSource } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID } from "class-validator";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AuthUser } from "../auth/auth.types";
import { ok } from "../common/http";
import { NationalTeamService } from "./national-team.service";

class UpsertDto {
  @Type(() => Number)
  @IsInt()
  season!: number;
  @IsUUID()
  disciplineId!: string;
  @IsUUID()
  ageGroupId!: string;
  @IsString()
  title!: string;
}

class MemberDto {
  @IsUUID()
  athleteId!: string;
  @IsEnum(TeamMemberSource)
  source!: TeamMemberSource;
  @IsOptional()
  @IsString()
  note?: string;
}

@ApiTags("national-team")
@UseGuards(AuthGuard, RolesGuard)
@Roles(RoleCode.FEDERATION, RoleCode.MINISTRY)
@Controller("national-team")
export class NationalTeamController {
  constructor(private readonly teams: NationalTeamService) {}

  @Get()
  async list(@Query("season") season?: string) {
    return ok(await this.teams.list(season ? Number(season) : undefined));
  }

  @Roles(RoleCode.FEDERATION)
  @Post()
  async upsert(@CurrentUser() user: AuthUser, @Body() dto: UpsertDto) {
    return ok(await this.teams.upsert(user, dto));
  }

  @Roles(RoleCode.FEDERATION)
  @Post(":id/members")
  async add(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: MemberDto,
  ) {
    return ok(
      await this.teams.addMember(user, id, dto.athleteId, dto.source, dto.note),
    );
  }

  @Roles(RoleCode.FEDERATION)
  @Delete(":id/members/:athleteId")
  async remove(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("athleteId") athleteId: string,
  ) {
    return ok(await this.teams.removeMember(user, id, athleteId));
  }
}
