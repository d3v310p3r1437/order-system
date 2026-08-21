import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Coupon } from '@prisma/client';
import {
  isRecordNotFoundError,
  isUniqueConstraintViolation,
} from '../common/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { computeCouponDiscountAmount } from './coupon-discount.util.js';
import type { CreateCouponDto } from './dto/create-coupon.dto.js';
import type { UpdateCouponDto } from './dto/update-coupon.dto.js';

const COUPON_NOT_FOUND = {
  code: 'COUPON_NOT_FOUND',
  message: 'Купон олдсонгүй',
};
const COUPON_CODE_TAKEN = {
  code: 'COUPON_CODE_TAKEN',
  message: 'Энэ купон код аль хэдийн бүртгэгдсэн байна',
};
const INVALID_DISCOUNT_VALUE = {
  code: 'INVALID_DISCOUNT_VALUE',
  message:
    'Хувиар хямдруулах (PERCENTAGE) купоны утга 0-100 хооронд байх ёстой',
};
const INVALID_VALID_RANGE = {
  code: 'INVALID_COUPON_DATE_RANGE',
  message: 'validFrom нь validTo-оос өмнө байх ёстой',
};
const COUPON_INACTIVE = {
  code: 'COUPON_INACTIVE',
  message: 'Купон идэвхгүй байна',
};
const COUPON_NOT_YET_VALID = {
  code: 'COUPON_NOT_YET_VALID',
  message: 'Купоны хугацаа хараахан эхлээгүй байна',
};
const COUPON_EXPIRED = {
  code: 'COUPON_EXPIRED',
  message: 'Купоны хугацаа дууссан байна',
};
const COUPON_MIN_ORDER_NOT_MET = {
  code: 'COUPON_MIN_ORDER_NOT_MET',
  message: 'Захиалгын дүн купон хэрэглэх доод хэмжээнд хүрэхгүй байна',
};
const COUPON_USAGE_LIMIT_REACHED = {
  code: 'COUPON_USAGE_LIMIT_REACHED',
  message: 'Купоны нийт ашиглалтын хязгаар дууссан байна',
};
const COUPON_ALREADY_USED = {
  code: 'COUPON_ALREADY_USED',
  message: 'Та энэ купоныг аль хэдийн ашигласан байна',
};
const COUPON_REDEMPTION_FAILED = {
  code: 'COUPON_REDEMPTION_FAILED',
  message:
    'Купон ашиглах боломжгүй боллоо (хугацаа/хязгаар өөрчлөгдсөн байж болзошгүй)',
};

export interface ValidatedCoupon {
  coupon: Coupon;
  discountAmount: Prisma.Decimal;
}

// docs/plan.md §7 модуль #10, §6.1 матриц "Урамшуулал/купон" мөр.
// OrderService.checkout()-той хамтран ажиллана: (1) validateForCheckout()
// нь READ-ONLY урьдчилсан шалгалт (invoice үүсгэхээс өмнө, subtotal
// тодорхойлогдсоны дараа дуудагдана), (2) redeemAtomic() нь
// app_redeem_coupon() SECURITY DEFINER SQL функцээр ATOMIC (race-safe)
// usageCount increment + coupon_redemptions мөр бичих цорын ганц зам
// (enable_coupons_rls migration-ийг үз, ADR 005 WRITE ангилал).
@Injectable()
export class CouponService {
  constructor(private readonly prisma: PrismaService) {}

  // coupons_select RLS дүрд харагдахгүй мөрийг өөрөө шүүнэ (CUSTOMER
  // зөвхөн идэвхтэй+хугацаанд байгаа мөр харна) — @Roles()-гүй controller
  // route-тэй хослуулна.
  findAll() {
    return this.prisma.tx.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string): Promise<Coupon> {
    const coupon = await this.prisma.tx.coupon.findUnique({ where: { id } });
    if (!coupon) {
      throw new NotFoundException(COUPON_NOT_FOUND);
    }
    return coupon;
  }

