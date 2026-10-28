const fs=require('fs');const edit=(p,f)=>fs.writeFileSync(p,f(fs.readFileSync(p,'utf8')));
edit('apps/api/src/app.module.ts',s=>`import { RegionalModule } from './regional/regional.module';\n`+s.replace('    CommonModule,','    CommonModule,\n    RegionalModule,'));
edit('apps/api/src/documents/documents.module.ts',s=>s.replace('  providers: [DocumentsService],','  providers: [DocumentsService],\n  exports: [DocumentsService],'));
edit('apps/api/src/documents/documents.service.ts',s=>s.replace('  private pdf(', '  pdf('));
edit('apps/api/src/regional/regional.service.ts',s=>{
const a=s.indexOf("    if (dto.kind === 'AWARD') {");const b=s.indexOf("    return this.write(user, 'regional.request.submit'",a);
s=s.slice(0,a)+"    if(dto.programId) throw new BadRequestException('Программа премии здесь не используется');\n"+s.slice(b);
const c=s.indexOf('      // Serialize award submissions');const d=s.indexOf('      const request=',c);return s.slice(0,c)+s.slice(d);
});
edit('apps/api/src/common/audit.service.ts',s=>s.replace('    await this.prisma.auditLog.create({','    await this.prisma.$transaction(async tx => {\n    const entry = await tx.auditLog.create({').replace(/    \}\);\s*\n  \}/,`    });
    if (['COMPETITION_PUBLISH','APPLICATION_REVIEW','PROTOCOL_PUBLISH'].includes(params.action) && (params.action !== 'APPLICATION_REVIEW' || (params.changes as {status?:string})?.status === 'APPROVED')) {
      const subscriptions = await tx.webhookSubscription.findMany({where:{active:true,events:{has:params.action}}});
      await tx.webhookDelivery.createMany({data:subscriptions.map(s=>({subscriptionId:s.id,auditId:entry.id,event:params.action,payload:{entityType:params.entityType,entityId:params.entityId,occurredAt:entry.createdAt.toISOString()}}))});
    }
    });
  }`));
edit('apps/api/src/ratings/ratings.service.ts',s=>s.replace('      for (const result of results) {','      for (const result of results) {\n        if ((result.extraMetrics as {technicalLoss?:boolean}|null)?.technicalLoss) continue;'));
edit('apps/web/src/lib/nav.ts',s=>s.replace('export const ROLE_LABEL',`const extras: Record<string, Array<{href:string;label:string;icon:typeof Users}>> = {
  FEDERATION: [{href:'/training',label:'Спортивная подготовка',icon:Users},{href:'/standards',label:'Нормативы и аттестация',icon:Medal},{href:'/appeals',label:'Апелляции и нарушения',icon:Scale},{href:'/governor-awards',label:'Премии Губернатора',icon:Award},{href:'/integrations',label:'ФСП ID и интеграции',icon:Shield},{href:'/judging-documents',label:'Документы судей',icon:FileText},{href:'/journey',label:'Путь спортсмена',icon:Flag}],
  COACH: [{href:'/training',label:'Учебные группы',icon:Users},{href:'/standards',label:'Нормативы и аттестация',icon:Medal},{href:'/appeals',label:'Апелляции',icon:Scale},{href:'/journey',label:'Путь спортсмена',icon:Flag}],
  ATHLETE: [{href:'/standards',label:'Мои нормативы',icon:Medal},{href:'/appeals',label:'Апелляции',icon:Scale},{href:'/journey',label:'Мой спортивный путь',icon:Flag}],
  JUDGE: [{href:'/appeals',label:'Нарушения',icon:Scale},{href:'/judging-documents',label:'Документы судьи',icon:FileText}],
  MINISTRY: [{href:'/national-team',label:'Сборная региона',icon:Flag},{href:'/governor-awards',label:'Премии',icon:Award},{href:'/judging-documents',label:'Документы судей',icon:FileText}],
};
for(const [role,items] of Object.entries(extras)) NAV[role].push(...items);
for(const role of Object.keys(NAV)) NAV[role].push({href:'/public/guide',label:'Справочник и навигатор',icon:BookOpen});

export const ROLE_LABEL`));
edit('apps/web/src/app/(cabinet)/national-team/page.tsx',s=>s.replace('import { useState }',`import { useUser } from '@/components/shell';\nimport { useState }`).replace('  const [season,','  const canEdit = useUser()?.activeRole === "FEDERATION";\n  const [season,').replace('<Button className="h-fit" onClick={() => setOpen(true)}>','<Button disabled={!canEdit} className="h-fit" onClick={() => setOpen(true)}>').replace('  async function add(athleteId: string, source: string, note?: string) {','  async function add(athleteId: string, source: string, note?: string) {\n    if (!canEdit) return;'));
edit('apps/api/src/common/deadline.service.ts',s=>s.replace('      return result;',`      if (now.getMonth() === 0) {
        const staff = await this.prisma.user.findMany({where:{isActive:true,roles:{some:{role:{code:'FEDERATION'}}}},select:{id:true}});
        for (const user of staff) {
          const key = 'governor-awards:' + (now.getFullYear()-1);
          if (!await this.notifiedToday(user.id,'AWARD_DEADLINE',key)) await this.notifications.notify({userId:user.id,type:'AWARD_DEADLINE',title:'Премии Губернатора: срок подачи',body:'Подготовьте и направьте ходатайства за предыдущий год до 1 февраля.',payload:{key}});
        }
      }
      return result;`));
