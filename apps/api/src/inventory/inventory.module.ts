import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/roles.guard.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';

// docs/plan.md §7 модуль #4 (Агуулах/нөөцийн удирдлага).
@Module({
  controllers: [InventoryController],
  providers: [InventoryService, RolesGuard],
})
export class InventoryModule {}
