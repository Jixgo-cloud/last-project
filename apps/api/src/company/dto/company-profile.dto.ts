import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

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

export class SubmitCompanyVerificationDto {
  @IsString()
  @IsNotEmpty({ message: 'businessRegNo is required' })
  businessRegNo!: string;

  @IsOptional()
  documents?: any;
}
