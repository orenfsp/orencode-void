import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "./prisma.service";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async notify(params: {
    userId: string;
    type: string;
    title: string;
    body: string;
    payload?: Prisma.InputJsonValue;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body,
        payload: params.payload,
      },
    });

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return notification;
    }

    try {
      const link = await this.prisma.telegramLink.findUnique({
        where: { userId: params.userId },
      });
      if (!link) {
        return notification;
      }
      const response = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          signal: AbortSignal.timeout(5000),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: link.chatId,
            text: `${params.title}\n\n${params.body}`,
          }),
        },
      );
      if (response.ok) {
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: { telegramSentAt: new Date() },
        });
      }
    } catch (error) {
      this.logger.warn(`Telegram notification skipped: ${String(error)}`);
    }

    return notification;
  }

  async list(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async markRead(userId: string, id: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
