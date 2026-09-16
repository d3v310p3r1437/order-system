import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/roles.guard.js';
import { StorageModule } from '../storage/storage.module.js';
import { BrandingController } from './branding.controller.js';
import { BrandingService } from './branding.service.js';
import { SystemSettingController } from './system-setting.controller.js';
import { SystemSettingService } from './system-setting.service.js';

// docs/plan.md §7 модуль #9 6-р зүйл: тохиргооны API (RETURN_FEE_PERCENT).
// SystemSettingService-г ReturnModule-оос (буцаалт зөвшөөрөх урсгалд
// шимтгэлийн хувь унших) дахин ашиглахын тулд тусад нь экспортлов.
// BrandingService нь лого upload хийхийн тулд StorageModule (MinioService)
// шаарддаг тул импортолов.
@Module({
  imports: [StorageModule],
  controllers: [SystemSettingController, BrandingController],
  providers: [SystemSettingService, BrandingService, RolesGuard],
  exports: [SystemSettingService, BrandingService],
})
export class SettingsModule {}
