import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/roles.guard.js';
import { KeycloakAdminService } from './keycloak-admin.service.js';
import { StaffController } from './staff.controller.js';
import { StaffService } from './staff.service.js';

// docs/adr/002-ийн "Инцидент (2026-08-25)"-ийг сэргээхгүй байх зорилготой
// ажилтны удирдлагын модуль — §7 модуль #1-ийн үргэлжлэл.
@Module({
  controllers: [StaffController],
  providers: [StaffService, KeycloakAdminService, RolesGuard],
})
export class StaffModule {}
