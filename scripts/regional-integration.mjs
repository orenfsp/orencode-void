import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {createHash,createPublicKey,verify,randomBytes} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import ExcelJS from 'exceljs';
const schema=`fsp_regional_test_${Date.now()}`;
const url=new URL(process.env.DATABASE_URL);url.searchParams.set('schema',schema);
const env={...process.env,DATABASE_URL:url.toString(),API_PORT:'4113',PUBLIC_API_URL:'http://localhost:4113',OIDC_ISSUER:'http://localhost:4113/api/oidc',NODE_ENV:'test'};
const db=new PrismaClient({datasourceUrl:url.toString()});const cookies={};let server;let logs='';let checks=0;
async function command(args){const child=spawn(process.execPath,args,{env,windowsHide:true,stdio:['ignore','pipe','pipe']});let out='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>out+=d);const [code]=await once(child,'exit');assert.equal(code,0,out);}
async function req(path,{role='federation',method='GET',body,status=200,headers={},raw=false}={}){
 const response=await fetch(`http://localhost:4113/api${path}`,{method,headers:{...(cookies[role]?{Cookie:cookies[role]}:{}),...(body?{'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined});
 const cookie=response.headers.get('set-cookie');if(cookie)cookies[role]=cookie.split(';')[0];
 if(raw){assert.equal(response.status,status,path);checks++;return Buffer.from(await response.arrayBuffer());}
 const json=await response.json();assert.equal(response.status,status,`${method} ${path}: ${JSON.stringify(json)}`);checks++;return json.data??json;
}
const post=(path,body,role='federation',status=201)=>req(path,{body,role,status,method:'POST'});
try{
 await command(['node_modules/prisma/build/index.js','migrate','deploy']);await command(['node_modules/tsx/dist/cli.mjs','prisma/seed.ts']);
 server=spawn(process.execPath,['apps/api/dist/main.js'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d);
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch('http://localhost:4113/api/disciplines')).ok){ready=true;break;}}catch{}await delay(100);}assert.ok(ready,logs);
 const users={};for(const role of ['federation','athlete','coach','judge','ministry'])users[role]=await post('/auth/login',{email:`${role}@fsp-orenburg.demo`,password:'Demo1234!'},role);
 await req('/regional/requests',{role:'ministry',status:403});await req('/integrations/tokens',{role:'athlete',status:403});await req('/regional/options',{role:'anonymous',status:401});
 const athlete=await db.athlete.findUniqueOrThrow({where:{id:users.athlete.athleteId},include:{disciplines:true}});const coach=await db.coach.findUniqueOrThrow({where:{id:users.coach.coachId}});const disciplineId=athlete.disciplines[0].disciplineId;
 const groupDto={name:'Тестовая группа',organizationId:athlete.organizationId,coachId:coach.id,disciplineId,stage:'INITIAL'};
 const group=await post('/regional/groups',groupDto);await post('/regional/groups',groupDto,'athlete',403);await post('/regional/groups',groupDto,'ministry',403);
 await post(`/regional/groups/${group.id}/members`,{athleteId:athlete.id});
 const lesson=await post(`/regional/groups/${group.id}/lessons`,{topic:'Практика',startsAt:new Date(Date.now()+1000).toISOString(),minutes:60,format:'ONLINE',evidenceUrl:'https://example.org/recording'});
 const journal=await req(`/regional/groups/${group.id}`);const member=journal.members[0];await post(`/regional/lessons/${lesson.id}/attendance`,{memberId:member.id,present:true},'coach');await post(`/regional/lessons/${lesson.id}/attendance`,{memberId:member.id,present:false},'athlete',403);
 const invalidLesson={topic:'Длинное занятие',startsAt:new Date().toISOString(),minutes:300,format:'ONLINE',evidenceUrl:'https://example.org'};await post(`/regional/groups/${group.id}/lessons`,invalidLesson,'coach',400);
 const target=await post('/regional/groups',{...groupDto,name:'Следующий этап',stage:'TRAINING'});
 await req(`/regional/athletes/${athlete.id}/sex`,{method:'PATCH',body:{sex:'M'}});
 const standardDto={title:'Тестовый норматив — скорость печати',stage:'TRAINING',disciplineId,sex:'M',minAge:0,maxAge:100,unit:'зн/мин',threshold:120,comparison:'GTE',source:'Демонстрационный норматив для автоматического теста'};
 const standard=await post('/regional/standards',standardDto);await post('/regional/transfers',{athleteId:athlete.id,targetGroupId:target.id},'federation',400);
 await post('/regional/assessments',{athleteId:athlete.id,standardId:standard.id,value:119,assessedAt:new Date().toISOString()},'coach');assert.equal((await req(`/regional/readiness/${athlete.id}/${target.id}`)).ready,false);
 await post('/regional/assessments',{athleteId:athlete.id,standardId:standard.id,value:120,assessedAt:new Date().toISOString()},'coach');assert.equal((await req(`/regional/readiness/${athlete.id}/${target.id}`)).ready,true);
 await post('/regional/transfers',{athleteId:athlete.id,targetGroupId:target.id});assert.equal((await req(`/regional/transfers/${athlete.id}`,{role:'athlete'})).length,1);
 const revised=await req(`/regional/standards/${standard.id}`,{method:'PATCH',body:{...standardDto,threshold:150}});assert.notEqual(revised.id,standard.id);assert.equal((await db.assessment.findFirst({where:{standardId:standard.id},orderBy:{value:'desc'}})).thresholdSnapshot,120);
 const other=await db.athlete.findFirst({where:{id:{not:athlete.id}}});await req(`/regional/journey/${other.id}`,{role:'athlete',status:403});await req(`/regional/journey/${athlete.id}`,{role:'athlete'});
 const result=await db.competitionResult.findFirstOrThrow({where:{athleteId:athlete.id,status:'PUBLISHED'},include:{competition:true}});const year=result.competition.endsAt.getFullYear();
 await post('/regional/awards/rules',{band:result.competition.ratingBand,place:result.place,amount:12345,minParticipants:1,source:'Демонстрационная ставка — не нормативный размер'});
 const candidates=await req(`/regional/awards/candidates/${year}`);assert.equal(candidates.find(c=>c.athleteId===athlete.id).amount,12345);
 const petition=await post('/regional/awards/petitions',{year});await req(`/regional/awards/petitions/${petition.id}`,{method:'PATCH',body:{status:'AWARDED',comment:'Нельзя перескочить статус'},status:400});
 await req(`/regional/awards/petitions/${petition.id}`,{method:'PATCH',body:{status:'SENT',comment:'Письмо № 1 от теста'}});await req(`/regional/awards/petitions/${petition.id}`,{method:'PATCH',body:{status:'AWARDED',comment:'Приказ № 2 от теста'}});
 const pdf=await req(`/regional/awards/petitions/${petition.id}.pdf`,{raw:true});assert.equal(pdf.subarray(0,4).toString(),'%PDF');const excel=await req(`/regional/awards/petitions/${petition.id}.xlsx`,{raw:true});const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(excel);assert.ok(workbook.worksheets[0].rowCount>=3);
 const appeal=await post('/regional/requests',{kind:'APPEAL',competitionId:result.competitionId,athleteId:athlete.id,title:'Проверка результата',description:'В протоколе неверный балл',evidenceUrls:['https://example.org/evidence']},'athlete');
 assert.equal((await req('/regional/requests',{role:'coach'})).length,0);
 await req(`/regional/requests/${appeal.id}`,{method:'PATCH',body:{status:'APPROVED',decision:'Баллы подтверждены материалами',sanction:'NONE',correctedScore:999}});
 await req(`/regional/requests/${appeal.id}`,{method:'PATCH',body:{status:'REJECTED',decision:'Повторное решение запрещено',sanction:'NONE'},status:409});
 assert.equal((await db.competitionProtocol.findUnique({where:{competitionId:result.competitionId}})).status,'DRAFT');assert.equal(Number((await db.competitionResult.findUnique({where:{id:result.id}})).score),999);
 assert.equal((await req('/regional/requests',{role:'athlete'}))[0].history.length,2);
 const opts=await req('/regional/judging/options',{role:'judge'});assert.ok(opts.judges.every(j=>j.id===users.judge.judgeId));
 for(const path of [`/regional/judging/history/${users.judge.judgeId}.pdf`,`/regional/judging/panel/${opts.competitions[0].id}.pdf`]){const file=await req(path,{role:'judge',raw:true});assert.equal(file.subarray(0,4).toString(),'%PDF');}
 await post('/regional/development/evidence',{year,indicator:'COMPETITIONS',title:'Протокол как подтверждение',url:'https://example.org/protocol'});assert.equal((await req(`/regional/development/${year}`,{role:'ministry'})).evidence.length,1);
 const token=await post('/integrations/tokens',{name:'Тестовый импорт',scopes:['results:write'],competitionId:result.competitionId,expiresAt:new Date(Date.now()+3600000).toISOString()});
 await req('/integrations/competitions',{role:'external',headers:{Authorization:`Bearer ${token.token}`},status:403});
 await req(`/integrations/competitions/${other.id}/results`,{role:'external',method:'POST',body:{items:[{athleteId:athlete.id,score:1000}]},headers:{Authorization:`Bearer ${token.token}`},status:403});
 const hook=await db.webhookSubscription.create({data:{url:'https://example.org/webhook',events:['PROTOCOL_PUBLISH'],secret:'test-secret'}});
 await req(`/integrations/competitions/${result.competitionId}/results`,{role:'external',method:'POST',body:{items:[{athleteId:athlete.id,score:1000}]},headers:{Authorization:`Bearer ${token.token}`},status:201});
 assert.ok(await db.webhookDelivery.findFirst({where:{subscriptionId:hook.id,event:'PROTOCOL_PUBLISH'}}));
 await req(`/integrations/tokens/${token.id}/revoke`,{method:'PATCH'});await req('/integrations/competitions',{role:'external',headers:{Authorization:`Bearer ${token.token}`},status:401});
 await post('/integrations/webhooks',{url:'https://127.0.0.1/hook',events:['PROTOCOL_PUBLISH']},'federation',400);
 const client=await post('/oidc/clients',{name:'Тестовый OIDC-клиент',redirectUri:'https://partner.example/callback'});
 const verifier=randomBytes(48).toString('base64url');const authorization={client_id:client.id,redirect_uri:client.redirectUri,response_type:'code',code_challenge_method:'S256',code_challenge:createHash('sha256').update(verifier).digest('base64url'),state:randomBytes(24).toString('hex'),nonce:randomBytes(24).toString('hex'),scope:'openid profile sport'};
 await req('/oidc/consent?'+new URLSearchParams({...authorization,redirect_uri:'https://attacker.example'}),{role:'athlete',status:400});
 const allowed=await post('/oidc/consent',{...authorization,decision:'approve'},'athlete');const code=new URL(allowed.redirect).searchParams.get('code');
 const tokenBody={grant_type:'authorization_code',client_id:client.id,redirect_uri:client.redirectUri,code,code_verifier:verifier};
 await post('/oidc/token',{...tokenBody,code_verifier:'X'.repeat(64)},'external',400);
 const oidc=await post('/oidc/token',tokenBody,'external',200);await post('/oidc/token',tokenBody,'external',400);
 const jwt=oidc.id_token.split('.');const jwks=await req('/oidc/jwks');assert.ok(verify('RSA-SHA256',Buffer.from(jwt[0]+'.'+jwt[1]),createPublicKey({key:jwks.keys[0],format:'jwk'}),Buffer.from(jwt[2],'base64url')));const claims=JSON.parse(Buffer.from(jwt[1],'base64url'));assert.equal(claims.nonce,authorization.nonce);assert.equal(claims.aud,client.id);
 const info=await req('/oidc/userinfo',{role:'external',headers:{Authorization:`Bearer ${oidc.access_token}`}});assert.equal(info.sub,users.athlete.id);assert.ok(info.roles.includes('ATHLETE'));assert.ok(!('email' in info));
 await post('/auth/logout',{},'athlete');await req('/oidc/userinfo',{role:'external',headers:{Authorization:`Bearer ${oidc.access_token}`},status:401});
 console.log(`Regional integration: ${checks} HTTP checks passed; PKCE, signed JWT, replay protection, scoped imports, audit outbox, training, appeals, awards and documents verified.`);
}catch(e){console.error(logs.slice(-6000));throw e;}finally{
 if(server){server.kill();await once(server,'exit').catch(()=>{});}
 await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await db.$disconnect();
}
