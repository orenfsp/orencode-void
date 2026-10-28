import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AuthUser } from "../auth/auth.types";
import { ok } from "../common/http";
import { NotificationsService } from "../common/notifications.service";
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";
import { Transform } from "class-transformer";
import { UsersService } from "./users.service";

class AccountDto {
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;
  @IsString() @MinLength(1) @MaxLength(100) firstName!: string;
  @IsString() @MinLength(1) @MaxLength(100) lastName!: string;
  @IsOptional() @IsString() @MaxLength(100) middleName?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(RoleCode, { each: true })
  roles!: RoleCode[];
  @IsBoolean() isActive!: boolean;
  @IsOptional() @IsString() @MinLength(10) @MaxLength(72) password?: string;
  @IsOptional() @IsUUID() athleteId?: string;
  @IsOptional() @IsDateString() updatedAt?: string;
}

@ApiTags("users")
@UseGuards(AuthGuard, RolesGuard)
@Controller()
export class UsersController {
  constructor(
    private readonly accounts: UsersService,
    private readonly notifications: NotificationsService,
  ) {}

  @Roles(RoleCode.FEDERATION)
  @Get("users")
  async users() {
    return ok(await this.accounts.list());
  }

  @Roles(RoleCode.FEDERATION)
  @Get("users/available-athletes")
  async availableAthletes(@Query("q") q?: string) {
    return ok(await this.accounts.availableAthletes(q));
  }

  @Roles(RoleCode.FEDERATION)
  @Post("users")
  async create(@CurrentUser() user: AuthUser, @Body() dto: AccountDto) {
    return ok(await this.accounts.save(user, dto));
  }

  @Roles(RoleCode.FEDERATION)
  @Put("users/:id")
  async update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: AccountDto,
  ) {
    return ok(await this.accounts.save(user, dto, id));
  }

  @Get("notifications")
  async notificationsList(
    @CurrentUser() user: AuthUser,
    @Query("unread") unread?: string,
  ) {
    return ok(await this.notifications.list(user.id, unread === "true"));
  }
}
