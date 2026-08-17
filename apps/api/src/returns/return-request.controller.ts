import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { ReturnStatus } from '@prisma/client';
import { Audit } from '../common/audit.decorator.js';
import { RequestContextService } from '../common/request-context.js';
import { Roles } from '../common/roles.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { CreateReturnRequestDto } from './dto/create-return-request.dto.js';
import { RejectReturnRequestDto } from './dto/reject-return-request.dto.js';
import { ReturnRequestService } from './return-request.service.js';

// §6.1 матриц "Захиалга" мөрийн дагалдах эрх (буцаалт нь захиалгын мөртэй
// шууд холбоотой) — return_requests_update RLS-тэй (20260817130500
// migration) ЯГ тохирно: SALESPERSON ЗОРИУДАА ороогүй (staff л
// зөвшөөрөх/татгалзах шийдвэр гаргах эрхтэй, даалгаврын шууд заавар).
const REVIEW_ROLES = [
  'SUPER_ADMIN',
  'ALL_BRANCH_MANAGER',
  'BRANCH_ADMIN',
  'BRANCH_MANAGER',
] as const;

@Controller('returns')
@UseGuards(RolesGuard)
export class ReturnRequestController {
  constructor(
    private readonly returnService: ReturnRequestService,
    private readonly requestContext: RequestContextService,
  ) {}

  // RLS (return_requests_select) дүрд харагдах мөрийг өөрөө шүүнэ —
  // @Roles()-гүй тул зөвхөн нэвтэрсэн байхыг шаардана.
  @Get()
  findAll(@Query('status') status?: ReturnStatus) {
    return this.returnService.findAll({ status });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.returnService.findOne(id);
  }

  // §7 модуль #9 8: харилцагчийн буцаалт хүсэх API — зөвхөн CUSTOMER.
  @Post()
  @Roles('CUSTOMER')
  @Audit('return_requests')
  create(@Body() dto: CreateReturnRequestDto) {
    const { userId } = this.requestContext.get();
    if (!userId) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Нэвтрээгүй байна',
      });
    }
    return this.returnService.create(userId, dto);
  }

  @Patch(':id/approve')
  @Roles(...REVIEW_ROLES)
  @Audit('return_requests', { action: 'return_requests.approved' })
  approve(@Param('id') id: string) {
    const { userId } = this.requestContext.get();
    if (!userId) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Нэвтрээгүй байна',
      });
    }
    return this.returnService.approve(id, userId);
  }

  @Patch(':id/reject')
  @Roles(...REVIEW_ROLES)
  @Audit('return_requests', { action: 'return_requests.rejected' })
  reject(@Param('id') id: string, @Body() dto: RejectReturnRequestDto) {
    const { userId } = this.requestContext.get();
    if (!userId) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Нэвтрээгүй байна',
      });
    }
    return this.returnService.reject(id, userId, dto);
  }
}
