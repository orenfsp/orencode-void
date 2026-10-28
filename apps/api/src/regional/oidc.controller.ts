import { BadRequestException, Body, Controller, ForbiddenException, Get, Injectable, Param, Patch, Post, Query, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { createHash, createPrivateKey, generateKeyPairSync, randomBytes, sign } from 'crypto';
import { IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { Request, Response } from 'express';
import { PrismaService } from '../common/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { ok } from '../common/http';

export const tokenHash = (s: string) => createHash('sha256').update(s).digest('hex');
export const pkce = (s: string) => createHash('sha256').update(s).digest('base64url');
export function validateRedirect(uri: string) {
  let u: URL; try { u = new URL(uri); } catch { throw new BadRequestException('Некорректный redirect URI'); }
  if (u.hash || u.username || u.password || !(u.protocol === 'https:' || (u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname)))) throw new BadRequestException('Нужен HTTPS или localhost без fragment и credentials');
  return u;
}
class ClientDto {
  @IsString() @MinLength(2) @MaxLength(150) name!: string;
  @IsString() @MaxLength(2000) redirectUri!: string;
}
class AuthorizationDto {
  @IsUUID() client_id!: string;
  @IsString() @MaxLength(2000) redirect_uri!: string;
  @IsIn(['code']) response_type!: string;
  @IsIn(['S256']) code_challenge_method!: string;
  @Matches(/^[A-Za-z0-9_-]{43}$/) code_challenge!: string;
  @IsString() @MinLength(16) @MaxLength(512) state!: string;
  @IsString() @MinLength(16) @MaxLength(512) nonce!: string;
  @IsString() @MaxLength(150) scope!: string;
}
class ConsentDto extends AuthorizationDto { @IsIn(['approve', 'deny']) decision!: string; }
class TokenDto {
  @IsIn(['authorization_code']) grant_type!: string;
  @IsUUID() client_id!: string;
  @IsString() @MaxLength(2000) redirect_uri!: string;
  @IsString() @MaxLength(200) code!: string;
  @Matches(/^[A-Za-z0-9._~-]{43,128}$/) code_verifier!: string;
}

@Injectable()
export class OidcService {
  constructor(private readonly db: PrismaService) {}
  issuer() { return (process.env.OIDC_ISSUER ?? `${process.env.PUBLIC_API_URL ?? 'http://localhost:4000'}/api/oidc`).replace(/\/$/, ''); }
  async key() {
    let key = await this.db.oidcSigningKey.findUnique({ where: { id: 'rsa-1' } });
    if (!key) {
      const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
      key = await this.db.oidcSigningKey.upsert({ where: { id: 'rsa-1' }, update: {}, create: {
        id: 'rsa-1', privateKey: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
        publicKey: { ...pair.publicKey.export({ format: 'jwk' }), kid: 'rsa-1', use: 'sig', alg: 'RS256' },
      } });
    }
    return key;
  }
  async validate(dto: AuthorizationDto) {
    const client = await this.db.oidcClient.findUnique({ where: { id: dto.client_id } });
    if (!client?.active || client.redirectUri !== dto.redirect_uri) throw new BadRequestException('Клиент или адрес возврата не зарегистрирован');
    const scopes = dto.scope.split(' ');
    if (!scopes.includes('openid') || scopes.some(s => !['openid', 'profile', 'sport'].includes(s))) throw new BadRequestException('Недопустимые scopes');
    return client;
  }
  async consent(user: AuthUser, dto: ConsentDto) {
    await this.validate(dto);
    const redirect = new URL(dto.redirect_uri); redirect.searchParams.set('state', dto.state);
    if (dto.decision === 'deny') { redirect.searchParams.set('error', 'access_denied'); return redirect.toString(); }
    const code = randomBytes(32).toString('base64url');
    await this.db.$transaction(async tx => {
      await tx.oidcGrant.create({ data: { codeHash: tokenHash(code), userId: user.id, sessionId: user.sessionId, clientId: dto.client_id, redirectUri: dto.redirect_uri, challenge: dto.code_challenge, nonce: dto.nonce, scope: dto.scope, expiresAt: new Date(Date.now() + 120000) } });
      await tx.auditLog.create({ data: { userId: user.id, action: 'OIDC_CONSENT', entityType: 'OidcClient', entityId: dto.client_id, changes: { scope: dto.scope } } });
    });
    redirect.searchParams.set('code', code); return redirect.toString();
  }
  async exchange(dto: TokenDto) {
    const key = await this.key();
    const access = randomBytes(32).toString('base64url');
    const grant = await this.db.$transaction(async tx => {
      const grant = await tx.oidcGrant.findUnique({ where: { codeHash: tokenHash(dto.code) } });
      if (!grant || grant.usedAt || grant.expiresAt <= new Date() || grant.clientId !== dto.client_id || grant.redirectUri !== dto.redirect_uri || grant.challenge !== pkce(dto.code_verifier)) throw new UnauthorizedException('invalid_grant');
      const [client, session] = await Promise.all([
        tx.oidcClient.findUnique({ where: { id: grant.clientId } }),
        tx.session.findUnique({ where: { id: grant.sessionId }, include: { user: true } }),
      ]);
      if (!client?.active || !session?.user.isActive || session.revokedAt || session.expiresAt <= new Date()) throw new UnauthorizedException('invalid_grant');
      const consumed = await tx.oidcGrant.updateMany({ where: { id: grant.id, usedAt: null }, data: { usedAt: new Date() } });
      if (!consumed.count) throw new UnauthorizedException('invalid_grant');
      await tx.oidcAccessToken.create({ data: { tokenHash: tokenHash(access), userId: grant.userId, clientId: grant.clientId, sessionId: grant.sessionId, scope: grant.scope, expiresAt: new Date(Date.now() + 3600000) } });
      return grant;
    });
    const now = Math.floor(Date.now()/1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: key.id })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ iss: this.issuer(), sub: grant.userId, aud: grant.clientId, iat: now, exp: now + 3600, nonce: grant.nonce, at_hash: createHash('sha256').update(access).digest().subarray(0,16).toString('base64url') })).toString('base64url');
    const input = `${header}.${payload}`;
    return { access_token: access, token_type: 'Bearer', expires_in: 3600, scope: grant.scope, id_token: `${input}.${sign('RSA-SHA256', Buffer.from(input), createPrivateKey(key.privateKey)).toString('base64url')}` };
  }
  async userinfo(header?: string) {
    const value = header?.match(/^Bearer ([A-Za-z0-9_-]+)$/)?.[1];
    const token = value ? await this.db.oidcAccessToken.findUnique({ where: { tokenHash: tokenHash(value) } }) : null;
    if (!token || token.expiresAt <= new Date()) throw new UnauthorizedException('invalid_token');
    const [client, session, user] = await Promise.all([
      this.db.oidcClient.findUnique({ where: { id: token.clientId } }),
      this.db.session.findUnique({ where: { id: token.sessionId } }),
      this.db.user.findUnique({ where: { id: token.userId }, include: {
        roles: { include: { role: true } },
        athlete: { include: { disciplines: { include: { discipline: true } }, ranks: { where: { expiresAt: { gt: new Date() }, assignedAt: { lte: new Date() } }, orderBy: { assignedAt: 'desc' }, take: 1 } } },
        coach: { include: { disciplines: { include: { discipline: true } } } },
      } }),
    ]);
    if (!client?.active || !user?.isActive || !session || session.revokedAt || session.expiresAt <= new Date()) throw new UnauthorizedException('invalid_token');
    return { sub: user.id,
      ...(token.scope.split(' ').includes('profile') ? { name: [user.lastName,user.firstName,user.middleName].filter(Boolean).join(' '), given_name: user.firstName, family_name: user.lastName } : {}),
      ...(token.scope.split(' ').includes('sport') ? { roles: user.roles.map(r => r.role.code), disciplines: [...new Set([...(user.athlete?.disciplines ?? []), ...(user.coach?.disciplines ?? [])].map(d => d.discipline.name))], rank: user.athlete?.ranks[0]?.rankType ?? null } : {}),
    };
  }
}

