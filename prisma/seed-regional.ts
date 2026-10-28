/** Optional, explicitly labelled hackathon fixtures. Never a legal reference table. */
import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
if(process.getBuiltinModule('fs').existsSync('.env'))process.loadEnvFile('.env');
const db=new PrismaClient();
const id=(name:string)=>{const h=createHash('sha256').update('regional-demo:'+name).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
async function main(){
  if(process.env.NODE_ENV==='production')throw new Error('Демо запрещено в production');
  const user=await db.user.findUnique({where:{email:'federation@fsp-orenburg.demo'}});
  const coach=await db.coach.findFirst({where:{user:{email:'coach@fsp-orenburg.demo'}}});
  const athlete=await db.athlete.findFirst({where:{user:{email:'athlete@fsp-orenburg.demo'}},include:{disciplines:true}});
  if(!user||!coach?.organizationId||!athlete?.disciplines.length)throw new Error('Сначала заполните пустую тестовую базу командой npm run prisma:seed');
  const disciplineId=athlete.disciplines[0].disciplineId;
  for(const [stage,name] of [['INITIAL','Демо: первая учебная группа'],['TRAINING','Демо: учебно-тренировочный этап']])await db.trainingGroup.upsert({where:{id:id(stage)},create:{id:id(stage),name,stage,disciplineId,organizationId:coach.organizationId,coachId:coach.id},update:{}});
  if(athlete.sex==='UNKNOWN')await db.athlete.update({where:{id:athlete.id},data:{sex:'M'}});
  const joinedAt=new Date(Date.now()-7*86400000);
  await db.trainingMember.upsert({where:{groupId_athleteId:{groupId:id('INITIAL'),athleteId:athlete.id}},create:{groupId:id('INITIAL'),athleteId:athlete.id,joinedAt},update:{}});
  await db.trainingLesson.upsert({where:{id:id('lesson')},create:{id:id('lesson'),groupId:id('INITIAL'),startsAt:new Date(Date.now()-86400000),topic:'Демо: алгоритмы и командная практика',minutes:90,format:'ONLINE',evidenceUrl:'https://example.org/demo-training-record'},update:{}});
  for(const sex of ['M','F'])for(const [title,unit,threshold,comparison] of [['ДЕМО: скорость печати','знаков/мин',120,'GTE'],['ДЕМО: время выполнения упражнения','секунд',30,'LTE']] as const){
    const key=id(sex+title);await db.trainingStandard.upsert({where:{id:key},create:{id:key,title,stage:'TRAINING',disciplineId,sex,minAge:0,maxAge:100,unit,threshold,comparison,source:'ДЕМОНСТРАЦИОННОЕ значение для проверки механики. Не норматив приказа № 445. Перед реальным использованием замените официальной таблицей.'},update:{}});
  }
  const result=await db.competitionResult.findFirst({where:{athleteId:athlete.id,status:'PUBLISHED'},include:{competition:true}});
  if(result)await db.awardRule.upsert({where:{band_place:{band:result.competition.ratingBand,place:result.place}},create:{band:result.competition.ratingBand,place:result.place,amount:10000,minParticipants:1,source:'ДЕМО: условная ставка 10 000 руб. Не размер по Указу № 93-ук. Только для демонстрации расчёта.'},update:{}});
  await db.oidcClient.upsert({where:{id:id('oidc')},create:{id:id('oidc'),name:'Демо: сервис партнёра',redirectUri:`${process.env.PUBLIC_WEB_URL??'http://localhost:3000'}/fsp-demo`},update:{}});
  console.log('Региональные демосценарии добавлены. Нормативы и суммы явно помечены как условные. Существующие записи не перезаписаны.');
}
main().finally(()=>db.$disconnect());
