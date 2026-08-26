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
import { RequestContextService } from '../../common/request-context.js';
import { Roles } from '../../common/roles.decorator.js';
import { RolesGuard } from '../../common/roles.guard.js';
import { resolveUserRoleNames } from '../../common/user-roles.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductService } from './product.service.js';

@Controller('products')
@UseGuards(RolesGuard)
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly requestContext: RequestContextService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  findAll(@Query('categoryId') categoryId?: string) {
    return this.productService.findAll(categoryId);
  }

  // "Нийтэд харагдах" endpoint — @Roles()-гүй тул зөвхөн нэвтэрсэн байхыг
  // шаардана (CUSTOMER ч дуудна). branchId query-гээр сонгосон 1 салбарын,
  // өгөгдөөгүй бол бүх салбараар аггрегатласан availability status буцаана.
  // §7 модуль #11: нэвтэрсэн хэрэглэгч CUSTOMER бол canReview/myReview-г
  // нэмж нэгтгэнэ (CouponController.validate()-ийн "roles-оор customerId
  // тодорхойлох" ЯГ ижил загвар).
  @Get(':id')
  async findOne(@Param('id') id: string, @Query('branchId') branchId?: string) {
    const { userId } = this.requestContext.get();
    const roles = userId
      ? await resolveUserRoleNames(this.prisma.tx, userId)
      : [];
    const customerId = roles.includes('CUSTOMER')
      ? (userId ?? undefined)
      : undefined;
    return this.productService.findOne(id, branchId, customerId);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ALL_BRANCH_MANAGER', 'BRANCH_ADMIN')
  @Audit('products')
  create(@Body() dto: CreateProductDto) {
    return this.productService.create(dto);
  }

  // §6.1: BRANCH_MANAGER эрх нь "RU" (update л, create/delete-гүй) тул
  // энд нэмэлтээр орсон.
  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ALL_BRANCH_MANAGER', 'BRANCH_ADMIN', 'BRANCH_MANAGER')
  @Audit('products')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ALL_BRANCH_MANAGER', 'BRANCH_ADMIN')
  @Audit('products')
  remove(@Param('id') id: string) {
    return this.productService.remove(id);
  }
}