@Controller('oidc')
export class OidcController {
  constructor(private readonly oidc: OidcService, private readonly db: PrismaService) {}
  @Get('.well-known/openid-configuration') discovery() {
    const issuer=this.oidc.issuer(); return { issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`, userinfo_endpoint: `${issuer}/userinfo`, jwks_uri: `${issuer}/jwks`, response_types_supported: ['code'], grant_types_supported: ['authorization_code'], subject_types_supported: ['public'], id_token_signing_alg_values_supported: ['RS256'], code_challenge_methods_supported: ['S256'], scopes_supported: ['openid','profile','sport'], token_endpoint_auth_methods_supported: ['none'] };
  }
  @Get('jwks') async jwks() { return { keys: [(await this.oidc.key()).publicKey] }; }
  @Get('authorize') async authorize(@Query() dto: AuthorizationDto, @Res() res: Response) {
    await this.oidc.validate(dto);
    const url = new URL('/fsp-consent', process.env.PUBLIC_WEB_URL ?? 'http://localhost:3000');
    Object.entries(dto).forEach(([k,v]) => url.searchParams.set(k,v)); res.redirect(url.toString());
  }
  @Get('consent') @UseGuards(AuthGuard) async consentDetails(@Query() dto: AuthorizationDto) { const c = await this.oidc.validate(dto); return ok({ name: c.name, scope: dto.scope, redirectUri: c.redirectUri }); }
  @Post('consent') @UseGuards(AuthGuard) async consent(@CurrentUser() user: AuthUser, @Body() dto: ConsentDto) { return ok({ redirect: await this.oidc.consent(user, dto) }); }
  @Post('token') async token(@Body() dto: TokenDto, @Res() res: Response) {
    res.setHeader('Cache-Control','no-store'); res.setHeader('Pragma','no-cache');
    try { return res.status(200).json(await this.oidc.exchange(dto)); } catch (e) { if (e instanceof UnauthorizedException) return res.status(400).json({ error:'invalid_grant' }); throw e; }
  }
  @Get('userinfo') async userinfo(@Req() req: Request, @Res() res: Response) {
    res.setHeader('Cache-Control','no-store');
    try { return res.json(await this.oidc.userinfo(req.headers.authorization)); } catch(e) { if (e instanceof UnauthorizedException) return res.status(401).setHeader('WWW-Authenticate','Bearer error="invalid_token"').json({ error:'invalid_token' }); throw e; }
  }
  @Get('clients') @UseGuards(AuthGuard,RolesGuard) @Roles('FEDERATION') async clients() { return ok(await this.db.oidcClient.findMany()); }
  @Post('clients') @UseGuards(AuthGuard,RolesGuard) @Roles('FEDERATION') async create(@Body() dto: ClientDto) { validateRedirect(dto.redirectUri); return ok(await this.db.oidcClient.create({ data: dto })); }
  @Patch('clients/:id/revoke') @UseGuards(AuthGuard,RolesGuard) @Roles('FEDERATION') async revoke(@Param('id') id: string) { return ok(await this.db.oidcClient.update({ where: { id }, data: { active: false } })); }
}
