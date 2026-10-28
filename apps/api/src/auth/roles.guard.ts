import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RoleCode } from "@prisma/client";
import { ROLES_KEY } from "./roles.decorator";
import { AuthUser } from "./auth.types";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<RoleCode[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) {
      return true;
    }
    const user = context.switchToHttp().getRequest<{ user: AuthUser }>().user;
    if (
      !user ||
      !roles.includes(user.activeRole) ||
      !user.roles.includes(user.activeRole)
    ) {
      throw new ForbiddenException("Недостаточно прав для этого действия");
    }
    if (!roles.some((role) => user.roles.includes(role))) {
      throw new ForbiddenException("Недостаточно прав для этого действия");
    }
    return true;
  }
}
