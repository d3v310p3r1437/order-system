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
import { Audit } from '../../common/audit.decorator.js';
import { Roles } from '../../common/roles.decorator.js';
import { RolesGuard } from '../../common/roles.guard.js';
import { CategoryService } from './category.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

// §6.1 матриц: категорийг бүтцийн (structural) элемент гэж үзэж зөвхөн
// SUPER_ADMIN/ALL_BRANCH_MANAGER-д удирдуулна (product.controller.ts,
// product-variant.controller.ts-ийн шиг BRANCH_ADMIN/BRANCH_MANAGER-д
// update нээгээгүй) — RLS policy (categories_update) ч мөн адил.
@Controller('categories')
@UseGuards(RolesGuard)
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  findAll(@Query('parentId') parentId?: string) {
    return this.categoryService.findAll(parentId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoryService.findOne(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ALL_BRANCH_MANAGER')
  @Audit('categories')
  create(@Body() dto: CreateCategoryDto) {
    return this.categoryService.create(dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ALL_BRANCH_MANAGER')
  @Audit('categories')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoryService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ALL_BRANCH_MANAGER')
  @Audit('categories')
  remove(@Param('id') id: string) {
    return this.categoryService.remove(id);
  }
}
