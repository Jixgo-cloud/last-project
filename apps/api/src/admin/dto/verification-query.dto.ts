import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { VerificationStatus } from '@smartcareer/shared';

export class VerificationQueryDto {
  @IsOptional()
  @IsEnum(VerificationStatus)
  status?: VerificationStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20;

  // Keep the previous array response during rolling frontend deployment.
  @IsOptional()
  @IsIn(['true', 'false'])
  paginated?: string;
}
