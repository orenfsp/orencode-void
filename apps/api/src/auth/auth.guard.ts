import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { SESSION_COOKIE } from "@fsp/shared";
import { Request } from "express";
import { AuthService } from "./auth.service";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: unknown }>();
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (!token) {
      throw new UnauthorizedException("Требуется авторизация");
    }
    const user = await this.auth.resolveSession(token);
    if (!user) {
      throw new UnauthorizedException("Сессия недействительна");
    }
    req.user = user;
    return true;
  }
}
