import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Audit } from '../common/audit.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RequestContextService } from '../common/request-context.js';
import { Roles } from '../common/roles.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { resolveUserRoleNames } from '../common/user-roles.js';
import { CouponService } from './coupon.service.js';
import { CreateCouponDto } from './dto/create-coupon.dto.js';
import { UpdateCouponDto } from './dto/update-coupon.dto.js';

const INVALID_ORDER_AMOUNT = {
  code: 'INVALID_ORDER_AMOUNT',
  message: 'orderAmount буруу байна',
};

// §6.1 матриц "Урамшуулал/купон" мөр: SUPER_ADMIN CRUD, OWNER RU,
// ALL_BRANCH_MANAGER CRUD (бүх), BRANCH_ADMIN R, BRANCH_MANAGER/
// SALESPERSON "—", CUSTOMER R (идэвхтэй) — coupons_select RLS дүрд
// харагдахгүй мөрийг өөрөө шүүнэ (Category/Product-той ижил "@Roles()-гүй,
// RLS шүүнэ" зарчим GET route-уудад).
const COUPON_CREATE_ROLES = ['SUPER_ADMIN', 'ALL_BRANCH_MANAGER'] as const;
const COUPON_UPDATE_ROLES = [
  'SUPER_ADMIN',
  'OWNER',
  'ALL_BRANCH_MANAGER',
] as const;
const COUPON_DELETE_ROLES = ['SUPER_ADMIN', 'ALL_BRANCH_MANAGER'] as const;

@Controller('coupons')
@UseGuards(RolesGuard)
export class CouponController {
  constructor(
    private readonly couponService: CouponService,
    private readonly requestContext: RequestContextService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  findAll() {
    return this.couponService.findAll();
  }

  // ⚠️ Nest/Express-ийн route matching зарчмаар `:id`-той дүрмээс ӨМНӨ
  // зарлагдсан байх ёстой, эс бөгөөс "validate" гэдэг үг өөрөө id гэж
  // тайлагдана. Харилцагч checkout хийхээсээ ӨМНӨ мутациГҮЙ урьдчилан
  // шалгах endpoint (§7 модуль #10 3-р зүйл).
  @Get('validate')
  async validate(
    @Query('code') code: string,
    @Query('orderAmount') orderAmount: string,
  ) {
    if (!code) {
      throw new BadRequestException({
        code: 'MISSING_COUPON_CODE',
        message: 'code параметр заавал шаардлагатай',
      });
    }
    const amount = new Prisma.Decimal(orderAmount || '0');
    if (amount.isNaN() || amount.lt(0)) {
      throw new BadRequestException(INVALID_ORDER_AMOUNT);
    }

    const { userId } = this.requestContext.get();
    const roles = userId
      ? await resolveUserRoleNames(this.prisma.tx, userId)
      : [];
    const customerId = roles.includes('CUSTOMER') ? (userId ?? null) : null;

    const { coupon, discountAmount } =
      await this.couponService.validateForCheckout(code, amount, customerId);

    return {
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
      },
      discountAmount,
    };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.couponService.findOne(id);
  }

  @Post()
  @Roles(...COUPON_CREATE_ROLES)
  @Audit('coupons')
  create(@Body() dto: CreateCouponDto) {
    const { userId } = this.requestContext.get();
    if (!userId) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Нэвтрээгүй байна',
      });
    }
    return this.couponService.create(dto, userId);
  }

  @Patch(':id')
  @Roles(...COUPON_UPDATE_ROLES)
  @Audit('coupons')
  update(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.couponService.update(id, dto);
  }

  @Delete(':id')
  @Roles(...COUPON_DELETE_ROLES)
  @Audit('coupons')
  remove(@Param('id') id: string) {
    return this.couponService.remove(id);
  }
}
