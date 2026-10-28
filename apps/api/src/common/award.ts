import { BadRequestException } from "@nestjs/common";
import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class AwardDatesDto {
  @IsOptional() @IsDateString() assignedAt?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @IsString() @MaxLength(200) orderNumber?: string;
}

export function awardDates(input?: AwardDatesDto) {
  if (!input?.assignedAt || !input.expiresAt || !input.orderNumber?.trim()) {
    throw new BadRequestException(
      "Для присвоения укажите даты действия и номер приказа",
    );
  }
  const assignedAt = new Date(input.assignedAt);
  const expiresAt = new Date(input.expiresAt);
  if (
    !Number.isFinite(assignedAt.getTime()) ||
    !Number.isFinite(expiresAt.getTime()) ||
    expiresAt <= assignedAt
  ) {
    throw new BadRequestException(
      "Окончание действия должно быть позже даты присвоения",
    );
  }
  return { assignedAt, expiresAt, orderNumber: input.orderNumber.trim() };
}
