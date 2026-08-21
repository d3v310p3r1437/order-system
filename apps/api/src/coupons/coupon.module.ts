import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/roles.guard.js';
import { CouponController } from './coupon.controller.js';
import { CouponService } from './coupon.service.js';

// docs/plan.md §7 модуль #10. CouponService-г OrderService-ийн
// checkout()-д (validateForCheckout()/redeemAtomic()) дахин ашиглахын
// тулд экспортлов — SystemSettingService-г ReturnModule-д дахин ашигласантай
// (settings.module.ts) ижил зарчим.
@Module({
  controllers: [CouponController],
  providers: [CouponService, RolesGuard],
  exports: [CouponService],
})
export class CouponModule {}
