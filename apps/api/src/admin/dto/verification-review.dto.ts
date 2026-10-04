import { Transform } from 'class-transformer';
import { IsIn, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class VerificationReviewDto {
  @IsIn(['APPROVE', 'REJECT'])
  action!: 'APPROVE' | 'REJECT';

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @ValidateIf(body => body.action === 'REJECT' || body.reason !== undefined)
  @IsString()
  @MinLength(10, { message: 'กรุณาระบุเหตุผลที่บริษัทนำไปแก้ไขได้ อย่างน้อย 10 ตัวอักษร' })
  @MaxLength(2000)
  reason?: string;
}
