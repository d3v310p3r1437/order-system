import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Audit } from '../common/audit.decorator.js';
import { RequestContextService } from '../common/request-context.js';
import { Roles } from '../common/roles.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { ReviewQueryDto } from './dto/review-query.dto.js';
import { ReviewService } from './review.service.js';

// Бүтээгдэхүүн-хамааралт сэтгэгдлийн endpoint-үүд (ProductImageController-тэй
// ижил "products/:productId/..." nested route хэв маяг).
@Controller('products/:productId/reviews')
@UseGuards(RolesGuard)
export class ReviewProductController {
  constructor(
    private readonly reviewService: ReviewService,
    private readonly requestContext: RequestContextService,
  ) {}

  // reviews_select RLS "бүх нэвтэрсэн хэрэглэгчид" тул @Roles()-гүй.
  @Get()
  findForProduct(
    @Param('productId') productId: string,
    @Query() query: ReviewQueryDto,
  ) {
    return this.reviewService.findForProduct(productId, query);
  }

  // §7 модуль #11: зөвхөн CUSTOMER, verified-purchase шалгалттай.
  @Post()
  @Roles('CUSTOMER')
  @Audit('reviews')
  create(@Param('productId') productId: string, @Body() dto: CreateReviewDto) {
    const { userId } = this.requestContext.get();
    if (!userId) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Нэвтрээгүй байна',
      });
    }
    return this.reviewService.create(userId, productId, dto);
  }
}
