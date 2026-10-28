import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../common/prisma.service';
import { AthletesService } from '../athletes/athletes.service';
import { RatingsService } from '../ratings/ratings.service';
import { ageOnDate, assignPlaces } from '../ratings/rating.engine';
import { SPORTS_RANKS, rankLevel } from '@fsp/shared';
import { AssessmentDto, AttendanceDto, DecisionDto, GroupDto, ImportDto, LessonDto, ProgramDto, RequestDto, ScenarioDto, StandardDto } from './regional.dto';

export function meetsStandard(value: number, threshold: number, comparison: string) {
  if (![value, threshold].every(Number.isFinite) || !['GTE', 'LTE'].includes(comparison))
    throw new BadRequestException('Некорректный норматив');
  return comparison === 'GTE' ? value >= threshold : value <= threshold;
}

@Injectable()
export class RegionalService {
  constructor(private readonly db: PrismaService, private readonly athletes: AthletesService, private readonly ratings: RatingsService) {}

  private async write<T>(user: AuthUser, action: string, operation: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.db.$transaction(async tx => {
      const result = await operation(tx);
      await tx.auditLog.create({ data: { userId: user.id, action, entityType: 'Regional', entityId: (result as {id?: string})?.id ?? user.id } });
      return result;
    });
  }

  async options(user: AuthUser) {
    const broad = ['FEDERATION', 'MINISTRY'].includes(user.activeRole);
    const athleteWhere: Prisma.AthleteWhereInput = broad ? {} : user.activeRole === 'COACH' && user.coachId
      ? { coaches: { some: { coachId: user.coachId, status: 'ACTIVE' } } }
      : { id: user.activeRole === 'ATHLETE' ? user.athleteId ?? '' : '' };
    const [athletes, organizations, coaches] = await Promise.all([
      this.db.athlete.findMany({ where: athleteWhere, select: { id: true, firstName: true, lastName: true, regionalId: true }, orderBy: { lastName: 'asc' } }),
      this.db.organization.findMany({ where: { status: 'ACTIVE' }, select: { id: true, name: true } }),
      this.db.coach.findMany({ where: broad ? {} : { id: user.coachId ?? '' }, select: { id: true, firstName: true, lastName: true } }),
    ]);
    return { athletes, organizations, coaches };
  }

