import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { CouponDiscountType } from '@prisma/client';

const DISCOUNT_TYPES: CouponDiscountType[] = ['PERCENTAGE', 'FIXED_AMOUNT'];
const CODE_PATTERN = /^[A-ZА-ЯЁ0-9_-]+$/u;

// Код-ийг ЗАСВАРЛАХ боломжтой (жиш: алдаатай бичсэнийг залруулах), гэхдээ
// usageCount-ыг ГАДНААС ирсэн утгаар шууд ДАРЖ БИЧИХ боломжгүй (энэ
// талбар зөвхөн app_redeem_coupon() SECURITY DEFINER функцээр л
// нэмэгддэг, DTO-д ОРООГҮЙ).
export class UpdateCouponDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  @Matches(CODE_PATTERN, {
    message: 'Код зөвхөн том үсэг (Латин/Кирилл), тоо, "-"/"_" агуулж болно',
  })
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsIn(DISCOUNT_TYPES)
  discountType?: CouponDiscountType;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  discountValue?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  maxDiscountAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  usageLimit?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  usageLimitPerCustomer?: number;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
