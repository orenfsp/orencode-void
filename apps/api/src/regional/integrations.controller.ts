import { BadRequestException, Body, Controller, ForbiddenException, Get, Injectable, OnModuleDestroy, OnModuleInit, Param, Patch, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { createHmac, randomBytes } from 'crypto';
import { lookup } from 'dns/promises';
import https from 'https';
import { Request } from 'express';
import { PrismaService } from '../common/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { CompetitionsService } from '../competitions/competitions.service';
import { ok } from '../common/http';
import { tokenHash } from './oidc.controller';

const scopes = ['competitions:read','results:write'];
const events = ['COMPETITION_PUBLISH','APPLICATION_REVIEW','PROTOCOL_PUBLISH'];
class TokenDto {
  @IsString() @MinLength(2) @MaxLength(150) name!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(2) @IsIn(scopes,{each:true}) scopes!: string[];
  @IsOptional() @IsUUID() competitionId?: string;
  @IsDateString() expiresAt!: string;
}
class WebhookDto {
  @IsString() @MaxLength(2000) url!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(3) @IsIn(events,{each:true}) events!: string[];
}
class ResultDto { @IsUUID() athleteId!: string; @IsNumber() score!: number; }
class ImportResultsDto { @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ValidateNested({each:true}) @Type(()=>ResultDto) items!: ResultDto[]; }
export function publicIPv4(address: string) {
  const p = address.split('.').map(Number);
  return p.length === 4 && p.every(n=>Number.isInteger(n)&&n>=0&&n<=255) && ![0,10,127].includes(p[0]) && p[0]<224 && !(p[0]===169&&p[1]===254) && !(p[0]===172&&p[1]>=16&&p[1]<=31) && !(p[0]===192&&(p[1]===168||p[1]===0)) && !(p[0]===100&&p[1]>=64&&p[1]<=127) && !(p[0]===198&&(p[1]===18||p[1]===19));
}
export async function webhookAddress(url: string) {
  let u: URL; try { u=new URL(url); } catch { throw new BadRequestException('Некорректный URL'); }
  const allowed = (process.env.WEBHOOK_ALLOWED_HOSTS ?? '').split(',').map(s=>s.trim()).filter(Boolean);
  if(u.protocol!=='https:' || u.username || u.password || u.hash || (u.port && u.port!=='443') || !allowed.includes(u.hostname)) throw new BadRequestException('Для webhook нужен HTTPS и хост из WEBHOOK_ALLOWED_HOSTS');
  const records=await lookup(u.hostname,{all:true,family:4});
  if(!records.length || records.some(r=>!publicIPv4(r.address))) throw new BadRequestException('Webhook не может обращаться к внутренней сети');
  return {url:u,address:records[0].address};
}

@Injectable()
export class WebhookWorker implements OnModuleInit,OnModuleDestroy {
  private timer?: NodeJS.Timeout; private running=false;
  constructor(private readonly db: PrismaService) {}
  onModuleInit(){ this.timer=setInterval(()=>void this.tick(),15000); this.timer.unref(); }
  onModuleDestroy(){ if(this.timer) clearInterval(this.timer); }
  async tick(){
    if(this.running) return; this.running=true;
    try {
      const rows=await this.db.webhookDelivery.findMany({where:{deliveredAt:null,attempts:{lt:5},nextAttemptAt:{lte:new Date()},subscription:{active:true}},include:{subscription:true},take:20});
      for(const row of rows){
        const claim=await this.db.webhookDelivery.updateMany({where:{id:row.id,attempts:row.attempts,nextAttemptAt:{lte:new Date()}},data:{attempts:{increment:1},nextAttemptAt:new Date(Date.now()+60000)}});
        if(!claim.count) continue;
        try {
          const target=await webhookAddress(row.subscription.url);
          const body=JSON.stringify({id:row.id,event:row.event,data:row.payload}); const timestamp=String(Math.floor(Date.now()/1000));
          const signature=createHmac('sha256',row.subscription.secret).update(`${timestamp}.${body}`).digest('hex');
          await new Promise<void>((resolve,reject)=>{
            const request=https.request(target.url,{method:'POST',lookup:(_host,_opts,cb)=>cb(null,target.address,4),headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body),'X-FSP-Event-Id':row.id,'X-FSP-Timestamp':timestamp,'X-FSP-Signature':signature}},response=>{
              response.resume(); if(response.statusCode && response.statusCode>=200&&response.statusCode<300) resolve(); else reject(new Error(`HTTP ${response.statusCode}`));
            }); request.setTimeout(5000,()=>request.destroy(new Error('Timeout'))); request.on('error',reject); request.end(body);
          });
          await this.db.webhookDelivery.update({where:{id:row.id},data:{deliveredAt:new Date(),lastError:null}});
        } catch(e) { await this.db.webhookDelivery.update({where:{id:row.id},data:{lastError:(e instanceof Error?e.message:'Delivery failed').slice(0,300),nextAttemptAt:new Date(Date.now()+60000*2**row.attempts)}}); }
      }
    } catch { /* Database can be unavailable during startup; next tick retries. */ } finally { this.running=false; }
  }
}

