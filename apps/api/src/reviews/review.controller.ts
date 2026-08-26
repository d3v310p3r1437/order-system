import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Audit } from '../common/audit.decorator.js';
import { Roles } from '../common/roles.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { ReviewQueryDto } from './dto/review-query.dto.js';
import { UpdateReviewDto } from './dto/update-review.dto.js';
import { ReviewService } from './review.service.js';

// admin-web "/reviews" модераци дэлгэц (§6.1-д тусгайлан мөр байхгүй ч
// audit-log.controller.ts-ийн адил зарчмаар глобал-эрхийн дүрд
// хязгаарлав — reviews_select RLS "бүх нэвтэрсэн" учир endpoint
// (backend RLS-ийн хувьд) бусад дүрд ч аюулгүй боловч дэлгэц зөвхөн
// модераци зорилготой тул @Roles()-оор хатуу хязгаарлав).
const REVIEW_MODERATION_ROLES = [
  'SUPER_ADMIN',
  'OWNER',
  'ALL_BRANCH_MANAGER',
] as const;
// reviews_delete RLS "ӨӨРИЙН ЭСВЭЛ app_has_global_scope()" — CUSTOMER
// (өөрийн) БОЛОН модератор аль аль нь ЭНЭ endpoint-ыг дуудна, RLS
// өөрөө эцсийн зөвшөөрлийг шийднэ.
const REVIEW_DELETE_ROLES = ['CUSTOMER', ...REVIEW_MODERATION_ROLES] as const;

@Controller('reviews')
@UseGuards(RolesGuard)
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get()
  @Roles(...REVIEW_MODERATION_ROLES)
  findAllForModeration(@Query() query: ReviewQueryDto) {
    return this.reviewService.findAllForModeration(query);
  }

  // reviews_update RLS "зөвхөн ӨӨРИЙН" тул @Roles('CUSTOMER').
  @Patch(':id')
  @Roles('CUSTOMER')
  @Audit('reviews')
  update(@Param('id') id: string, @Body() dto: UpdateReviewDto) {
    return this.reviewService.update(id, dto);
  }

  @Delete(':id')
  @Roles(...REVIEW_DELETE_ROLES)
  @Audit('reviews')
  remove(@Param('id') id: string) {
    return this.reviewService.remove(id);
  }
}
