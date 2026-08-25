import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../common/roles.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditLogQueryDto, DEFAULT_AUDIT_LOG_LIMIT } from './dto/audit-log-query.dto.js';

// ⚠️ Чухал хязгаарлалт: `AuditInterceptor.writeAuditLog()`
// (src/common/audit.interceptor.ts) одоогоор `branchId`-г ХЭЗЭЭ Ч
// бөглөдөггүй (INSERT-ийн сүүлчийн багана ЗААВАЛ `null`) — тул
// `audit_select` RLS policy-ийн "branchId IS NOT NULL AND
// app_can_manage_branch(branchId)" гэсэн 2-р нөхцөл ОДООГООР ЯМАР Ч мөрд
// хэзээ ч биелэхгүй, зөвхөн `app_has_global_scope()` дуудагч л мөр харна.
// Иймд энэ endpoint-ыг ЗОРИУДАА зөвхөн глобал-эрхийн дүрд (RLS-тэй
// тохирсон, БОДИТООР ажиллах цар хүрээ) @Roles()-оор хязгаарласан —
// BRANCH_ADMIN/BRANCH_MANAGER-д зөвшөөрвөл ЯМАР Ч тохиолдолд хоосон
// жагсаалт л харагдах байсан тул (§Даалгавар #9-ийн "аудит логийн UI
// байгаа эсэхийг шалга" — шинэ branchId populate хийх ажил ЭНЭ
// даалгаврын хамрах хүрээнд ОРООГҮЙ, ирээдүйн ажил).
const AUDIT_LOG_VIEW_ROLES = ['SUPER_ADMIN', 'OWNER', 'ALL_BRANCH_MANAGER'] as const;

@Controller('audit-logs')
@UseGuards(RolesGuard)
export class AuditLogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles(...AUDIT_LOG_VIEW_ROLES)
  findAll(@Query() query: AuditLogQueryDto) {
    const hasDateRange = query.from || query.to;
    return this.prisma.tx.auditLog.findMany({
      where: {
        tableName: query.tableName,
        action: query.action,
        recordId: query.recordId,
        userId: query.userId,
        createdAt: hasDateRange
          ? {
              gte: query.from ? new Date(query.from) : undefined,
              lte: query.to ? new Date(query.to) : undefined,
            }
          : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? DEFAULT_AUDIT_LOG_LIMIT,
    });
  }
}
