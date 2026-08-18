import {
  Body,
  Controller,
  Get,
  Put,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Audit } from '../common/audit.decorator.js';
import { RequestContextService } from '../common/request-context.js';
import { Roles } from '../common/roles.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { UpdateReturnFeePercentDto } from './dto/update-return-fee-percent.dto.js';
import { SystemSettingService } from './system-setting.service.js';

// §6.1 матрицад тодорхой мөр байхгүй тул даалгаврын шууд заавар дагасан:
// GET бүх нэвтэрсэн хэрэглэгчид (харилцагч ч буцаалт хүсэхээсээ өмнө
// одоогийн шимтгэлийн хувийг мэдэх ёстой байж болно — @Roles()-гүй),
// PUT зөвхөн "менежерүүд" = global-scope дүрүүд (system_settings_update
// RLS-тэй ЯГ тохирно: app_has_global_scope() = SUPER_ADMIN/OWNER/
// ALL_BRANCH_MANAGER).
const RETURN_FEE_WRITE_ROLES = [
  'SUPER_ADMIN',
  'OWNER',
  'ALL_BRANCH_MANAGER',
] as const;

@Controller('settings')
@UseGuards(RolesGuard)
export class SystemSettingController {
  constructor(
    private readonly settings: SystemSettingService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Get('return-fee-percent')
  getReturnFeePercent() {
    return this.settings.getReturnFeePercentSetting();
  }

  @Put('return-fee-percent')
  @Roles(...RETURN_FEE_WRITE_ROLES)
  @Audit('system_settings', {
    action: 'system_settings.return_fee_percent_updated',
    recordId: (_req, body) =>
      (body as { key?: string } | undefined)?.key ?? 'RETURN_FEE_PERCENT',
  })
  updateReturnFeePercent(@Body() dto: UpdateReturnFeePercentDto) {
    const { userId } = this.requestContext.get();
    if (!userId) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Нэвтрээгүй байна',
      });
    }
    return this.settings.updateReturnFeePercent(dto.value, userId);
  }
}
