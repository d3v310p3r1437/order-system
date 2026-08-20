import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/roles.guard.js';
import { StorageModule } from '../storage/storage.module.js';
import { CartController } from './cart.controller.js';
import { CartService } from './cart.service.js';

// docs/plan.md §7 модуль #5 (Сагс ба захиалга үүсгэх)-ийн эхний хагас —
// Redis-д суурилсан сагс (checkout логик өөрөө OrderModule-д хэвээр
// үлдэнэ, cart зөвхөн "захиалахаас өмнөх" төлөв). RedisModule/PrismaModule
// @Global тул дахин import хийх шаардлагагүй, харин StorageModule (MinioService,
// зургийн public URL үүсгэхэд) @Global биш тул CatalogModule-тэй адил
// энд тодорхой import хийв.
@Module({
  imports: [StorageModule],
  controllers: [CartController],
  providers: [CartService, RolesGuard],
  // OrderModule (checkout) Redis сагснаас item уншихын тулд CartService-г
  // шаарддаг тул export хийнэ.
  exports: [CartService],
})
export class CartModule {}
