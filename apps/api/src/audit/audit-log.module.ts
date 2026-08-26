import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/roles.guard.js';
import { AuditLogController } from './audit-log.controller.js';

// §Даалгавар #9: аудит логийн (зөвхөн унших) UI — GET endpoint шинээр
// нэмсэн, шинэ SECURITY DEFINER функц/RLS шаардлагагүй (odoo байгаа
// audit_select policy-г л дахин ашиглав, ADR 005 "эхлээд байгаа RLS
// зарчмаа дахин ашигла").
@Module({
  controllers: [AuditLogController],
  providers: [RolesGuard],
})
export class AuditLogModule {}
