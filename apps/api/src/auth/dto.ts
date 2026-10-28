import { RoleCode } from "@prisma/client";
import { IsEmail, IsEnum, IsString, MinLength } from "class-validator";

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class SwitchRoleDto {
  @IsEnum(RoleCode)
  role!: RoleCode;
}
