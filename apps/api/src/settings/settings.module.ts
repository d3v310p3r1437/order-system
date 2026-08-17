import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/roles.guard.js';
import { SystemSettingController } from './system-setting.controller.js';
import { SystemSettingService } from './system-setting.service.js';

// docs/plan.md §7 модуль #9 6-р зүйл: тохиргооны API (RETURN_FEE_PERCENT).
// SystemSettingService-г ReturnModule-оос (буцаалт зөвшөөрөх урсгалд
// шимтгэлийн хувь унших) дахин ашиглахын тулд тусад нь экспортлов.
@Module({
  controllers: [SystemSettingController],
  providers: [SystemSettingService, RolesGuard],
  exports: [SystemSettingService],
})
export class SettingsModule {}
