import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Audit } from '../common/audit.decorator.js';
import { Roles } from '../common/roles.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { AdjustQuantityDto } from './dto/adjust-quantity.dto.js';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto.js';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto.js';
import { InventoryService } from './inventory.service.js';

// §6.1 "Агуулах/нөөц" мөр: OWNER-д зөвхөн R (бүх), CUD-д ордоггүй тул READ_ROLES-д
// орсон ч WRITE_ROLES-д ороогүй. SALESPERSON/CUSTOMER аль алинд нь орохгүй —
// enable_catalog_inventory_rls migration-ий inventory_items_select policy-той
// (app_can_manage_branch) нийцүүлэв.
const READ_ROLES = [
  'SUPER_ADMIN',
  'OWNER',
  'ALL_BRANCH_MANAGER',
  'BRANCH_ADMIN',
  'BRANCH_MANAGER',
] as const;
const WRITE_ROLES = [
  'SUPER_ADMIN',
  'ALL_BRANCH_MANAGER',
  'BRANCH_ADMIN',
  'BRANCH_MANAGER',
] as const;

@Controller('inventory-items')
@UseGuards(RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Roles(...READ_ROLES)
  findAll(
    @Query('branchId') branchId?: string,
    @Query('variantId') variantId?: string,
  ) {
    return this.inventoryService.findAll({ branchId, variantId });
  }

  @Get(':id')
  @Roles(...READ_ROLES)
  findOne(@Param('id') id: string) {
    return this.inventoryService.findOne(id);
  }

  @Post()
  @Roles(...WRITE_ROLES)
  @Audit('inventory_items')
  create(@Body() dto: CreateInventoryItemDto) {
    return this.inventoryService.create(dto);
  }

  @Patch(':id')
  @Roles(...WRITE_ROLES)
  @Audit('inventory_items')
  update(@Param('id') id: string, @Body() dto: UpdateInventoryItemDto) {
    return this.inventoryService.update(id, dto);
  }

  @Patch(':id/adjust-quantity')
  @Roles(...WRITE_ROLES)
  @Audit('inventory_items', { action: 'inventory_items.quantity_adjusted' })
  adjustQuantity(@Param('id') id: string, @Body() dto: AdjustQuantityDto) {
    return this.inventoryService.adjustQuantity(id, dto);
  }

  @Delete(':id')
  @Roles(...WRITE_ROLES)
  @Audit('inventory_items')
  remove(@Param('id') id: string) {
    return this.inventoryService.remove(id);
  }
}
