import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Prisma, RoleCode } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AuthUser } from "../auth/auth.types";
import { DeadlineService } from "../common/deadline.service";
import { ok, paginated } from "../common/http";
import { NotificationsService } from "../common/notifications.service";
import { PaginationQueryDto } from "../common/pagination";
import { PrismaService } from "../common/prisma.service";

@ApiTags("misc")
@UseGuards(AuthGuard, RolesGuard)
@Controller()
export class MiscController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly deadlines: DeadlineService,
  ) {}

  @Patch("notifications/:id/read")
  async read(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    await this.notifications.markRead(user.id, id);
    return ok({ read: true });
  }

  @Patch("notifications/read-all")
  async readAll(@CurrentUser() user: AuthUser) {
    await this.notifications.markAllRead(user.id);
    return ok({ read: true });
  }

  @Roles(RoleCode.FEDERATION)
  @Post("notifications/run-checks")
  async runChecks() {
    return ok(await this.deadlines.runChecks());
  }

  @Roles(RoleCode.FEDERATION)
  @Get("audit-logs")
  async audit(@Query() query: PaginationQueryDto) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        include: {
          user: { select: { id: true, lastName: true, firstName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.auditLog.count(),
    ]);
    return paginated(items, total, query.page, query.pageSize);
  }

  @Get("applications")
  async applications(@CurrentUser() user: AuthUser) {
    let where: Prisma.CompetitionApplicationWhereInput;
    if (user.activeRole === "FEDERATION" || user.activeRole === "MINISTRY") {
      where = {};
    } else if (user.activeRole === "ATHLETE" && user.athleteId) {
      where = { athleteId: user.athleteId };
    } else if (user.activeRole === "COACH" && user.coachId) {
      where = {
        athlete: {
          coaches: { some: { coachId: user.coachId, status: "ACTIVE" } },
        },
      };
    } else if (user.activeRole === "JUDGE" && user.judgeId) {
      where = {
        competition: { judgeAssignments: { some: { judgeId: user.judgeId } } },
      };
    } else {
      return ok([]);
    }
    return ok(
      await this.prisma.competitionApplication.findMany({
        where,
        include: {
          athlete: true,
          competition: { include: { discipline: true } },
        },
        orderBy: { submittedAt: "desc" },
      }),
    );
  }
}
