import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { OrganizationStatus, OrganizationType, RoleCode } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { AuthGuard } from "../auth/auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ok } from "../common/http";
import { PrismaService } from "../common/prisma.service";

class CreateOrganizationDto {
  @IsString()
  name!: string;
  @IsEnum(OrganizationType)
  type!: OrganizationType;
  @IsString()
  municipality!: string;
  @IsOptional()
  @IsString()
  address?: string;
  @IsOptional()
  @IsString()
  phone?: string;
  @IsOptional()
  @IsString()
  email?: string;
}

class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  name?: string;
  @IsOptional()
  @IsEnum(OrganizationType)
  type?: OrganizationType;
  @IsOptional()
  @IsString()
  municipality?: string;
  @IsOptional()
  @IsString()
  address?: string;
  @IsOptional()
  @IsString()
  phone?: string;
  @IsOptional()
  @IsString()
  email?: string;
  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;
}

class CreateDisciplineDto {
  @IsString()
  code!: string;
  @IsString()
  name!: string;
  @IsOptional()
  @IsString()
  description?: string;
}

class CreateAgeGroupDto {
  @IsString()
  code!: string;
  @IsString()
  name!: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  minAge?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  maxAge?: number;
}

class CreateCompetitionTypeDto {
  @IsString()
  code!: string;
  @IsString()
  name!: string;
}

class UpdateDisciplineDto {
  @IsOptional()
  @IsString()
  name?: string;
  @IsOptional()
  @IsString()
  description?: string;
}

class UpdateAgeGroupDto {
  @IsOptional()
  @IsString()
  name?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  minAge?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  maxAge?: number;
}

class UpdateCompetitionTypeDto {
  @IsOptional()
  @IsString()
  name?: string;
}

@ApiTags("catalogs")
@Controller()
export class CatalogsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("disciplines")
  async disciplines() {
    return ok(
      await this.prisma.discipline.findMany({ orderBy: { name: "asc" } }),
    );
  }

  @Get("age-groups")
  async ageGroups() {
    return ok(
      await this.prisma.ageGroup.findMany({ orderBy: { name: "asc" } }),
    );
  }

  @Get("competition-types")
  async competitionTypes() {
    return ok(
      await this.prisma.competitionType.findMany({ orderBy: { name: "asc" } }),
    );
  }

  @Get("organizations")
  async organizations(@Query("q") q?: string) {
    return ok(
      await this.prisma.organization.findMany({
        where: {
          status: OrganizationStatus.ACTIVE,
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: "insensitive" } },
                  { municipality: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: { name: "asc" },
      }),
    );
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RoleCode.FEDERATION)
  @Post("organizations")
  async createOrganization(@Body() dto: CreateOrganizationDto) {
    return ok(await this.prisma.organization.create({ data: dto }));
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RoleCode.FEDERATION)
  @Patch("organizations/:id")
  async updateOrganization(
    @Param("id") id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return ok(
      await this.prisma.organization.update({ where: { id }, data: dto }),
    );
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RoleCode.FEDERATION)
  @Post("disciplines")
  async createDiscipline(@Body() dto: CreateDisciplineDto) {
    return ok(await this.prisma.discipline.create({ data: dto }));
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RoleCode.FEDERATION)
  @Patch("disciplines/:id")
  async updateDiscipline(
    @Param("id") id: string,
    @Body() dto: UpdateDisciplineDto,
  ) {
    return ok(
      await this.prisma.discipline.update({ where: { id }, data: dto }),
    );
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RoleCode.FEDERATION)
  @Post("age-groups")
  async createAgeGroup(@Body() dto: CreateAgeGroupDto) {
    return ok(await this.prisma.ageGroup.create({ data: dto }));
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RoleCode.FEDERATION)
  @Patch("age-groups/:id")
  async updateAgeGroup(
    @Param("id") id: string,
    @Body() dto: UpdateAgeGroupDto,
  ) {
    return ok(await this.prisma.ageGroup.update({ where: { id }, data: dto }));
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RoleCode.FEDERATION)
  @Post("competition-types")
  async createCompetitionType(@Body() dto: CreateCompetitionTypeDto) {
    return ok(await this.prisma.competitionType.create({ data: dto }));
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RoleCode.FEDERATION)
  @Patch("competition-types/:id")
  async updateCompetitionType(
    @Param("id") id: string,
    @Body() dto: UpdateCompetitionTypeDto,
  ) {
    return ok(
      await this.prisma.competitionType.update({ where: { id }, data: dto }),
    );
  }
}
