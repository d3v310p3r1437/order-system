import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/roles.guard.js';
import { CategoryController } from './category/category.controller.js';
import { CategoryService } from './category/category.service.js';
import { ProductVariantController } from './product-variant/product-variant.controller.js';
import { ProductVariantService } from './product-variant/product-variant.service.js';
import { ProductController } from './product/product.controller.js';
import { ProductService } from './product/product.service.js';

// docs/plan.md §7 модуль #3 (Бүтээгдэхүүний каталог): Category/Product/
// ProductVariant CRUD API-г нэг модульд нэгтгэв.
@Module({
  controllers: [
    CategoryController,
    ProductController,
    ProductVariantController,
  ],
  providers: [
    CategoryService,
    ProductService,
    ProductVariantService,
    RolesGuard,
  ],
})
export class CatalogModule {}
