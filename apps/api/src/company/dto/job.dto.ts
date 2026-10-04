import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsEnum, IsInt, IsOptional,
  IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested, ValidateIf,
} from 'class-validator';
import { JobType } from '@smartcareer/shared';

export const optionalNumber = ({ value }: { value: unknown }) =>
  value === '' || value === null ? null : typeof value === 'string' ? Number(value) : value;

class JobSkillDto {
  @IsUUID() skillId!: string;
  @ValidateIf((_o, value) => value !== undefined) @IsBoolean() isRequired?: boolean;
  @IsOptional() @Transform(optionalNumber) @IsInt() @Min(0) @Max(100) minimumScore?: number;
}

class JobFieldsDto {
  @IsOptional() @IsString() @MaxLength(30000) requirements?: string;
  @IsOptional() @IsString() @MaxLength(30000) benefits?: string;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
  @ValidateIf((_o, value) => value !== undefined) @IsBoolean() isRemote?: boolean;
  @ValidateIf((_o, value) => value !== undefined) @IsEnum(JobType) employmentType?: JobType;
  @IsOptional() @Transform(optionalNumber) @IsInt() @Min(0) @Max(1_000_000_000) salaryMin?: number | null;
  @IsOptional() @Transform(optionalNumber) @IsInt() @Min(0) @Max(1_000_000_000) salaryMax?: number | null;
  @ValidateIf((_o, value) => value !== undefined) @IsString() @MinLength(3) @MaxLength(3) salaryCurrency?: string;
  @IsOptional() @Transform(optionalNumber) @IsInt() @Min(1) @Max(100000) acceptedQuota?: number | null;
  @IsOptional() @IsUUID() customAssessmentId?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ArrayUnique((skill: JobSkillDto) => skill.skillId)
  @ValidateNested({ each: true }) @Type(() => JobSkillDto) skills?: JobSkillDto[];
}

export class CreateJobDto extends JobFieldsDto {
  @IsString() @MinLength(2) @MaxLength(200) title!: string;
  @IsString() @MinLength(10) @MaxLength(30000) description!: string;
}

export class UpdateJobDto extends JobFieldsDto {
  @ValidateIf((_o, value) => value !== undefined) @IsString() @MinLength(2) @MaxLength(200) title?: string;
  @ValidateIf((_o, value) => value !== undefined) @IsString() @MinLength(10) @MaxLength(30000) description?: string;
}
