import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { BranchComparisonQueryDto } from './dto/branch-comparison-query.dto.js';
import {
  DEFAULT_TOP_PRODUCTS_LIMIT,
  TopProductsQueryDto,
} from './dto/top-products-query.dto.js';
import { RevenueTrendQueryDto } from './dto/revenue-trend-query.dto.js';
import type { ReportDateRangeQueryDto } from './dto/report-date-range-query.dto.js';

const INVALID_DATE_RANGE = {
  code: 'INVALID_DATE_RANGE',
  message: '"from" огноо "to"-оос хойш байж болохгүй, эсвэл огноо буруу байна',
};

const ZERO = new Prisma.Decimal(0);
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface SalesSummary {
  from: string;
  to: string;
  branchId: string | null;
  totalRevenue: string;
  orderCount: number;
  averageOrderAmount: string;
  returnAmount: string;
  returnCount: number;
}

export interface TopProductRow {
  variantId: string;
  productName: string;
  variantName: string;
  quantitySold: number;
  revenue: string;
}

export interface RevenueTrendPoint {
  date: string;
  revenue: string;
  orderCount: number;
}

export interface BranchComparisonRow {
  branchId: string;
  branchName: string;
  revenue: string;
  orderCount: number;
}

interface ParsedRange {
  from: Date;
  to: Date;
  branchId?: string;
}

// "to"-г date-only (жиш: "2026-08-19") хэлбэрээр өгвөл тухайн өдрийн
// ЭЦЭС хүртэл (23:59:59.999) багтаана — эс бөгөөс "from=2026-08-01,
// to=2026-08-19" гэсэн "энэ сарын эхнээс өнөөдөр хүртэл" шиг зөнгөөрөө
// ойлгомжтой хүсэлт өнөөдрийн захиалгыг хасаж орхих байсан.
function endOfRange(to: string): Date {
  if (DATE_ONLY_PATTERN.test(to)) {
    return new Date(`${to}T23:59:59.999Z`);
  }
  return new Date(to);
}