  async create(dto: CreateCouponDto, createdByUserId: string): Promise<Coupon> {
    this.validateDiscountValue(dto.discountType, dto.discountValue);
    this.validateDateRange(dto.validFrom, dto.validTo);

    try {
      return await this.prisma.tx.coupon.create({
        data: {
          code: normalizeCode(dto.code),
          description: dto.description,
          discountType: dto.discountType,
          discountValue: dto.discountValue,
          maxDiscountAmount: dto.maxDiscountAmount,
          minOrderAmount: dto.minOrderAmount,
          usageLimit: dto.usageLimit,
          usageLimitPerCustomer: dto.usageLimitPerCustomer ?? 1,
          validFrom: new Date(dto.validFrom),
          validTo: new Date(dto.validTo),
          isActive: dto.isActive ?? true,
          createdByUserId,
        },
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException(COUPON_CODE_TAKEN);
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateCouponDto): Promise<Coupon> {
    const existing = await this.findOne(id);
    const discountType = dto.discountType ?? existing.discountType;
    const discountValue = dto.discountValue ?? existing.discountValue;
    this.validateDiscountValue(discountType, discountValue);

    const validFrom = dto.validFrom
      ? new Date(dto.validFrom)
      : existing.validFrom;
    const validTo = dto.validTo ? new Date(dto.validTo) : existing.validTo;
    if (validFrom.getTime() >= validTo.getTime()) {
      throw new BadRequestException(INVALID_VALID_RANGE);
    }

    try {
      return await this.prisma.tx.coupon.update({
        where: { id },
        data: {
          code: dto.code ? normalizeCode(dto.code) : undefined,
          description: dto.description,
          discountType: dto.discountType,
          discountValue: dto.discountValue,
          maxDiscountAmount: dto.maxDiscountAmount,
          minOrderAmount: dto.minOrderAmount,
          usageLimit: dto.usageLimit,
          usageLimitPerCustomer: dto.usageLimitPerCustomer,
          validFrom: dto.validFrom ? validFrom : undefined,
          validTo: dto.validTo ? validTo : undefined,
          isActive: dto.isActive,
        },
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw new NotFoundException(COUPON_NOT_FOUND);
      }
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException(COUPON_CODE_TAKEN);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<Coupon> {
    try {
      return await this.prisma.tx.coupon.delete({ where: { id } });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw new NotFoundException(COUPON_NOT_FOUND);
      }
      throw error;
    }
  }

  // GET /coupons/validate-д (checkout-ийн өмнөх урьдчилсан харах, мутаци
  // ХИЙХГҮЙ) БОЛОН OrderService.checkout()-ийн invoice үүсгэхээс өмнөх
  // урьдчилсан шалгалтад аль алинд нь дахин ашиглагдана — ганц газар л
  // шийдвэрлэнэ (ADR 005-ийн "ганц газар л шийднэ" зарчим).
  //
  // customerId=null үед (staff урьдчилан харах) зөвхөн "1 хэрэглэгчид
  // хэдэн удаа" шалгалтыг алгасна — бодит redeem зөвхөн CUSTOMER-ийн
  // checkout-оор л явагддаг тул staff-ийн preview-д энэ шалгалт хамааралгүй.
  async validateForCheckout(
    code: string,
    orderAmount: Prisma.Decimal,
    customerId: string | null,
  ): Promise<ValidatedCoupon> {
    const coupon = await this.prisma.tx.coupon.findUnique({
      where: { code: normalizeCode(code) },
    });
    if (!coupon) {
      throw new NotFoundException(COUPON_NOT_FOUND);
    }
    if (!coupon.isActive) {
      throw new BadRequestException(COUPON_INACTIVE);
    }
    const now = new Date();
    if (now < coupon.validFrom) {
      throw new BadRequestException(COUPON_NOT_YET_VALID);
    }
    if (now > coupon.validTo) {
      throw new BadRequestException(COUPON_EXPIRED);
    }
    if (
      coupon.minOrderAmount != null &&
      orderAmount.lt(coupon.minOrderAmount)
    ) {
      throw new BadRequestException({
        ...COUPON_MIN_ORDER_NOT_MET,
        details: { minOrderAmount: coupon.minOrderAmount.toString() },
      });
    }
    if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit) {
      throw new ConflictException(COUPON_USAGE_LIMIT_REACHED);
    }
    if (customerId) {
      const redemptionCount = await this.prisma.tx.couponRedemption.count({
        where: { couponId: coupon.id, customerId },
      });
      if (redemptionCount >= coupon.usageLimitPerCustomer) {
        throw new ConflictException(COUPON_ALREADY_USED);
      }
    }

    const discountAmount = computeCouponDiscountAmount(coupon, orderAmount);
    return { coupon, discountAmount };
  }

  // OrderService.checkout()-ийн withSavepoint дотор, Order мөр аль хэдийн
  // үүссэний ДАРАА дуудагдана (app_redeem_coupon()-ий FK шалгалт
  // "p_order_id нь p_customer_id-ийн ЖИНХЭНЭ захиалга байх ёстой" гэдгийг
  // хангахын тулд). false буцвал (race-д ялагдсан, эсвэл validateForCheckout()-ийн
  // дараа хугацаа/хязгаар өөрчлөгдсөн) дуудагч ConflictException шидэж
  // withSavepoint rollback хийлгэнэ.
  async redeemAtomic(
    couponId: string,
    orderId: string,
    customerId: string,
    discountAmount: Prisma.Decimal,
  ): Promise<void> {
    const redemptionId = randomUUID();
    const rows = await this.prisma.tx.$queryRaw<
      { app_redeem_coupon: number }[]
    >`
      SELECT app_redeem_coupon(${couponId}, ${orderId}, ${customerId}, ${discountAmount.toString()}::numeric, ${redemptionId})
    `;
    const claimed = (rows[0]?.app_redeem_coupon ?? 0) === 1;
    if (!claimed) {
      throw new ConflictException(COUPON_REDEMPTION_FAILED);
    }
  }

  private validateDiscountValue(
    discountType: string,
    discountValue: Prisma.Decimal | number | string,
  ): void {
    if (discountType !== 'PERCENTAGE') {
      return;
    }
    const value = new Prisma.Decimal(discountValue);
    if (value.lt(0) || value.gt(100)) {
      throw new BadRequestException(INVALID_DISCOUNT_VALUE);
    }
  }

  private validateDateRange(validFrom: string, validTo: string): void {
    if (new Date(validFrom).getTime() >= new Date(validTo).getTime()) {
      throw new BadRequestException(INVALID_VALID_RANGE);
    }
  }
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}
