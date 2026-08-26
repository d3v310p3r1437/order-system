import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { RoleName } from '@prisma/client';
import { Audit } from '../common/audit.decorator.js';
import { Roles } from '../common/roles.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { CreateStaffDto } from './dto/create-staff.dto.js';
import { UpdateStaffDto } from './dto/update-staff.dto.js';
import { StaffService } from './staff.service.js';

// §6.1 матриц + энэ даалгаврын шууд заавар: ЗӨВХӨН SUPER_ADMIN/
// ALL_BRANCH_MANAGER (глобал) эсвэл тухайн салбарын BRANCH_ADMIN.
// ⚠️ BRANCH_MANAGER энд ЗОРИУДАА ороогүй (app_can_manage_branch()-оос
// ялгаатай, migration-ий коммент/app_can_manage_staff()-ийг үз) — RolesGuard
// энэ жагсаалтаар ЗӨВХӨН "endpoint-ыг ерөнхийд нь дуудах эрхтэй эсэх"-ийг
// шалгана, аль САЛБАРЫГ удирдах эрхтэйг нарийн шалгах ажлыг
// app_can_manage_staff() SQL функц дотор нь хийдэг (RLS сүүлчийн
// хамгаалалт зарчим).
const STAFF_MANAGE_ROLES: RoleName[] = [
  'SUPER_ADMIN',
  'ALL_BRANCH_MANAGER',
  'BRANCH_ADMIN',
];

@Controller('staff')
@UseGuards(RolesGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @Roles(...STAFF_MANAGE_ROLES)
  findAll(
    @Query('role') role?: RoleName,
    @Query('branchId') branchId?: string,
  ) {
    return this.staffService.findAll({ role, branchId });
  }

  @Post()
  @Roles(...STAFF_MANAGE_ROLES)
  @Audit('users', { action: 'staff.created' })
  create(@Body() dto: CreateStaffDto) {
    return this.staffService.create(dto);
  }

  @Patch(':id')
  @Roles(...STAFF_MANAGE_ROLES)
  @Audit('users', { action: 'staff.updated' })
  update(@Param('id') id: string, @Body() dto: UpdateStaffDto) {
    return this.staffService.update(id, dto);
  }
}
