import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module.js';
import { RolesGuard } from '../common/roles.guard.js';
import { CouponModule } from '../coupons/coupon.module.js';
import { NotificationModule } from '../notification/notification.module.js';
import { PaymentModule } from '../payment/payment.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { ReviewModule } from '../reviews/review.module.js';
import { RoutingModule } from '../routing/routing.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { OrderController } from './order.controller.js';
import { OrderService } from './order.service.js';

// docs/plan.md §7 модуль #5 (Сагс ба захиалга үүсгэх), #6 (Захиалгын
// удирдлага) — Phase 3a-д нэг модульд нэгтгэв (§7 модуль #3-ийн
// catalog.module.ts-тэй адил). Phase 3b: RealtimeModule (статус
// өөрчлөгдөх бүрт WebSocket event), PaymentModule (checkout дээр
// PaymentProvider.createInvoice()) нэмэгдэв. Phase 4: RoutingModule
// (GET /:id/route), NotificationModule (статус өөрчлөгдөх бүрт
// SMS/email мэдэгдэл). (2026-08-20) CartModule: checkout item-үүдийг
// Redis сагснаас уншиж, амжилттай commit хийгдсэний дараа цэвэрлэнэ.
// (2026-08-26) StorageModule (productImageUrl-д MinioService.getPublicUrl())
// БОЛОН ReviewModule (myReview-д ReviewService.findManyForCustomer(), §7
// модуль #11-ийн exports-ыг дахин ашигласан — CouponModule-той ижил зарчим).
@Module({
  imports: [
    CartModule,
    RealtimeModule,
    PaymentModule,
    RoutingModule,
    NotificationModule,
    CouponModule,
    StorageModule,
    ReviewModule,
  ],
  controllers: [OrderController],
  providers: [OrderService, RolesGuard],
})
export class OrderModule {}
