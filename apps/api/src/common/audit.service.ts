import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "./prisma.service";

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    userId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    changes?: Prisma.InputJsonValue;
    context?: Prisma.InputJsonValue;
  }) {
    await this.prisma.$transaction(async tx => {
    const entry = await tx.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        changes: params.changes,
        context: params.context,
      },
    });
    if (['COMPETITION_PUBLISH','APPLICATION_REVIEW','PROTOCOL_PUBLISH'].includes(params.action) && (params.action !== 'APPLICATION_REVIEW' || (params.changes as {status?:string})?.status === 'APPROVED')) {
      const subscriptions = await tx.webhookSubscription.findMany({where:{active:true,events:{has:params.action}}});
      await tx.webhookDelivery.createMany({data:subscriptions.map(s=>({subscriptionId:s.id,auditId:entry.id,event:params.action,payload:{entityType:params.entityType,entityId:params.entityId,occurredAt:entry.createdAt.toISOString()}}))});
    }
    });
  }
}
