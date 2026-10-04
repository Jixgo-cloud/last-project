import { ArrayMaxSize, IsArray, IsObject, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class UpdateCandidateProfileDto {
  @ValidateIf((_o, value) => value !== undefined) @IsString() @MinLength(1) @MaxLength(200) fullName?: string;
  @IsOptional() @IsString() @MaxLength(300) headline?: string;
  @IsOptional() @IsString() @MaxLength(10000) bio?: string;
  @IsOptional() @IsString() @MaxLength(200) targetCareer?: string;
  @IsOptional() @IsString() @Matches(/^@?[a-zA-Z0-9-]{1,39}$/) githubUsername?: string;
  @IsOptional() @IsString() @MaxLength(2_000_000) avatarUrl?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsObject({ each: true }) education?: Record<string, unknown>[];
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsObject({ each: true }) experience?: Record<string, unknown>[];
}