// docs/plan.md §8 Phase 5, §6.1 "Тайлан/аналитик" мөр: шинэ query бичихдээ
// л (Prisma aggregate/groupBy/$queryRaw), шинэ RLS policy шаардахгүй —
// Order/OrderItem/ReturnRequest/Branch-ийн одоо байгаа RLS (§6.3-ийн
// request-scoped tx-ээр дамждаг тул raw SQL ч мөн адил хамрагдана)
// автоматаар "өөрийн салбар"/"бүх" гэсэн хамрах хүрээгээр шүүнэ.
@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  private parseRange(query: ReportDateRangeQueryDto): ParsedRange {
    const from = new Date(query.from);
    const to = endOfRange(query.to);
    if (
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime()) ||
      from.getTime() > to.getTime()
    ) {
      throw new BadRequestException(INVALID_DATE_RANGE);
    }
    return { from, to, branchId: query.branchId };
  }

  async getSalesSummary(query: ReportDateRangeQueryDto): Promise<SalesSummary> {
    const { from, to, branchId } = this.parseRange(query);

    const [orderAgg, returnAgg] = await Promise.all([
      this.prisma.tx.order.aggregate({
        where: {
          status: 'COMPLETED',
          completedAt: { gte: from, lte: to },
          ...(branchId ? { branchId } : {}),
        },
        _sum: { totalAmount: true },
        _count: true,
      }),
      this.prisma.tx.returnRequest.aggregate({
        where: {
          status: 'REFUNDED',
          refundedAt: { gte: from, lte: to },
          ...(branchId ? { orderItem: { order: { branchId } } } : {}),
        },
        _sum: { refundAmount: true },
        _count: true,
      }),
    ]);

    const orderCount = orderAgg._count;
    const totalRevenue = orderAgg._sum.totalAmount ?? ZERO;
    const averageOrderAmount =
      orderCount > 0 ? totalRevenue.dividedBy(orderCount) : ZERO;

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      branchId: branchId ?? null,
      totalRevenue: totalRevenue.toFixed(2),
      orderCount,
      averageOrderAmount: averageOrderAmount.toFixed(2),
      returnAmount: (returnAgg._sum.refundAmount ?? ZERO).toFixed(2),
      returnCount: returnAgg._count,
    };
  }

  async getTopProducts(query: TopProductsQueryDto): Promise<TopProductRow[]> {
    const { from, to, branchId } = this.parseRange(query);
    const limit = query.limit ?? DEFAULT_TOP_PRODUCTS_LIMIT;

    // groupBy нь quantity/variantId-ээр НИЙЛБЭРлэж чадах ч
    // (quantity * unitPriceSnapshot) computed нийлбэрийг дэмждэггүй тул
    // (§Даалгавар шаардсан "нийт орлого" багана) тохирох мөрүүдийг
    // бүхэлд нь уншиж JS талд аггрегатлав — тайлангийн хугацааны
    // цонхонд багтах OrderItem мөрийн тоо ихээхэн хэмжээнд хүрэхээс өмнө
    // (одоогийн масштабт) энгийн бөгөөд зөв шийдэл.
    const items = await this.prisma.tx.orderItem.findMany({
      where: {
        order: {
          status: 'COMPLETED',
          completedAt: { gte: from, lte: to },
          ...(branchId ? { branchId } : {}),
        },
      },
      select: {
        variantId: true,
        quantity: true,
        unitPriceSnapshot: true,
        variant: {
          select: { name: true, product: { select: { name: true } } },
        },
      },
    });

    const byVariant = new Map<
      string,
      {
        productName: string;
        variantName: string;
        quantitySold: number;
        revenue: Prisma.Decimal;
      }
    >();
    for (const item of items) {
      const revenueDelta = item.unitPriceSnapshot.times(item.quantity);
      const existing = byVariant.get(item.variantId);
      if (existing) {
        existing.quantitySold += item.quantity;
        existing.revenue = existing.revenue.plus(revenueDelta);
      } else {
        byVariant.set(item.variantId, {
          productName: item.variant.product.name,
          variantName: item.variant.name,
          quantitySold: item.quantity,
          revenue: revenueDelta,
        });
      }
    }

    return [...byVariant.entries()]
      .map(([variantId, v]) => ({
        variantId,
        productName: v.productName,
        variantName: v.variantName,
        quantitySold: v.quantitySold,
        revenue: v.revenue.toFixed(2),
      }))
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, limit);
  }

  async getRevenueTrend(
    query: RevenueTrendQueryDto,
  ): Promise<RevenueTrendPoint[]> {
    const { from, to, branchId } = this.parseRange(query);

    // date_trunc-той өдөр тутмын цуваа Prisma groupBy-ээр илэрхийлэх
    // боломжгүй (Prisma "SQL функцээр groupBy" дэмждэггүй) тул raw SQL —
    // `tx.$queryRaw` нь `runRequestTransaction()`-ээр нээгдсэн ижил RLS
    // session-той connection дээр ажилладаг тул (ADR 001) энд ч RLS
    // хэвээр хамгаална, Prisma.sql tagged template ашигласан тул SQL
    // injection-гүй (параметржсан).
    const branchFilter = branchId
      ? Prisma.sql`AND "branchId" = ${branchId}`
      : Prisma.empty;
    const rows = await this.prisma.tx.$queryRaw<
      { day: Date; revenue: Prisma.Decimal | string; orderCount: bigint }[]
    >(Prisma.sql`
      SELECT date_trunc('day', "completedAt") AS day,
             COALESCE(SUM("totalAmount"), 0) AS revenue,
             COUNT(*) AS "orderCount"
      FROM orders
      WHERE status = 'COMPLETED'
        AND "completedAt" >= ${from}
        AND "completedAt" <= ${to}
        ${branchFilter}
      GROUP BY day
      ORDER BY day ASC
    `);

    return rows.map((r) => ({
      date: r.day.toISOString().slice(0, 10),
      revenue: new Prisma.Decimal(r.revenue).toFixed(2),
      orderCount: Number(r.orderCount),
    }));
  }

  async getBranchComparison(
    query: BranchComparisonQueryDto,
  ): Promise<BranchComparisonRow[]> {
    const { from, to } = this.parseRange(query);

    // branches_select RLS (§6.3) нь ЭНД ч хамгаална (global scope БУС дүр
    // хэзээ ч энэ методод хүрэхгүй ч — ReportController-ийн
    // BRANCH_COMPARISON_ROLES л биш, давхар хамгаалалт).
    const rows = await this.prisma.tx.$queryRaw<
      {
        branchId: string;
        branchName: string;
        revenue: Prisma.Decimal | string;
        orderCount: bigint;
      }[]
    >(Prisma.sql`
      SELECT b.id AS "branchId", b.name AS "branchName",
             COALESCE(SUM(o."totalAmount"), 0) AS revenue,
             COUNT(o.id) AS "orderCount"
      FROM branches b
      LEFT JOIN orders o
        ON o."branchId" = b.id
        AND o.status = 'COMPLETED'
        AND o."completedAt" >= ${from}
        AND o."completedAt" <= ${to}
      GROUP BY b.id, b.name
      ORDER BY revenue DESC
    `);

    return rows.map((r) => ({
      branchId: r.branchId,
      branchName: r.branchName,
      revenue: new Prisma.Decimal(r.revenue).toFixed(2),
      orderCount: Number(r.orderCount),
    }));
  }
}
