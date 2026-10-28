import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../common/prisma.service';
import { AthletesService } from '../athletes/athletes.service';
import { ageOnDate } from '../ratings/rating.engine';
import { ok } from '../common/http';
import { RegionalService } from './regional.service';
import * as D from './regional.dto';

@Controller('regional') @UseGuards(AuthGuard,RolesGuard)
export class RegionalController {
  constructor(private readonly service:RegionalService,private readonly db:PrismaService,private readonly athletes:AthletesService){}
  @Get('options') async options(@CurrentUser() u:AuthUser){return ok(await this.service.options(u));}
  @Get('groups') @Roles('FEDERATION','MINISTRY','COACH','ATHLETE') async groups(@CurrentUser() u:AuthUser){return ok(await this.service.groups(u));}
  @Post('groups') @Roles('FEDERATION') async group(@CurrentUser() u:AuthUser,@Body() d:D.GroupDto){return ok(await this.service.createGroup(u,d));}
  @Get('groups/:id') @Roles('FEDERATION','MINISTRY','COACH') async journal(@CurrentUser() u:AuthUser,@Param('id') id:string){return ok(await this.service.journal(u,id));}
  @Post('groups/:id/members') @Roles('FEDERATION','COACH') async member(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:D.MemberDto){return ok(await this.service.addMember(u,id,d.athleteId));}
  @Post('groups/:id/lessons') @Roles('FEDERATION','COACH') async lesson(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:D.LessonDto){return ok(await this.service.addLesson(u,id,d));}
  @Post('lessons/:id/attendance') @Roles('FEDERATION','COACH') async attendance(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:D.AttendanceDto){return ok(await this.service.attendance(u,id,d));}
  @Get('standards') async standards(){return ok(await this.service.standards());}
  @Post('standards') @Roles('FEDERATION') async standard(@CurrentUser() u:AuthUser,@Body() d:D.StandardDto){return ok(await this.service.createStandard(u,d));}
  @Patch('standards/:id') @Roles('FEDERATION') async revise(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:D.StandardDto){
    if(d.minAge>d.maxAge || !await this.db.discipline.findUnique({where:{id:d.disciplineId}})) throw new BadRequestException('Проверьте возраст и дисциплину');
    return ok(await this.db.$transaction(async tx=>{await tx.trainingStandard.update({where:{id},data:{active:false}});const next=await tx.trainingStandard.create({data:d});await tx.auditLog.create({data:{userId:u.id,action:'STANDARD_REVISE',entityType:'TrainingStandard',entityId:id,changes:{newId:next.id}}});return next;}));
  }
  @Get('assessments') @Roles('FEDERATION','MINISTRY','COACH','ATHLETE') async assessments(@CurrentUser() u:AuthUser){return ok(await this.service.assessments(u));}
  @Post('assessments') @Roles('FEDERATION','COACH') async assess(@CurrentUser() u:AuthUser,@Body() d:D.AssessmentDto){return ok(await this.service.assess(u,d));}
  @Patch('athletes/:id/sex') @Roles('FEDERATION') async sex(@Param('id') id:string,@Body() d:D.SexDto){return ok(await this.db.athlete.update({where:{id},data:d,select:{id:true,sex:true}}));}
  @Patch('organizations/:id') @Roles('FEDERATION') async org(@Param('id') id:string,@Body() d:D.OrganizationDetailsDto){return ok(await this.db.organization.update({where:{id},data:d}));}
  @Get('requests') @Roles('FEDERATION','ATHLETE','COACH','JUDGE') async requests(@CurrentUser() u:AuthUser){return ok(await this.service.requests(u));}
  @Post('requests') @Roles('FEDERATION','ATHLETE','COACH','JUDGE') async request(@CurrentUser() u:AuthUser,@Body() d:D.RequestDto){return ok(await this.service.submit(u,d));}
  @Patch('requests/:id') @Roles('FEDERATION') async decide(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:D.DecisionDto){return ok(await this.service.decide(u,id,d));}
  @Get('journey/:id') @Roles('FEDERATION','MINISTRY','ATHLETE','COACH') async journey(@CurrentUser() u:AuthUser,@Param('id') id:string){return ok(await this.service.journey(u,id));}
  @Get('rank-requirements') async requirements(){return ok(await this.db.rankRequirement.findMany({where:{isActive:true}}));}
  @Post('rank-requirements') @Roles('FEDERATION') async requirement(@Body() d:D.RankRequirementDto){return ok(await this.db.rankRequirement.create({data:{...d,isActive:true}}));}
  @Get('scenarios') async scenarios(){return ok(await this.service.scenarios());}
  @Post('scenarios') @Roles('FEDERATION','COACH') async scenario(@CurrentUser() u:AuthUser,@Body() d:D.ScenarioDto){return ok(await this.service.createScenario(u,d));}

