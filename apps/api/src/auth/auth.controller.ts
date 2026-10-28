import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SESSION_COOKIE } from "@fsp/shared";
import { Request, Response } from "express";
import { ok } from "../common/http";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./current-user.decorator";
import { LoginDto, SwitchRoleDto } from "./dto";
import { AuthUser } from "./auth.types";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(
      dto.email,
      dto.password,
      req.ip,
      req.headers["user-agent"],
    );
    res.cookie(SESSION_COOKIE, result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.SESSION_COOKIE_SECURE === undefined
        ? process.env.NODE_ENV === "production"
        : process.env.SESSION_COOKIE_SECURE === "true",
      path: "/",
      maxAge: Number(process.env.SESSION_TTL_HOURS ?? 12) * 60 * 60 * 1000,
    });
    return ok(result.user);
  }

  @UseGuards(AuthGuard)
  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return ok(user);
  }

  @UseGuards(AuthGuard)
  @Post("switch-role")
  async switchRole(@CurrentUser() user: AuthUser, @Body() dto: SwitchRoleDto) {
    return ok(await this.auth.switchRole(user, dto.role));
  }

  @UseGuards(AuthGuard)
  @Post("logout")
  async logout(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(user);
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    return ok({ loggedOut: true });
  }
}
