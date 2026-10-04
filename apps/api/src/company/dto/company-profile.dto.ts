import { ArrayMaxSize, ArrayMinSize, IsArray, IsDefined, IsIn, IsInt, IsString, IsOptional, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { VERIFICATION_MAX_BYTES, VERIFICATION_MAX_FILES, VERIFICATION_MIME_TYPES } from '@smartcareer/shared';

export class UpdateCompanyProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;
}

export class VerificationFileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsIn(VERIFICATION_MIME_TYPES)
  type!: string;

  @IsInt()
  @Min(1)
  @Max(VERIFICATION_MAX_BYTES)
  size!: number;

  @IsString()
  @MaxLength(Math.ceil(VERIFICATION_MAX_BYTES / 3) * 4 + 50)
  dataUrl!: string;
}

export class VerificationDocumentsDto {
  // Accept metadata from the previous frontend; the service generates its own.
  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  submittedAt?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'กรุณาแนบเอกสารอย่างน้อย 1 ไฟล์' })
  @ArrayMaxSize(VERIFICATION_MAX_FILES)
  @ValidateNested({ each: true })
  @Type(() => VerificationFileDto)
  files!: VerificationFileDto[];
}

export class SubmitCompanyVerificationDto {
  @Matches(/^[0-9]{13}$/, { message: 'เลขทะเบียนหรือเลขผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก' })
  businessRegNo!: string;

  @IsDefined({ message: 'กรุณาแนบเอกสารประกอบคำขอ' })
  @ValidateNested()
  @Type(() => VerificationDocumentsDto)
  documents!: VerificationDocumentsDto;
}
