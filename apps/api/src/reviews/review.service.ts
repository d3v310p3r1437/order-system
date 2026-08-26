import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Review } from '@prisma/client';
import {
  isRecordNotFoundError,
  isUniqueConstraintViolation,
} from '../common/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateReviewDto } from './dto/create-review.dto.js';
import {
  DEFAULT_REVIEW_PAGE_SIZE,
  type ReviewQueryDto,
} from './dto/review-query.dto.js';
import type { UpdateReviewDto } from './dto/update-review.dto.js';

const REVIEW_NOT_FOUND = {
  code: 'REVIEW_NOT_FOUND',
  message: 'Сэтгэгдэл олдсонгүй',
};
const DUPLICATE_REVIEW = {
  code: 'REVIEW_ALREADY_EXISTS',
  message: 'Та энэ бүтээгдэхүүнд аль хэдийн сэтгэгдэл үлдээсэн байна',
};
const NOT_VERIFIED_PURCHASE = {
  code: 'PRODUCT_NOT_PURCHASED',
  message:
    'Зөвхөн худалдаж аваад хүлээн авсан (COMPLETED) бүтээгдэхүүнд сэтгэгдэл бичих боломжтой',
};

// docs/plan.md §7 модуль #11. ADR 005-ийн зарчмаар шинэ SECURITY DEFINER
// функц ЗОХИОГООГҮЙ — reviews_select/insert/update/delete RLS
// (enable_reviews_rls migration) l харилцагчийн эрхийг сүүлчийн
// давхаргад хамгаалдаг, энэ service зөвхөн UX-friendly урьдчилсан
// шалгалт хийдэг.
@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

  // reviews_insert RLS policy-ийн WITH CHECK-тэй ЯГ ижил "COMPLETED
  // захиалгаар худалдаж авсан эсэх" join — ГАНЦ газар бичигдэж, энд
  // (create()-ийн UX-friendly pre-check) БОЛОН ProductService.findOne()-ийн
  // canReview тооцооллын аль алинд нь дахин ашиглагдана (ADR 005 "ганц
  // газар л шийднэ" зарчим).
  async hasVerifiedPurchase(
    customerId: string,
    productId: string,
  ): Promise<boolean> {
    const orderItem = await this.prisma.tx.orderItem.findFirst({
      where: {
        variant: { productId },
        order: { customerId, status: 'COMPLETED' },
      },
      select: { id: true },
    });
    return orderItem !== null;
  }

  // ProductController.findOne()-оос CUSTOMER-д зориулж дуудагдана —
  // canReview нь зөвхөн verified-purchase шалгалт (аль хэдийн сэтгэгдэл
  // байгаа эсэхээс ХАМААРАХГҮЙ), UI (admin-web биш, Flutter) myReview
  // байгаа эсэхээр "Үнэлгээ өгөх" эсвэл "Засварлах" гэдгийг өөрөө шийднэ.
  async getCustomerReviewContext(
    customerId: string,
    productId: string,
  ): Promise<{ canReview: boolean; myReview: Review | null }> {
    const [canReview, myReview] = await Promise.all([
      this.hasVerifiedPurchase(customerId, productId),
      this.prisma.tx.review.findUnique({
        where: { customerId_productId: { customerId, productId } },
      }),
    ]);
    return { canReview, myReview };
  }

  // (2026-08-26) OrderService.hydrateOrder()-оос дуудагдана — Захиалгын
  // түүх/Захиалгын дэлгэрэнгүй дэлгэцэд OrderItem бүрд "аль хэдийн
  // үнэлсэн эсэх"-ийг НЭГ batch query-ээр (productId бүрд тусад нь биш)
  // тодорхойлохын тулд. reviews_select RLS "бүх нэвтэрсэн" тул зөвшөөрлийн
  // асуудалгүй — энд зөвхөн `customerId`-аар шүүсэн тул үр дүн ХЭЗЭЭ Ч
  // өөр хэрэглэгчийн review-г буцаахгүй.
  async findManyForCustomer(
    customerId: string,
    productIds: string[],
  ): Promise<Map<string, Review>> {
    if (productIds.length === 0) {
      return new Map();
    }
    const reviews = await this.prisma.tx.review.findMany({
      where: { customerId, productId: { in: productIds } },
    });
    return new Map(reviews.map((review) => [review.productId, review]));
  }

  // GET /products/:id/reviews: aggregate query-ээр дундаж үнэлгээг
  // тооцоолно (денормалиц хийхгүй — даалгаврын шууд заавар).
  async findForProduct(productId: string, query: ReviewQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_REVIEW_PAGE_SIZE;
    const [reviews, totalCount, aggregate] = await Promise.all([
      this.prisma.tx.review.findMany({
        where: { productId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.tx.review.count({ where: { productId } }),
      this.prisma.tx.review.aggregate({
        where: { productId },
        _avg: { rating: true },
      }),
    ]);
    return {
      reviews,
      averageRating: aggregate._avg.rating ?? 0,
      totalCount,
      page,
      limit,
    };
  }

  // admin-web "/reviews" модераци дэлгэц: бүх сэтгэгдлийг бүтээгдэхүүний
  // нэртэй нь хамт (@Roles()-оор global-scope дүрд хязгаарлагдсан).
  async findAllForModeration(query: ReviewQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_REVIEW_PAGE_SIZE;
    const [reviews, totalCount] = await Promise.all([
      this.prisma.tx.review.findMany({
        include: { product: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.tx.review.count(),
    ]);
    return { reviews, totalCount, page, limit };
  }

  async create(customerId: string, productId: string, dto: CreateReviewDto) {
    const verified = await this.hasVerifiedPurchase(customerId, productId);
    if (!verified) {
      throw new ForbiddenException(NOT_VERIFIED_PURCHASE);
    }
    try {
      return await this.prisma.tx.review.create({
        data: {
          customerId,
          productId,
          rating: dto.rating,
          comment: dto.comment,
        },
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException(DUPLICATE_REVIEW);
      }
      throw error;
    }
  }

  // reviews_update RLS policy CUSTOMER-ийг ЗӨВХӨН өөрийн мөрд л
  // зөвшөөрдөг тул бусдын сэтгэгдэл засварлахыг оролдвол typed .update()
  // 0 мөр олж P2025 (isRecordNotFoundError) шидэж, 404 болно (эрх
  // алдагдуулахгүй, "олдсонгүй" гэсэн мэдээлэл л буцна).
  async update(id: string, dto: UpdateReviewDto) {
    try {
      return await this.prisma.tx.review.update({
        where: { id },
        data: { rating: dto.rating, comment: dto.comment },
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw new NotFoundException(REVIEW_NOT_FOUND);
      }
      throw error;
    }
  }

  // reviews_delete RLS ("ӨӨРИЙН ЭСВЭЛ app_has_global_scope()") л зөвшөөрлийг
  // шийднэ.
  async remove(id: string) {
    try {
      return await this.prisma.tx.review.delete({ where: { id } });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw new NotFoundException(REVIEW_NOT_FOUND);
      }
      throw error;
    }
  }
}
