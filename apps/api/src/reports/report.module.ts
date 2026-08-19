import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/roles.guard.js';
import { ReportController } from './report.controller.js';
import { ReportService } from './report.service.js';

// docs/plan.md §7 модуль #14 (Тайлан ба аналитик), §8 Phase 5.
@Module({
  controllers: [ReportController],
  providers: [ReportService, RolesGuard],
})
export class ReportModule {}
