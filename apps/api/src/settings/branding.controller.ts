import {
  Body,
  Controller,
  Get,
  Put,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Audit } from '../common/audit.decorator.js';
import { RequestContextService } from '../common/request-context.js';
import { Roles } from '../common/roles.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { BrandingService } from './branding.service.js';
import { UpdateBrandingDto } from './dto/update-branding.dto.js';

// Даалгаврын шууд заавар: "зөвхөн SUPER_ADMIN/OWNER" — system_settings_update
// RLS-ийн `app_has_global_scope()` (ALL_BRANCH_MANAGER-ыг ч хамардаг)-аас
// ЗОРИУДАА нарийсгасан, RolesGuard энд RLS-ээс илүү хатуу шүүлт болно
// (BRANCH_COMPARISON_ROLES/REPORT_VIEW_ROLES-ийн ЯГ ижил зарчим).
const BRANDING_WRITE_ROLES = ['SUPER_ADMIN', 'OWNER'] as const;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// ⚠️ ЧУХАЛ: SystemSettingController-оос ЯЛГААТАЙ, ЭНЭ controller-т
// class-level `@UseGuards(RolesGuard)` ЗОРИУДАА байхгүй — GET нь Login
// дэлгэц дээр ч (нэвтрэлтгүй) харагдах ёстой тул RolesGuard.canActivate()-ийн
// "userId байхгүй бол UNAUTHENTICATED" шалгалтыг ОГТ давахгүй байх ёстой
// (RolesGuard @Roles()-гүй ч гэсэн заавал нэвтэрсэн байхыг шаарддаг —
// branch.controller.ts-ийн жишээг үз). PUT дээр л method-level guard.
@Controller('settings')
export class BrandingController {
  constructor(
    private readonly branding: BrandingService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Get('branding')
  getBranding() {
    return this.branding.getBranding();
  }

  @Put('branding')
  @UseGuards(RolesGuard)
  @Roles(...BRANDING_WRITE_ROLES)
  @Audit('system_settings', {
    action: 'system_settings.branding_updated',
    recordId: () => 'STORE_BRANDING',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  updateBranding(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UpdateBrandingDto,
  ) {
    const { userId } = this.requestContext.get();
    if (!userId) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Нэвтрээгүй байна',
      });
    }
    return this.branding.updateBranding(dto.storeName, file, userId);
  }
}
