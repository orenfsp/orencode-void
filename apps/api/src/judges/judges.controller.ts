import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@prisma/client";
import { IsBoolean, IsOptional, IsString } from "class-validator";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AuthUser } from "../auth/auth.types";
import { ok } from "../common/http";
import { JudgesService } from "./judges.service";
import { AwardDatesDto } from "../common/award";

class ApplyDto {
  @IsString()
  requestedCategory!: string;
}

class ReviewDto extends AwardDatesDto {
  @IsBoolean()
  approve!: boolean;
  @IsOptional()
  @IsString()
  comment?: string;
}

@ApiTags("judges")
@UseGuards(AuthGuard, RolesGuard)
@Controller()
export class JudgesController {
  constructor(private readonly judges: JudgesService) {}

  @Roles(RoleCode.FEDERATION, RoleCode.MINISTRY)
  @Get("judges")
  async list() {
    return ok(await this.judges.list());
  }

  @Roles(RoleCode.JUDGE)
  @Get("judges/me")
  async me(@CurrentUser() user: AuthUser) {
    return ok(await this.judges.me(user));
  }

  @Roles(RoleCode.JUDGE)
  @Post("judge-category-applications")
  async apply(@CurrentUser() user: AuthUser, @Body() dto: ApplyDto) {
    return ok(await this.judges.apply(user, dto.requestedCategory));
  }

  @Roles(RoleCode.FEDERATION)
  @Get("judge-category-applications")
  async applications() {
    return ok(await this.judges.applications());
  }

  @Roles(RoleCode.FEDERATION)
  @Post("judge-category-applications/:id/review")
  async review(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: ReviewDto,
  ) {
    return ok(
      await this.judges.review(user, id, dto.approve, dto.comment, dto),
    );
  }
}