@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly db: PrismaService,private readonly competitions:CompetitionsService){}
  @Get('tokens') @UseGuards(AuthGuard,RolesGuard) @Roles('FEDERATION') async tokens(){ return ok(await this.db.integrationToken.findMany({select:{id:true,name:true,scopes:true,competitionId:true,expiresAt:true,revokedAt:true}})); }
  @Post('tokens') @UseGuards(AuthGuard,RolesGuard) @Roles('FEDERATION') async createToken(@CurrentUser() user:AuthUser,@Body() dto:TokenDto){
    if(new Date(dto.expiresAt)<=new Date() || new Date(dto.expiresAt).getTime()>Date.now()+366*86400000) throw new BadRequestException('Срок токена: от текущего момента до одного года');
    if(dto.scopes.includes('results:write')&&!dto.competitionId) throw new BadRequestException('Для записи результатов выберите соревнование');
    if(dto.competitionId && !await this.db.competition.findUnique({where:{id:dto.competitionId}})) throw new BadRequestException('Соревнование не найдено');
    const secret=randomBytes(32).toString('base64url');
    const row=await this.db.integrationToken.create({data:{...dto,expiresAt:new Date(dto.expiresAt),ownerId:user.id,tokenHash:tokenHash(secret)}});
    return ok({id:row.id,token:secret});
  }
  @Patch('tokens/:id/revoke') @UseGuards(AuthGuard,RolesGuard) @Roles('FEDERATION') async revoke(@Param('id') id:string){await this.db.integrationToken.update({where:{id},data:{revokedAt:new Date()}});return ok({revoked:true});}
  private async external(req:Request,scope:string,competitionId?:string):Promise<AuthUser>{
    const secret=req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]+)$/)?.[1];
    const token=secret?await this.db.integrationToken.findUnique({where:{tokenHash:tokenHash(secret)}}):null;
    if(!token||token.revokedAt||token.expiresAt<=new Date()) throw new UnauthorizedException('Недействительный токен');
    if(!token.scopes.includes(scope)||(token.competitionId&&competitionId&&token.competitionId!==competitionId)) throw new ForbiddenException('Недостаточно прав токена');
    const user=await this.db.user.findUnique({where:{id:token.ownerId},include:{roles:{include:{role:true}}}});
    if(!user?.isActive||!user.roles.some(r=>r.role.code==='FEDERATION')) throw new UnauthorizedException('Владелец токена заблокирован');
    return {id:user.id,email:user.email,firstName:user.firstName,lastName:user.lastName,middleName:user.middleName,roles:['FEDERATION'],activeRole:'FEDERATION',sessionId:''};
  }
  @Get('competitions') async read(@Req() req:Request){await this.external(req,'competitions:read');return ok(await this.db.competition.findMany({where:{publicationStatus:'PUBLISHED'},select:{id:true,name:true,startsAt:true,endsAt:true,disciplineId:true},take:500,orderBy:{startsAt:'desc'}}));}
  @Post('competitions/:id/results') async results(@Req() req:Request,@Param('id') id:string,@Body() dto:ImportResultsDto){
    const user=await this.external(req,'results:write',id);
    await this.competitions.upsertResults(user,id,dto.items);
    return ok(await this.competitions.publishProtocol(user,id));
  }
  @Get('webhooks') @UseGuards(AuthGuard,RolesGuard) @Roles('FEDERATION') async webhooks(){return ok(await this.db.webhookSubscription.findMany({select:{id:true,url:true,events:true,active:true,deliveries:{select:{id:true,event:true,attempts:true,deliveredAt:true,lastError:true},orderBy:{nextAttemptAt:'desc'},take:20}}}));}
  @Post('webhooks') @UseGuards(AuthGuard,RolesGuard) @Roles('FEDERATION') async subscribe(@Body() dto:WebhookDto){await webhookAddress(dto.url);const row=await this.db.webhookSubscription.create({data:{...dto,secret:randomBytes(32).toString('hex')}});return ok(row);}
  @Patch('webhooks/:id/revoke') @UseGuards(AuthGuard,RolesGuard) @Roles('FEDERATION') async unsubscribe(@Param('id') id:string){await this.db.webhookSubscription.update({where:{id},data:{active:false}});return ok({revoked:true});}
}
