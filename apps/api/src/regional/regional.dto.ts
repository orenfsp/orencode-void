import { IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, IsUrl, Max, MaxLength, Min, MinLength, ValidateNested, ArrayMaxSize, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class GroupDto {
  @IsUUID() disciplineId!: string;
  @IsString() @MinLength(2) @MaxLength(200) name!: string;
  @IsUUID() organizationId!: string;
  @IsUUID() coachId!: string;
  @IsIn(['INITIAL','TRAINING','PERFECTION','MASTERY']) stage!: string;
}
export class MemberDto { @IsUUID() athleteId!: string; }
export class LessonDto {
  @IsIn(['IN_PERSON','ONLINE']) format!: string;
  @IsUrl({protocols:['https'],require_protocol:true}) @MaxLength(2000) evidenceUrl!: string;
  @IsDateString() startsAt!: string;
  @IsString() @MinLength(2) @MaxLength(1000) topic!: string;
  @IsInt() @Min(1) @Max(1440) minutes!: number;
}
export class AttendanceDto {
  @IsUUID() memberId!: string;
  @IsBoolean() present!: boolean;
}
export class StandardDto {
  @IsUUID() disciplineId!: string;
  @IsIn(['M','F']) sex!: string;
  @IsInt() @Min(0) @Max(100) minAge!: number;
  @IsInt() @Min(0) @Max(100) maxAge!: number;
  @IsString() @MinLength(2) @MaxLength(200) title!: string;
  @IsIn(['INITIAL','TRAINING','PERFECTION','MASTERY']) stage!: string;
  @IsString() @MinLength(1) @MaxLength(50) unit!: string;
  @IsNumber() threshold!: number;
  @IsIn(['GTE', 'LTE']) comparison!: 'GTE' | 'LTE';
  @IsString() @MinLength(5) @MaxLength(2000) source!: string;
}
export class AssessmentDto extends MemberDto {
  @IsUUID() standardId!: string;
  @IsNumber() value!: number;
  @IsDateString() assessedAt!: string;
}
export class ProgramDto {
  @IsString() @MinLength(2) @MaxLength(200) title!: string;
  @IsInt() @Min(2000) @Max(2200) season!: number;
  @IsString() @MinLength(5) @MaxLength(5000) criteria!: string;
  @IsString() @MinLength(5) @MaxLength(2000) source!: string;
  @IsDateString() closesAt!: string;
}
export class RequestDto {
  @IsUUID() competitionId!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @IsUrl({protocols:['https'],require_protocol:true},{each:true}) evidenceUrls!: string[];
  @IsIn(['APPEAL', 'VIOLATION', 'AWARD']) kind!: 'APPEAL' | 'VIOLATION' | 'AWARD';
  @IsString() @MinLength(2) @MaxLength(200) title!: string;
  @IsString() @MinLength(5) @MaxLength(5000) description!: string;
  @IsOptional() @IsUUID() athleteId?: string;
  @IsOptional() @IsUUID() programId?: string;
}
export class DecisionDto {
  @IsOptional() @IsNumber() correctedScore?: number;
  @IsIn(['NONE','DISQUALIFICATION','TECHNICAL_LOSS']) sanction!: string;
  @IsOptional() @IsDateString() sanctionEndsAt?: string;
  @IsIn(['APPROVED', 'REJECTED']) status!: 'APPROVED' | 'REJECTED';
  @IsString() @MinLength(5) @MaxLength(5000) decision!: string;
}
export class TransferDto { @IsUUID() athleteId!:string; @IsUUID() targetGroupId!:string; }
export class SexDto { @IsIn(['M','F']) sex!:string; }
export class OrganizationDetailsDto {
  @IsString() @MinLength(2) @MaxLength(2000) license!:string;
  @IsString() @MinLength(2) @MaxLength(5000) programs!:string;
}
export class EvidenceDto {
  @IsInt() @Min(2000) @Max(2200) year!:number;
  @IsIn(['HEADCOUNT','ORGANIZATIONS','COMPETITIONS']) indicator!:string;
  @IsString() @MinLength(2) @MaxLength(200) title!:string;
  @IsUrl({protocols:['https'],require_protocol:true}) @MaxLength(2000) url!:string;
}
export class AwardRuleDto {
  @IsIn(['RUSSIA_CHAMPIONSHIP','RUSSIA_YOUTH','INTERREGIONAL','REGIONAL']) band!:'RUSSIA_CHAMPIONSHIP'|'RUSSIA_YOUTH'|'INTERREGIONAL'|'REGIONAL';
  @IsInt() @Min(1) @Max(3) place!:number;
  @IsNumber({maxDecimalPlaces:2}) @Min(0.01) @Max(10000000) amount!:number;
  @IsInt() @Min(1) @Max(100000) minParticipants!:number;
  @IsString() @MinLength(5) @MaxLength(2000) source!:string;
}
export class PetitionDto { @IsInt() @Min(2000) @Max(2200) year!:number; }
export class PetitionStatusDto {
  @IsIn(['SENT','AWARDED']) status!:string;
  @IsString() @MinLength(5) @MaxLength(2000) comment!:string;
}
export class RankRequirementDto {
  @IsString() @MinLength(1) @MaxLength(100) rankType!:string;
  @IsString() @MinLength(5) @MaxLength(5000) description!:string;
  @IsString() @MinLength(5) @MaxLength(2000) sourceNote!:string;
}
export class ScenarioDto {
  @IsString() @MinLength(2) @MaxLength(200) title!: string;
  @IsString() @MinLength(5) @MaxLength(5000) description!: string;
  @IsString() @MinLength(5) @MaxLength(10000) steps!: string;
}
export class MappingDto {
  @IsString() @MinLength(1) @MaxLength(100) system!: string;
  @IsString() @MinLength(1) @MaxLength(200) externalId!: string;
  @IsUUID() regionalId!: string;
}
export class ImportDto {
  @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => MappingDto)
  mappings!: MappingDto[];
}
