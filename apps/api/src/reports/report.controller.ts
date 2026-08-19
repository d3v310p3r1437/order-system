import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../common/roles.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { BranchComparisonQueryDto } from './dto/branch-comparison-query.dto.js';
import { ExportSalesSummaryQueryDto } from './dto/export-sales-summary-query.dto.js';
import { ReportDateRangeQueryDto } from './dto/report-date-range-query.dto.js';
import { RevenueTrendQueryDto } from './dto/revenue-trend-query.dto.js';
import { TopProductsQueryDto } from './dto/top-products-query.dto.js';
import { buildSalesSummaryCsv } from './report-csv.util.js';
import { ReportService } from './report.service.js';

// §6.1 матриц "Тайлан/аналитик" мөр: SUPER_ADMIN/OWNER/ALL_BRANCH_MANAGER
// "R (бүх)", BRANCH_ADMIN/BRANCH_MANAGER "R (өөрийн)" — RLS (одоо байгаа
// orders_select гэх мэт) өөрөө "өөрийн салбар"-аар шүүнэ, шинэ query энд
// бичихдээ л (report.service.ts), шинэ policy шаардахгүй. SALESPERSON
// болон CUSTOMER-д "—" (эрхгүй) тул REPORT_VIEW_ROLES-д ороогүй.
const REPORT_VIEW_ROLES = [
  'SUPER_ADMIN',
  'OWNER',
  'ALL_BRANCH_MANAGER',
  'BRANCH_ADMIN',
  'BRANCH_MANAGER',
] as const;

// Салбар харьцуулалт зөвхөн "R (бүх)" гурван дүрд (§Даалгавар #4) —
// RolesGuard-аар бусад дүрд 403.
const BRANCH_COMPARISON_ROLES = [
  'SUPER_ADMIN',
  'OWNER',
  'ALL_BRANCH_MANAGER',
] as const;

// Windows Excel-д Cyrillic толгой мөр зөв харагдахын тулд CSV хариуны
// эхэнд заавал тавих UTF-8 BOM (report-csv.util.ts-ийн тайлбарыг үз).
const UTF8_BOM = '﻿';

@Controller('reports')
@UseGuards(RolesGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  // Зөвхөн унших endpoint-үүд тул @Audit() шаардлагагүй (мутаци биш —
  // catalog/search/reindex-тэй ижил зарчим).
  @Get('sales-summary')
  @Roles(...REPORT_VIEW_ROLES)
  getSalesSummary(@Query() query: ReportDateRangeQueryDto) {
    return this.reportService.getSalesSummary(query);
  }

  @Get('top-products')
  @Roles(...REPORT_VIEW_ROLES)
  getTopProducts(@Query() query: TopProductsQueryDto) {
    return this.reportService.getTopProducts(query);
  }

  @Get('revenue-trend')
  @Roles(...REPORT_VIEW_ROLES)
  getRevenueTrend(@Query() query: RevenueTrendQueryDto) {
    return this.reportService.getRevenueTrend(query);
  }

  @Get('branch-comparison')
  @Roles(...BRANCH_COMPARISON_ROLES)
  getBranchComparison(@Query() query: BranchComparisonQueryDto) {
    return this.reportService.getBranchComparison(query);
  }

  // NestJS-ийн @Res({passthrough:true})-оор буцаах утгыг хариу болгон
  // ашиглаж, Content-Type/Content-Disposition-ыг л гараар нэмдэг —
  // route param биш тул '/sales-summary' болон '/sales-summary/export'
  // хооронд ямар ч зөрчилдөөнгүй.
  @Get('sales-summary/export')
  @Roles(...REPORT_VIEW_ROLES)
  async exportSalesSummary(
    @Query() query: ExportSalesSummaryQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const summary = await this.reportService.getSalesSummary(query);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="sales-summary-${query.from}_${query.to}.csv"`,
    });
    return `${UTF8_BOM}${buildSalesSummaryCsv(summary)}`;
  }
}
