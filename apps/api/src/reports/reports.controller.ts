import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ok } from "../common/http";
import { ReportsService } from "./reports.service";

@ApiTags("reports")
@UseGuards(AuthGuard, RolesGuard)
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Roles(RoleCode.FEDERATION, RoleCode.MINISTRY)
  @Get("reports/headcount")
  async headcount() {
    return ok(await this.reports.headcount());
  }

  @Roles(RoleCode.FEDERATION, RoleCode.MINISTRY)
  @Get("reports/dashboard")
  async dashboard() {
    return ok(await this.reports.dashboard());
  }

  @Roles(RoleCode.FEDERATION, RoleCode.MINISTRY)
  @Get("reports/development")
  async development() {
    return ok(await this.reports.headcount());
  }
}
