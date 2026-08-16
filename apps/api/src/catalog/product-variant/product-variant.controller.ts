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
import { CreateProductVariantDto } from './dto/create-product-variant.dto.js';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto.js';
import { ProductVariantService } from './product-variant.service.js';

@Controller('product-variants')
@UseGuards(RolesGuard)
export class ProductVariantController {
  constructor(private readonly productVariantService: ProductVariantService) {}

  @Get()
  findAll(@Query('productId') productId?: string) {
    return this.productVariantService.findAll(productId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productVariantService.findOne(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ALL_BRANCH_MANAGER', 'BRANCH_ADMIN')
  @Audit('product_variants')
  create(@Body() dto: CreateProductVariantDto) {
    return this.productVariantService.create(dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ALL_BRANCH_MANAGER', 'BRANCH_ADMIN', 'BRANCH_MANAGER')
  @Audit('product_variants')
  update(@Param('id') id: string, @Body() dto: UpdateProductVariantDto) {
    return this.productVariantService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ALL_BRANCH_MANAGER', 'BRANCH_ADMIN')
  @Audit('product_variants')
  remove(@Param('id') id: string) {
    return this.productVariantService.remove(id);
  }
}
