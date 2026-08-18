import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/roles.guard.js';
import { SearchModule } from '../search/search.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { CategoryController } from './category/category.controller.js';
import { CategoryService } from './category/category.service.js';
import { ProductImageController } from './product-image/product-image.controller.js';
import { ProductImageService } from './product-image/product-image.service.js';
import { ProductVariantController } from './product-variant/product-variant.controller.js';
import { ProductVariantService } from './product-variant/product-variant.service.js';
import { ProductController } from './product/product.controller.js';
import { ProductService } from './product/product.service.js';
import { SearchController } from './search/search.controller.js';

// docs/plan.md §7 модуль #3 (Бүтээгдэхүүний каталог): Category/Product/
// ProductVariant CRUD API-г нэг модульд нэгтгэв. Phase 2 Хэсэг A/B: MinIO
// зураг (StorageModule) БОЛОН Meilisearch хайлт (SearchModule) нэмэгдэв —
// OrderModule-ийн RealtimeModule/PaymentModule-той ижил зарчмаар зөвхөн
// хэрэгтэй модулиудыг импортолсон (@Global биш).
@Module({
  imports: [StorageModule, SearchModule],
  controllers: [
    CategoryController,
    ProductController,
    ProductVariantController,
    ProductImageController,
    SearchController,
  ],
  providers: [
    CategoryService,
    ProductService,
    ProductVariantService,
    ProductImageService,
    RolesGuard,
  ],
})
export class CatalogModule {}
