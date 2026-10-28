import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@prisma/client";
import { IsBoolean, IsOptional, IsString, IsUUID } from "class-validator";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AuthUser } from "../auth/auth.types";
import { ok } from "../common/http";
import { RanksService } from "./ranks.service";
import { AwardDatesDto } from "../common/award";

class ApplyDto {
  @IsUUID()
  athleteId!: string;
  @IsString()
  rankType!: string;
  @IsOptional()
  @IsUUID()
  competitionId?: string;
  @IsOptional()
  @IsUUID()
  resultId?: string;
}

class ReviewDto extends AwardDatesDto {
  @IsBoolean()
  approve!: boolean;
  @IsOptional()
  @IsString()
  comment?: string;
}

@ApiTags("ranks")
@UseGuards(AuthGuard, RolesGuard)
@Controller()
export class RanksController {
  constructor(private readonly ranks: RanksService) {}

  @Get("rank-applications")
  async list(@CurrentUser() user: AuthUser) {
    return ok(await this.ranks.listApplications(user));
  }

  @Get("rank-requirements")
  async requirements() {
    return ok(await this.ranks.requirements());
  }

  @Roles(RoleCode.FEDERATION)
  @Get("ranks/expiring")
  async expiring() {
    return ok(await this.ranks.expiring());
  }

  @Post("rank-applications")
  async apply(@CurrentUser() user: AuthUser, @Body() dto: ApplyDto) {
    return ok(
      await this.ranks.apply(
        user,
        dto.athleteId,
        dto.rankType,
        dto.competitionId,
        dto.resultId,
      ),
    );
  }

  @Roles(RoleCode.FEDERATION)
  @Post("rank-applications/:id/review")
  async review(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: ReviewDto,
  ) {
    return ok(await this.ranks.review(user, id, dto.approve, dto.comment, dto));
  }
}
