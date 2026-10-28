import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../common/prisma.service';
import { DocumentsService } from '../documents/documents.service';
import { ok } from '../common/http';
import { AwardRuleDto, PetitionDto, PetitionStatusDto } from './regional.dto';

export function bestAwards<T extends {athleteId:string;amount:number}>(items:T[]):T[]{
  const best=new Map<string,T>();for(const item of items){if(!best.has(item.athleteId)||best.get(item.athleteId)!.amount<item.amount)best.set(item.athleteId,item);}return [...best.values()];
}
export function sendRegionalFile(res:Response,file:{buffer:Buffer;filename:string;mime:string}){res.setHeader('Content-Type',file.mime);res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`);res.send(file.buffer);}
type Candidate={athleteId:string;name:string;resultId:string;competition:string;place:number;amount:number;source:string;passport:string;inn:string;snils:string;bank:string};

@Controller('regional/awards') @UseGuards(AuthGuard,RolesGuard) @Roles('FEDERATION','MINISTRY')
export class AwardsController {
  constructor(private readonly db:PrismaService,private readonly documents:DocumentsService){}
  @Get('rules') async rules(){return ok(await this.db.awardRule.findMany({orderBy:[{band:'asc'},{place:'asc'}]}));}
  @Post('rules') @Roles('FEDERATION') async rule(@Body() dto:AwardRuleDto){return ok(await this.db.awardRule.upsert({where:{band_place:{band:dto.band,place:dto.place}},create:dto,update:{...dto,active:true}}));}
  @Patch('rules/:id/disable') @Roles('FEDERATION') async disable(@Param('id') id:string){return ok(await this.db.awardRule.update({where:{id},data:{active:false}}));}
  private async candidates(db:Prisma.TransactionClient,year:number){
    if(year<2000||year>2200)throw new BadRequestException('Некорректный год');
    const rules=await db.awardRule.findMany({where:{active:true}});
    const rows=await db.competitionResult.findMany({where:{status:'PUBLISHED',place:{lte:3,gte:1},competition:{publicationStatus:'PUBLISHED',protocol:{status:'PUBLISHED'},endsAt:{gte:new Date(`${year}-01-01`),lt:new Date(`${year+1}-01-01`),lte:new Date()}}},include:{athlete:{include:{disqualifications:true}},competition:{include:{_count:{select:{results:{where:{status:'PUBLISHED'}}}}}}}});
    const eligible:Candidate[]=[];
    for(const r of rows){
      const rule=rules.find(rule=>rule.band===r.competition.ratingBand&&rule.place===r.place);
      if(!rule||r.competition._count.results<rule.minParticipants||r.athlete.status!=='ACTIVE'||r.athlete.disqualifications.some(d=>d.startsAt<=r.competition.endsAt&&(!d.endsAt||d.endsAt>=r.competition.startsAt))||(r.extraMetrics as {technicalLoss?:boolean}|null)?.technicalLoss)continue;
      eligible.push({athleteId:r.athleteId,name:[r.athlete.lastName,r.athlete.firstName,r.athlete.middleName].filter(Boolean).join(' '),resultId:r.id,competition:r.competition.name,place:r.place,amount:Number(rule.amount),source:rule.source,passport:'**** ******',inn:'************',snils:'***-***-*** **',bank:'********************'});
    }
    return bestAwards(eligible);
  }
  @Get('candidates/:year') async preview(@Param('year',ParseIntPipe) year:number){return ok(await this.candidates(this.db,year));}
  @Get('petitions') async petitions(){return ok(await this.db.awardPetition.findMany({orderBy:{createdAt:'desc'}}));}
  @Post('petitions') @Roles('FEDERATION') async prepare(@CurrentUser() user:AuthUser,@Body() dto:PetitionDto){return ok(await this.db.$transaction(async tx=>{
    const candidates=await this.candidates(tx,dto.year);if(!candidates.length)throw new BadRequestException('Нет подходящих результатов: проверьте опубликованные протоколы и справочник премий');
    return tx.awardPetition.create({data:{year:dto.year,candidates,createdById:user.id,history:[{status:'PREPARED',userId:user.id,date:new Date().toISOString()}]}});
  }));}
  @Patch('petitions/:id') @Roles('FEDERATION') async status(@CurrentUser() user:AuthUser,@Param('id') id:string,@Body() dto:PetitionStatusDto){return ok(await this.db.$transaction(async tx=>{
    const row=await tx.awardPetition.findUniqueOrThrow({where:{id}});
    if(!((row.status==='PREPARED'&&dto.status==='SENT')||(row.status==='SENT'&&dto.status==='AWARDED')))throw new BadRequestException('Допустимы переходы: подготовлено → направлено → премия назначена');
    const changed=await tx.awardPetition.updateMany({where:{id,status:row.status},data:{status:dto.status,history:[...(Array.isArray(row.history)?row.history:[]),{...dto,userId:user.id,date:new Date().toISOString()}] as Prisma.InputJsonValue}});
    if(!changed.count)throw new BadRequestException('Статус изменился, обновите страницу');
    await tx.auditLog.create({data:{userId:user.id,action:'AWARD_STATUS',entityType:'AwardPetition',entityId:id,changes:{status:dto.status}}});return tx.awardPetition.findUnique({where:{id}});
  }));}
  @Get('petitions/:id.xlsx') async spreadsheet(@Param('id') id:string,@Res() res:Response){
    const row=await this.db.awardPetition.findUniqueOrThrow({where:{id}});const book=new ExcelJS.Workbook();const sheet=book.addWorksheet('Кандидаты');
    sheet.addRow(['Ходатайство',row.id,'Год',row.year,'Статус',row.status]);sheet.addRow(['Спортсмен','Соревнование','Место','Премия, руб.','Основание','Паспорт (маска)','ИНН (маска)','СНИЛС (маска)','Счёт (маска)']);
    for(const c of row.candidates as unknown as Candidate[])sheet.addRow([c.name,c.competition,c.place,c.amount,c.source,c.passport,c.inn,c.snils,c.bank]);
    sheet.columns.forEach(c=>c.width=28);sheet.getRow(2).font={bold:true};
    sendRegionalFile(res,{buffer:Buffer.from(await book.xlsx.writeBuffer()),filename:`award-${row.year}-${id}.xlsx`,mime:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }
  @Get('petitions/:id.pdf') async letter(@Param('id') id:string,@Res() res:Response){
    const row=await this.db.awardPetition.findUniqueOrThrow({where:{id}});const candidates=row.candidates as unknown as Candidate[];
    sendRegionalFile(res,await this.documents.pdf(doc=>{
      doc.fontSize(16).text('Проект ходатайства о премировании');doc.moveDown();doc.fontSize(11).text(`В Министерство физической культуры и спорта Оренбургской области\nЗа результаты ${row.year} года. № ${row.id}\nСтатус: ${row.status}`);doc.moveDown();
      doc.text('Просим рассмотреть кандидатуры спортсменов на премии Губернатора Оренбургской области. Расчёт выполнен по справочнику федерации; право на выплату подтверждается при рассмотрении.');
      for(const c of candidates){doc.moveDown();doc.text(`${c.name}: ${c.competition}, место ${c.place}, ${c.amount.toFixed(2)} руб. Основание: ${c.source}`);}
      doc.moveDown();doc.text(`Всего: ${candidates.reduce((s,c)=>s+c.amount,0).toFixed(2)} руб.\nПриложения: реестр кандидатов XLSX, опубликованные протоколы соревнований.\nПодпись уполномоченного лица: __________________`);
    },`petition-${row.year}.pdf`));
  }
}

@Controller('regional/judging') @UseGuards(AuthGuard,RolesGuard)
export class JudgingDocumentsController {
  constructor(private readonly db:PrismaService,private readonly documents:DocumentsService){}
  @Get('options') @Roles('FEDERATION','MINISTRY','JUDGE') async options(@CurrentUser() u:AuthUser){return ok({athletes:u.activeRole==='JUDGE'?await this.db.athlete.findMany({where:{results:{some:{competition:{judgeAssignments:{some:{judgeId:u.judgeId??''}}}}}},select:{id:true,lastName:true,firstName:true}}):[],judges:await this.db.judge.findMany({where:u.activeRole==='JUDGE'?{id:u.judgeId??''}:{},select:{id:true,firstName:true,lastName:true}}),competitions:await this.db.competition.findMany({where:u.activeRole==='JUDGE'?{judgeAssignments:{some:{judgeId:u.judgeId??''}}}:{},select:{id:true,name:true}})});}
  @Get('panel/:id.pdf') @Roles('FEDERATION','MINISTRY','JUDGE') async panel(@CurrentUser() u:AuthUser,@Param('id') id:string,@Res() res:Response){
    if(u.activeRole==='JUDGE'&&!await this.db.judgeAssignment.findFirst({where:{competitionId:id,judgeId:u.judgeId??''}}))throw new BadRequestException('Нет назначения на соревнование');
    const competition=await this.db.competition.findUniqueOrThrow({where:{id},include:{judgeAssignments:{where:{endedAt:null},include:{judge:{include:{categories:true}}}}}});
    sendRegionalFile(res,await this.documents.pdf(doc=>{doc.fontSize(16).text('Справка о составе судейской коллегии');doc.moveDown();doc.fontSize(11).text(`${competition.name}\nДата: ${competition.startsAt.toLocaleDateString('ru-RU')}\nМесто: ${competition.venue}`);for(const a of competition.judgeAssignments){const cat=a.judge.categories.filter(c=>c.assignedAt<=competition.startsAt&&c.expiresAt>=competition.startsAt).sort((a,b)=>b.assignedAt.getTime()-a.assignedAt.getTime())[0];doc.moveDown();doc.text(`${a.judge.lastName} ${a.judge.firstName} ${a.judge.middleName??''} — ${a.position}; категория: ${cat?.categoryCode??'не указана'}`);}doc.moveDown();doc.text('Подпись: __________________');},`judges-${id}.pdf`));
  }
  @Get('history/:id.pdf') @Roles('FEDERATION','MINISTRY','JUDGE') async history(@CurrentUser() u:AuthUser,@Param('id') id:string,@Res() res:Response){
    if(u.activeRole==='JUDGE'&&u.judgeId!==id)throw new BadRequestException('Доступен только собственный отчёт');
    const judge=await this.db.judge.findUniqueOrThrow({where:{id},include:{assignments:{include:{competition:true},orderBy:{assignedAt:'asc'}}}});
    sendRegionalFile(res,await this.documents.pdf(doc=>{doc.fontSize(16).text('Отчёт о судействе соревнований');doc.fontSize(11).text(`${judge.lastName} ${judge.firstName} ${judge.middleName??''}`);for(const a of judge.assignments.filter(a=>a.competition.endsAt<=new Date()&&(!a.endedAt||a.endedAt>=a.competition.startsAt))){doc.moveDown();doc.text(`${a.competition.startsAt.toLocaleDateString('ru-RU')} — ${a.competition.name}\n${a.position}; ${a.competition.venue}`);}doc.moveDown();doc.text('Сформировано по реестру назначений судей.\nПодпись: __________________');},`judge-history-${id}.pdf`));
  }
}
