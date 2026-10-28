import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CoachAthleteStatus, RoleCode } from "@prisma/client";
import { IsEnum, IsUUID } from "class-validator";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AuthUser } from "../auth/auth.types";
import { ok } from "../common/http";
import { CoachesService } from "./coaches.service";

class LinkDto {
  @IsUUID()
  athleteId!: string;
  @IsUUID()
  disciplineId!: string;
}

class RespondDto {
  @IsEnum(CoachAthleteStatus)
  status!: CoachAthleteStatus;
}

@ApiTags("coaches")
@UseGuards(AuthGuard, RolesGuard)
@Controller("coaches")
export class CoachesController {
  constructor(private readonly coaches: CoachesService) {}

  @Roles(RoleCode.FEDERATION, RoleCode.MINISTRY)
  @Get()
  async list() {
    return ok(await this.coaches.list());
  }

  @Roles(RoleCode.COACH)
  @Get("me/athletes")
  async myAthletes(@CurrentUser() user: AuthUser) {
    return ok(await this.coaches.myAthletes(user));
  }

  @Roles(RoleCode.COACH)
  @Post("links")
  async request(@CurrentUser() user: AuthUser, @Body() dto: LinkDto) {
    return ok(
      await this.coaches.requestLink(user, dto.athleteId, dto.disciplineId),
    );
  }

  @Patch("links/:id")
  async respond(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: RespondDto,
  ) {
    return ok(await this.coaches.respondLink(user, id, dto.status));
  }
}
