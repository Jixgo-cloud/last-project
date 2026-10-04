import { IsEmail, IsNotEmpty, IsString, IsOptional, IsIn, MinLength, MaxLength, Matches } from 'class-validator';
import { UserRole } from '@smartcareer/shared';

export class RegisterDto {
  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(12, { message: 'Password must be at least 12 characters' })
  @MaxLength(72)
  password!: string;

  @IsIn([UserRole.CANDIDATE, UserRole.COMPANY])
  role!: UserRole;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  targetCareer?: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MaxLength(72)
  password!: string;
}

export class DevOAuthCallbackDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['google', 'github'])
  provider!: 'google' | 'github';

  @IsIn([UserRole.CANDIDATE, UserRole.COMPANY])
  role!: UserRole;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  githubUsername?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

export class OAuthExchangeDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  code!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43,128}$/)
  verifier!: string;
}