  groups(user: AuthUser) {
    const where: Prisma.TrainingGroupWhereInput = ['FEDERATION', 'MINISTRY'].includes(user.activeRole) ? {}
      : user.activeRole === 'COACH' ? { coachId: user.coachId ?? '' }
      : { members: { some: { athleteId: user.athleteId ?? '' } } };
    return this.db.trainingGroup.findMany({ where, include: { organization: true, coach: { select: { firstName: true, lastName: true } }, _count: { select: { members: true, lessons: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async createGroup(user: AuthUser, dto: GroupDto) {
    const [org, coach] = await Promise.all([
      this.db.organization.findFirst({ where: { id: dto.organizationId, status: 'ACTIVE' } }),
      this.db.coach.findUnique({ where: { id: dto.coachId } }),
    ]);
    if (!org || !coach || coach.organizationId !== org.id) throw new BadRequestException('Выберите тренера этой действующей организации');
    if (!await this.db.discipline.findUnique({where:{id:dto.disciplineId}})) throw new BadRequestException('Дисциплина не найдена');
    return this.write(user, 'training.group.create', tx => tx.trainingGroup.create({ data: dto }));
  }

  private async groupAccess(user: AuthUser, id: string, write = false) {
    const group = await this.db.trainingGroup.findUnique({ where: { id } });
    if (!group) throw new NotFoundException('Группа не найдена');
    if (user.activeRole === 'FEDERATION' || (!write && user.activeRole === 'MINISTRY') || (user.activeRole === 'COACH' && user.coachId === group.coachId)) return group;
    throw new ForbiddenException('Нет доступа к журналу группы');
  }

  async journal(user: AuthUser, id: string) {
    await this.groupAccess(user, id);
    return this.db.trainingGroup.findUnique({ where: { id }, include: {
      members: { include: { athlete: { select: { firstName: true, lastName: true } } } },
      lessons: { include: { attendance: true }, orderBy: { startsAt: 'desc' } },
    } });
  }

  async addMember(user: AuthUser, groupId: string, athleteId: string) {
    const group = await this.groupAccess(user, groupId, true);
    await this.athletes.assertCoachAccess(user, athleteId);
    const athlete = await this.db.athlete.findUnique({ where: { id: athleteId } });
    if (!athlete || athlete.organizationId !== group.organizationId) throw new BadRequestException('Спортсмен должен состоять в организации группы');
    if(group.stage!=='INITIAL') throw new BadRequestException('Зачисление на этот этап выполняется через аттестацию и перевод');
    return this.write(user, 'training.member.add', tx => tx.trainingMember.upsert({ where: { groupId_athleteId: { groupId, athleteId } }, create: { groupId, athleteId }, update: {endedAt:null} }));
  }

  async addLesson(user: AuthUser, groupId: string, dto: LessonDto) {
    const group=await this.groupAccess(user, groupId, true);
    const limits:Record<string,number>={INITIAL:120,TRAINING:180,PERFECTION:240,MASTERY:240};
    if(dto.minutes>limits[group.stage]) throw new BadRequestException('Продолжительность превышает максимум этапа');
    return this.write(user, 'training.lesson.create', tx => tx.trainingLesson.create({ data: { ...dto, startsAt: new Date(dto.startsAt), groupId } }));
  }

  async attendance(user: AuthUser, lessonId: string, dto: AttendanceDto) {
    const lesson = await this.db.trainingLesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Занятие не найдено');
    await this.groupAccess(user, lesson.groupId, true);
    const member = await this.db.trainingMember.findUnique({ where: { id: dto.memberId } });
    if (member?.groupId !== lesson.groupId || member.joinedAt>lesson.startsAt || (member.endedAt && member.endedAt<=lesson.startsAt)) throw new BadRequestException('Спортсмен не состоял в группе на дату занятия');
    return this.write(user, 'training.attendance.save', tx => tx.trainingAttendance.upsert({ where: { lessonId_memberId: { lessonId, memberId: dto.memberId } }, create: { lessonId, ...dto }, update: { present: dto.present } }));
  }

  standards() { return this.db.trainingStandard.findMany({where:{active:true}, orderBy: { createdAt: 'desc' } }); }
  async createStandard(user: AuthUser, dto: StandardDto) {
    if(dto.minAge>dto.maxAge || !await this.db.discipline.findUnique({where:{id:dto.disciplineId}})) throw new BadRequestException('Проверьте возраст и дисциплину');
    return this.write(user, 'standard.create', tx => tx.trainingStandard.create({ data: dto }));
  }
  async assessments(user: AuthUser) {
    const ids = (await this.options(user)).athletes.map(a => a.id);
    return this.db.assessment.findMany({ where: { athleteId: { in: ids } }, include: { standard: true, athlete: { select: { firstName: true, lastName: true } } }, orderBy: { assessedAt: 'desc' } });
  }
  async assess(user: AuthUser, dto: AssessmentDto) {
    await this.athletes.assertCoachAccess(user, dto.athleteId);
    const standard = await this.db.trainingStandard.findUnique({ where: { id: dto.standardId } });
    if (!standard?.active) throw new NotFoundException('Действующий норматив не найден');
    const assessedAt = new Date(dto.assessedAt);
    if (assessedAt > new Date()) throw new BadRequestException('Дата аттестации не может быть в будущем');
    const athlete=await this.db.athlete.findUniqueOrThrow({where:{id:dto.athleteId},include:{disciplines:true}});
    const age=ageOnDate(athlete.birthDate,assessedAt);
    if(athlete.sex!==standard.sex || age<standard.minAge || age>standard.maxAge || !athlete.disciplines.some(d=>d.disciplineId===standard.disciplineId)) throw new BadRequestException('Норматив не соответствует полу, возрасту или дисциплине спортсмена');
    return this.write(user, 'assessment.create', tx => tx.assessment.create({ data: { ...dto, assessedAt, assessorId: user.id, thresholdSnapshot:standard.threshold,comparisonSnapshot:standard.comparison, passed: meetsStandard(dto.value, standard.threshold, standard.comparison) } }));
  }

  programs() { return this.db.awardProgram.findMany({ orderBy: { season: 'desc' } }); }
  createProgram(user: AuthUser, dto: ProgramDto) {
    if (new Date(dto.closesAt) <= new Date()) throw new BadRequestException('Срок подачи должен быть в будущем');
    return this.write(user, 'award.program.create', tx => tx.awardProgram.create({ data: { ...dto, closesAt: new Date(dto.closesAt) } }));
  }
  requests(user: AuthUser) {
    return this.db.regionalRequest.findMany({ where: user.activeRole === 'FEDERATION' ? {} : { submittedById: user.id }, include: { program: true, athlete: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' } });
  }
  async submit(user: AuthUser, dto: RequestDto) {
    if(dto.kind==='AWARD') throw new BadRequestException('Премии формируются по протоколам в разделе премий');
    if (!dto.athleteId) throw new BadRequestException('Выберите спортсмена');
    if(dto.kind==='APPEAL' || user.activeRole!=='JUDGE') await this.athletes.assertCoachAccess(user, dto.athleteId);
    else if(!await this.db.judgeAssignment.findFirst({where:{judgeId:user.judgeId??'',competitionId:dto.competitionId,endedAt:null}})) throw new ForbiddenException('Нарушение может зарегистрировать назначенный судья');
    if(!await this.db.competitionResult.findUnique({where:{competitionId_athleteId:{competitionId:dto.competitionId,athleteId:dto.athleteId}}})) throw new BadRequestException('Результат спортсмена не найден');
    if(dto.programId) throw new BadRequestException('Программа премии здесь не используется');
    return this.write(user, 'regional.request.submit', async tx => {
      const request=await tx.regionalRequest.create({ data: { ...dto, submittedById: user.id,history:[{status:'PENDING',userId:user.id,date:new Date().toISOString()}] } });
      const staff=await tx.user.findMany({where:{isActive:true,roles:{some:{role:{code:'FEDERATION'}}}},select:{id:true}});
      await tx.notification.createMany({data:staff.map(u=>({userId:u.id,type:'REGIONAL_REQUEST',title:'Новое обращение',body:dto.title}))});
      return request;
    });
  }
  decide(user: AuthUser, id: string, dto: DecisionDto) {
    return this.write(user, 'regional.request.review', async tx => {
      const row = await tx.regionalRequest.findUnique({ where: { id } });
      if (!row) throw new NotFoundException('Обращение не найдено');
      if (row.submittedById === user.id) throw new ForbiddenException('Нельзя рассматривать собственное обращение');
      if(dto.status==='REJECTED' && (dto.sanction!=='NONE'||dto.correctedScore!==undefined)) throw new BadRequestException('Отклонённое обращение не может менять результаты');
      if(dto.sanction!=='NONE' && row.kind!=='VIOLATION') throw new BadRequestException('Санкции назначаются по нарушениям');
      if(dto.sanction==='DISQUALIFICATION' && dto.sanctionEndsAt && new Date(dto.sanctionEndsAt)<=new Date()) throw new BadRequestException('Окончание дисквалификации должно быть в будущем');
      const history=[...(Array.isArray(row.history)?row.history:[]),{...dto,userId:user.id,date:new Date().toISOString()}] as Prisma.InputJsonValue;
      const updated = await tx.regionalRequest.updateMany({ where: { id, status: 'PENDING' }, data: {status:dto.status,decision:dto.decision,history, reviewedById: user.id, reviewedAt: new Date() } });
      if (!updated.count) throw new ConflictException('Обращение уже рассмотрено');
      if(dto.status==='APPROVED' && row.athleteId && row.competitionId && (dto.correctedScore!==undefined||dto.sanction!=='NONE')){
        const competition=await tx.competition.findUniqueOrThrow({where:{id:row.competitionId}});
        await tx.$queryRaw`SELECT id FROM "Competition" WHERE id = ${row.competitionId} FOR UPDATE`;
        if(dto.sanction==='DISQUALIFICATION') await tx.disqualification.create({data:{athleteId:row.athleteId,reason:dto.decision,startsAt:new Date(),endsAt:dto.sanctionEndsAt?new Date(dto.sanctionEndsAt):null,createdById:user.id}});
        const technical=dto.sanction==='TECHNICAL_LOSS';
        await tx.competitionResult.update({where:{competitionId_athleteId:{competitionId:row.competitionId,athleteId:row.athleteId}},data:{...(dto.correctedScore!==undefined?{score:dto.correctedScore}:{}),...(technical?{extraMetrics:{technicalLoss:true}}:{}),updatedById:user.id}});
        const results=await tx.competitionResult.findMany({where:{competitionId:row.competitionId}});
        const places=assignPlaces(results.filter(r=>!(r.extraMetrics as {technicalLoss?:boolean}|null)?.technicalLoss).map(r=>({id:r.id,score:Number(r.score)})));
        for(const result of results) await tx.competitionResult.update({where:{id:result.id},data:{place:places.get(result.id)??results.length+1,status:'DRAFT'}});
        await tx.competitionProtocol.updateMany({where:{competitionId:row.competitionId},data:{status:'DRAFT',publishedAt:null,publishedById:null}});
        await this.ratings.recalculate(competition.season,undefined,tx);
      }
      await tx.notification.create({ data: { userId: row.submittedById, title: 'Обращение рассмотрено', body: `${row.title}: ${dto.decision}`, type: 'REGIONAL_REQUEST' } });
      return tx.regionalRequest.findUnique({ where: { id } });
    });
  }
  scenarios() { return this.db.teamScenario.findMany({ orderBy: { createdAt: 'desc' } }); }
  createScenario(user: AuthUser, dto: ScenarioDto) { return this.write(user, 'scenario.create', tx => tx.teamScenario.create({ data: { ...dto, createdById: user.id } })); }

  async exchange() {
    return { version: 1, exportedAt: new Date().toISOString(), athletes: await this.db.athlete.findMany({ select: { regionalId: true, lastName: true, firstName: true, municipality: true, status: true } }), mappings: await this.db.externalMapping.findMany({ orderBy: { system: 'asc' } }) };
  }
  importMappings(user: AuthUser, dto: ImportDto) {
    return this.write(user, 'integration.import', async tx => {
      for (const row of dto.mappings) {
        if (!await tx.athlete.findUnique({ where: { regionalId: row.regionalId } })) throw new BadRequestException(`ФСП ID не найден: ${row.regionalId}`);
        const existing = await tx.externalMapping.findUnique({ where: { system_externalId: { system: row.system, externalId: row.externalId } } });
        if (existing && existing.regionalId !== row.regionalId) throw new ConflictException('Внешний ID уже связан с другим спортсменом');
        await tx.externalMapping.upsert({ where: { system_externalId: { system: row.system, externalId: row.externalId } }, create: row, update: {} });
      }
      return { imported: dto.mappings.length };
    });
  }
  async journey(user: AuthUser, athleteId: string) {
    await this.athletes.assertCoachAccess(user, athleteId);
    const athlete = await this.athletes.get(athleteId);
    const assessments = await this.db.assessment.findMany({ where: { athleteId }, include: { standard: true } });
    const currentRank=this.athletes.currentRank(athlete.ranks);
    const nextRank=SPORTS_RANKS[rankLevel(currentRank?.rankType)+1]??null;
    const requirements=nextRank?await this.db.rankRequirement.findMany({where:{rankType:nextRank,isActive:true}}):[];
    const competitions=await this.db.competition.findMany({where:{publicationStatus:'PUBLISHED',applicationsCloseAt:{gt:new Date()},disciplineId:{in:athlete.disciplines.map(d=>d.disciplineId)}},include:{ageGroup:true},orderBy:{startsAt:'asc'}});
    const eligible=competitions.filter(c=>{const age=ageOnDate(athlete.birthDate,c.startsAt);return (c.ageGroup.minAge===null||age>=c.ageGroup.minAge)&&(c.ageGroup.maxAge===null||age<=c.ageGroup.maxAge);});
    return { currentRank:currentRank?.rankType??null,nextRank,requirements,competitions:eligible.map(c=>({id:c.id,name:c.name,startsAt:c.startsAt,level:c.level})),regionalId: athlete.regionalId, events: [
      ...athlete.results.map(r => ({ date: r.createdAt, title: r.competition.name, detail: `Место: ${r.place}, баллы: ${r.score}` })),
      ...athlete.ranks.map(r => ({ date: r.assignedAt, title: 'Спортивный разряд', detail: r.rankType })),
      ...athlete.antiDoping.map(r => ({ date: r.completedAt, title: 'Антидопинг', detail: r.courseName })),
      ...assessments.map(r => ({ date: r.assessedAt, title: r.standard.title, detail: `${r.value} ${r.standard.unit} — ${r.passed ? 'выполнен' : 'не выполнен'}` })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime()) };
  }
}