  private async readiness(db:Prisma.TransactionClient,athleteId:string,targetGroupId:string){
    const athlete=await db.athlete.findUniqueOrThrow({where:{id:athleteId},include:{disciplines:true}});
    const group=await db.trainingGroup.findUniqueOrThrow({where:{id:targetGroupId}});
    if(athlete.organizationId!==group.organizationId || !athlete.disciplines.some(d=>d.disciplineId===group.disciplineId)) throw new BadRequestException('Организация и дисциплина спортсмена должны соответствовать группе');
    const age=ageOnDate(athlete.birthDate,new Date());
    const standards=await db.trainingStandard.findMany({where:{active:true,stage:group.stage,sex:athlete.sex,disciplineId:group.disciplineId,minAge:{lte:age},maxAge:{gte:age}}});
    const items=await Promise.all(standards.map(async s=>{const result=await db.assessment.findFirst({where:{athleteId,standardId:s.id},orderBy:{assessedAt:'desc'}});return {standardId:s.id,title:s.title,passed:result?.passed??false,value:result?.value??null,assessmentId:result?.id??null};}));
    return {ready:items.length>0&&items.every(i=>i.passed),requirements:items,stage:group.stage};
  }
  @Get('readiness/:athleteId/:groupId') @Roles('FEDERATION','COACH','ATHLETE') async ready(@CurrentUser() u:AuthUser,@Param('athleteId') athleteId:string,@Param('groupId') groupId:string){await this.athletes.assertCoachAccess(u,athleteId);return ok(await this.readiness(this.db,athleteId,groupId));}
  @Post('transfers') @Roles('FEDERATION','COACH') async transfer(@CurrentUser() u:AuthUser,@Body() d:D.TransferDto){
    await this.athletes.assertCoachAccess(u,d.athleteId);
    if(u.activeRole==='COACH'&&!await this.db.trainingGroup.findFirst({where:{id:d.targetGroupId,coachId:u.coachId??''}})) throw new BadRequestException('Перевод к другому тренеру оформляет федерация');
    return ok(await this.db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "Athlete" WHERE id=${d.athleteId} FOR UPDATE`;
      const check=await this.readiness(tx,d.athleteId,d.targetGroupId);if(!check.ready) throw new BadRequestException('Не выполнены все нормативы целевого этапа');
      const group=await tx.trainingGroup.findUniqueOrThrow({where:{id:d.targetGroupId}});
      const existing=await tx.trainingMember.findFirst({where:{athleteId:d.athleteId,endedAt:null,group:{disciplineId:group.disciplineId}}});
      if(existing?.groupId===group.id) throw new BadRequestException('Спортсмен уже в этой группе');
      const stages=['INITIAL','TRAINING','PERFECTION','MASTERY'];
      if(existing){const old=await tx.trainingGroup.findUniqueOrThrow({where:{id:existing.groupId}});if(stages.indexOf(group.stage)!==stages.indexOf(old.stage)+1) throw new BadRequestException('Можно перейти только на следующий этап');}
      await tx.trainingMember.updateMany({where:{athleteId:d.athleteId,endedAt:null,group:{disciplineId:group.disciplineId}},data:{endedAt:new Date()}});
      await tx.trainingMember.upsert({where:{groupId_athleteId:{groupId:group.id,athleteId:d.athleteId}},create:{groupId:group.id,athleteId:d.athleteId},update:{endedAt:null,joinedAt:new Date()}});
      return tx.trainingTransfer.create({data:{athleteId:d.athleteId,fromGroupId:existing?.groupId,toGroupId:group.id,approvedById:u.id,requirements:check.requirements}});
    }));
  }
  @Get('transfers/:athleteId') @Roles('FEDERATION','MINISTRY','COACH','ATHLETE') async transfers(@CurrentUser() u:AuthUser,@Param('athleteId') athleteId:string){await this.athletes.assertCoachAccess(u,athleteId);return ok(await this.db.trainingTransfer.findMany({where:{athleteId},orderBy:{createdAt:'desc'}}));}
  @Get('development/:year') @Roles('FEDERATION','MINISTRY') async development(@Param('year',ParseIntPipe) year:number){
    if(year<2000||year>2200) throw new BadRequestException('Некорректный год');
    const [competitions,organizations,evidence,enrollments]=await Promise.all([
      this.db.competition.findMany({where:{publicationStatus:'PUBLISHED',endsAt:{gte:new Date(`${year}-01-01`),lt:new Date(`${year+1}-01-01`),lte:new Date()},protocol:{status:'PUBLISHED'}},select:{id:true,name:true,startsAt:true,level:true,calendarPlanType:true,calendarPlanNumber:true}}),
      this.db.organization.findMany({where:{status:'ACTIVE',trainingGroups:{some:{}}},select:{id:true,name:true,license:true,programs:true,_count:{select:{trainingGroups:true}}}}),
      this.db.developmentEvidence.findMany({where:{year}}),
      this.db.trainingMember.findMany({where:{joinedAt:{lt:new Date(`${year+1}-01-01`)},OR:[{endedAt:null},{endedAt:{gte:new Date(`${year}-01-01`)}}]},select:{athleteId:true}}),
    ]);
    return ok({year,competitions,organizations,evidence,trainingAthletes:new Set(enrollments.map(m=>m.athleteId)).size,sources:{competitions:'Календарь и опубликованные протоколы; завершённые соревнования за год',organizations:'Организации с учебно-тренировочными группами',trainingAthletes:'Зачисления и переводы; занимались хотя бы часть выбранного года'}});
  }
  @Post('development/evidence') @Roles('FEDERATION') async evidence(@CurrentUser() u:AuthUser,@Body() d:D.EvidenceDto){return ok(await this.db.developmentEvidence.create({data:{...d,createdById:u.id}}));}
}
