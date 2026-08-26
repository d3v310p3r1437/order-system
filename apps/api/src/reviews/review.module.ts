import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/roles.guard.js';
import { ReviewController } from './review.controller.js';
import { ReviewProductController } from './review-product.controller.js';
import { ReviewService } from './review.service.js';

// docs/plan.md §7 модуль #11. ReviewService-ийг ProductService-д (canReview/
// myReview тооцоолол, GET /products/:id-д нэгтгэх) дахин ашиглахын тулд
// экспортлов — CouponModule-ийг OrderModule-д дахин ашигласантай ижил
// зарчим.
@Module({
  controllers: [ReviewProductController, ReviewController],
  providers: [ReviewService, RolesGuard],
  exports: [ReviewService],
})
export class ReviewModule {}
