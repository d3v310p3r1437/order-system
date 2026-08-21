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

// Код-той URL/SMS-д бичихэд эвгүй тэмдэгт орохоос сэргийлж А-Я/A-Z/0-9/'-'/'_'
// -ээр хязгаарлав (CouponService.normalizeCode()-д UPPERCASE болгож хадгална).
const CODE_PATTERN = /^[A-ZА-ЯЁ0-9_-]+$/u;

// ⚠️ discountType=PERCENTAGE үед discountValue 0-100 хооронд байх ёстой
// гэсэн шалгалт DTO decorator-оор БИШ (checkout-order.dto.ts-ийн
// IsDeliveryField-тэй адил "нэг талбар нөгөө талбараас хамаарна" тохиолдол,
// гэхдээ энд аюулгүй байдлын критик биш энгийн бизнес дүрэм тул custom
// validator зохиохгүй) CouponService.validateDiscountValue()-д шалгана.
export class CreateCouponDto {
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  @Matches(CODE_PATTERN, {
    message: 'Код зөвхөн том үсэг (Латин/Кирилл), тоо, "-"/"_" агуулж болно',
  })
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsIn(DISCOUNT_TYPES)
  discountType!: CouponDiscountType;

  @IsNumber()
  @IsPositive()
  discountValue!: number;

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

  @IsDateString()
  validFrom!: string;

  @IsDateString()
  validTo!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
