import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { NotificationsService } from "./notifications.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;

/**
 * Контроль сроков: напоминания о закрытии приёма заявок и об истечении
 * спортивных разрядов / судейских категорий. Проверки идемпотентны в рамках
 * одного дня и не блокируют основной бизнес-процесс.
 */
@Injectable()
export class DeadlineService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeadlineService.name);
  private timer?: NodeJS.Timeout;
  private startupTimer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    this.startupTimer = setTimeout(() => void this.runChecks(), 4000);
    this.startupTimer.unref?.();
    this.timer = setInterval(() => void this.runChecks(), CHECK_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    if (this.startupTimer) {
      clearTimeout(this.startupTimer);
    }
  }

  async runChecks() {
    if (this.running) {
      return { skipped: true };
    }
    this.running = true;
    const result = { applications: 0, ranks: 0, judgeCategories: 0 };
    try {
      const now = new Date();
      const inThreeDays = new Date(now.getTime() + 3 * DAY_MS);
      const inThirtyDays = new Date(now.getTime() + 30 * DAY_MS);

      const closing = await this.prisma.competition.findMany({
        where: {
          publicationStatus: "PUBLISHED",
          applicationsCloseAt: { gte: now, lte: inThreeDays },
        },
        include: {
          discipline: {
            include: { athleteLinks: { include: { athlete: true } } },
          },
          applications: {
            where: { status: { in: ["PENDING", "APPROVED"] } },
            select: { athleteId: true },
          },
        },
      });

      for (const competition of closing) {
        const applied = new Set(
          competition.applications.map((item) => item.athleteId),
        );
        for (const link of competition.discipline.athleteLinks) {
          const athlete = link.athlete;
          if (
            !athlete.userId ||
            applied.has(athlete.id) ||
            athlete.status !== "ACTIVE"
          ) {
            continue;
          }
          const key = `competition:${competition.id}`;
          if (
            await this.notifiedToday(
              athlete.userId,
              "APPLICATIONS_CLOSING",
              key,
            )
          ) {
            continue;
          }
          await this.notifications.notify({
            userId: athlete.userId,
            type: "APPLICATIONS_CLOSING",
            title: "Скоро заканчивается приём заявок",
            body: `Приём заявок на «${competition.name}» завершится ${competition.applicationsCloseAt.toLocaleDateString("ru-RU")}.`,
            payload: { key, competitionId: competition.id },
          });
          result.applications += 1;
        }
      }

      const expiringRanks = await this.prisma.sportsRank.findMany({
        where: { expiresAt: { gte: now, lte: inThirtyDays } },
        include: { athlete: true },
      });
      for (const rank of expiringRanks) {
        if (!rank.athlete.userId) {
          continue;
        }
        const key = `rank:${rank.id}`;
        if (
          await this.notifiedToday(rank.athlete.userId, "RANK_EXPIRING", key)
        ) {
          continue;
        }
        await this.notifications.notify({
          userId: rank.athlete.userId,
          type: "RANK_EXPIRING",
          title: "Скоро истекает спортивный разряд",
          body: `Разряд «${rank.rankType}» действует до ${rank.expiresAt.toLocaleDateString("ru-RU")}.`,
          payload: { key, rankId: rank.id },
        });
        result.ranks += 1;
      }

      const expiringCategories = await this.prisma.judgeCategory.findMany({
        where: { expiresAt: { gte: now, lte: inThirtyDays } },
        include: { judge: true },
      });
      for (const category of expiringCategories) {
        const key = `judge-category:${category.id}`;
        if (
          await this.notifiedToday(
            category.judge.userId,
            "JUDGE_CATEGORY_EXPIRING",
            key,
          )
        ) {
          continue;
        }
        await this.notifications.notify({
          userId: category.judge.userId,
          type: "JUDGE_CATEGORY_EXPIRING",
          title: "Скоро истекает судейская категория",
          body: `Категория «${category.categoryCode}» действует до ${category.expiresAt.toLocaleDateString("ru-RU")}.`,
          payload: { key, categoryId: category.id },
        });
        result.judgeCategories += 1;
      }

      return result;
    } catch (error) {
      this.logger.warn(
        `Проверка сроков завершилась с ошибкой: ${String(error)}`,
      );
      return { ...result, error: true };
    } finally {
      this.running = false;
    }
  }

  private async notifiedToday(userId: string, type: string, key: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const existing = await this.prisma.notification.findFirst({
      where: {
        userId,
        type,
        createdAt: { gte: startOfDay },
        payload: { path: ["key"], equals: key },
      },
      select: { id: true },
    });
    return Boolean(existing);
  }
}
