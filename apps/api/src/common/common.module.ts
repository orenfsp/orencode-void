import { Global, Module } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { DeadlineService } from "./deadline.service";
import { NotificationsService } from "./notifications.service";
import { PrismaService } from "./prisma.service";

@Global()
@Module({
  providers: [
    PrismaService,
    AuditService,
    NotificationsService,
    DeadlineService,
  ],
  exports: [PrismaService, AuditService, NotificationsService, DeadlineService],
})
export class CommonModule {}
