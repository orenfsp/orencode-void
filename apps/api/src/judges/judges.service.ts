import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuthUser } from "../auth/auth.types";
import { AuditService } from "../common/audit.service";
import { NotificationsService } from "../common/notifications.service";
import { PrismaService } from "../common/prisma.service";
import { AwardDatesDto, awardDates } from "../common/award";

@Injectable()
export class JudgesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  list() {
    return this.prisma.judge.findMany({
      include: {
        categories: { orderBy: { assignedAt: "desc" } },
        user: { select: { email: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
  }

  async me(user: AuthUser) {
    if (!user.judgeId) {
      throw new ForbiddenException("Профиль судьи не найден");
    }
    return this.prisma.judge.findUnique({
      where: { id: user.judgeId },
      include: {
        categories: { orderBy: { assignedAt: "desc" } },
        categoryApplications: { orderBy: { submittedAt: "desc" } },
        assignments: {
          include: { competition: true },
          orderBy: { assignedAt: "desc" },
        },
      },
    });
  }

  applications() {
    return this.prisma.judgeCategoryApplication.findMany({
      include: { judge: true },
      orderBy: { submittedAt: "desc" },
    });
  }

  async apply(user: AuthUser, requestedCategory: string) {
    if (!user.judgeId) {
      throw new ForbiddenException("Профиль судьи не найден");
    }
    const pending = await this.prisma.judgeCategoryApplication.findFirst({
      where: { judgeId: user.judgeId, status: "PENDING" },
    });
    if (pending) {
      throw new BadRequestException(
        "Заявка на судейскую категорию уже на рассмотрении",
      );
    }
    const application = await this.prisma.judgeCategoryApplication.create({
      data: {
        judgeId: user.judgeId,
        submittedById: user.id,
        requestedCategory,
      },
    });
    const federation = await this.prisma.userRole.findMany({
      where: { role: { code: "FEDERATION" } },
      select: { userId: true },
    });
    await Promise.all(
      federation.map((item) =>
        this.notifications.notify({
          userId: item.userId,
          type: "JUDGE_CATEGORY_APPLICATION",
          title: "Заявка на судейскую категорию",
          body: `Подана заявка на категорию «${requestedCategory}».`,
        }),
      ),
    );
    return application;
  }

  async review(
    user: AuthUser,
    id: string,
    approve: boolean,
    comment?: string,
    award?: AwardDatesDto,
  ) {
    const dates = approve ? awardDates(award) : null;
    if (!approve && !comment?.trim())
      throw new BadRequestException("Укажите причину отклонения");
    const application = await this.prisma.judgeCategoryApplication.findUnique({
      where: { id },
    });
    if (!application) {
      throw new NotFoundException("Заявка не найдена");
    }
    if (application.status !== "PENDING") {
      throw new BadRequestException("Заявка уже рассмотрена");
    }
    const status = approve ? "APPROVED" : "REJECTED";
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.judgeCategoryApplication.update({
        where: { id, status: "PENDING" },
        data: {
          status,
          comment,
          reviewedById: user.id,
          reviewedAt: new Date(),
        },
      });
      if (dates) {
        await tx.judgeCategory.create({
          data: {
            judgeId: application.judgeId,
            categoryCode: application.requestedCategory,
            ...dates,
            assignedById: user.id,
          },
        });
      }
      return updated;
    });
    await this.audit.log({
      userId: user.id,
      action: approve ? "JUDGE_CATEGORY_APPROVE" : "JUDGE_CATEGORY_REJECT",
      entityType: "JudgeCategoryApplication",
      entityId: id,
    });
    return result;
  }
}
