import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional,
  IsString, IsUUID, Max, MaxLength, Min, ValidateNested, ValidateIf,
} from 'class-validator';
import { optionalNumber } from './job.dto';
import { Transform } from 'class-transformer';

class ChoiceDto {
  @IsOptional() @IsUUID() id?: string;
  @IsString() @MaxLength(4000) text!: string;
  @IsBoolean() isCorrect!: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(20) order?: number;
}

class QuestionDto {
  @IsOptional() @IsUUID() id?: string;
  @ValidateIf((_o, value) => value !== undefined) @IsString() @MaxLength(500) title?: string;
  @IsString() @MaxLength(50000) prompt!: string;
  @IsOptional() @IsIn(['EASY', 'MEDIUM', 'HARD']) difficulty?: string;
  @Transform(optionalNumber) @IsInt() @Min(1) @Max(10000) points!: number;
  @IsOptional() @IsString() @MaxLength(200000) starterCode?: string;
  @IsOptional() @IsString() @MaxLength(200000) solutionCode?: string;
  @IsOptional() @IsString() @MaxLength(30000) explanation?: string;
  @IsOptional() @IsIn(['AUTOMATED_TEST_CASES', 'OPEN_ENDED']) evaluationMethod?: string;
  @IsOptional() @IsObject() rubric?: Record<string, unknown>;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsObject({ each: true }) testCases?: Record<string, unknown>[];
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => ChoiceDto) choices?: ChoiceDto[];
}

export class CompanyAssessmentDto {
  @ValidateIf((_o, value) => value !== undefined) @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(30000) description?: string;
  @IsOptional() @IsString() @MaxLength(200) slug?: string;
  @ValidateIf((_o, value) => value !== undefined) @IsIn(['THEORY', 'PRACTICAL_CODING']) type?: string;
  @IsOptional() @IsUUID() skillId?: string;
  @ValidateIf((_o, value) => value !== undefined) @Transform(optionalNumber) @IsInt() @Min(1) @Max(240) timeLimitMinutes?: number;
  @ValidateIf((_o, value) => value !== undefined) @Transform(optionalNumber) @IsInt() @Min(0) @Max(100) passingScore?: number;
  @ValidateIf((_o, value) => value !== undefined) @IsIn(['IMMEDIATE', 'AFTER_REVIEW', 'PRIVATE_TO_COMPANY']) feedbackVisibility?: string;
  @ValidateIf((_o, value) => value !== undefined) @IsBoolean() isActive?: boolean;
  @ValidateIf((_o, value) => value !== undefined) @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => QuestionDto) questions?: QuestionDto[];
}
