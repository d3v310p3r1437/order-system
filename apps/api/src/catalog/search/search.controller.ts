import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../common/roles.decorator.js';
import { RolesGuard } from '../../common/roles.guard.js';
import { MeilisearchService } from '../../search/meilisearch.service.js';
import { ProductService } from '../product/product.service.js';
import { SearchProductsQueryDto } from './dto/search-products.dto.js';

// docs/plan.md §8 Phase 2 Хэсэг B, даалгавар #9. @Roles()-гүй тул
// ProductController.findOne-тэй ЯГ ижил зарчим (§6.1-ийн "бүх нэвтэрсэн
// хэрэглэгчид" эрхтэй тохирно) — "public" гэдгийг энэ codebase-д "ямар ч
// role шаардахгүй, гэхдээ нэвтэрсэн байх ёстой" гэж тогтмол ойлгосон
// (products_select RLS policy `app_current_user_id() IS NOT NULL`
// шаарддаг тул интернэтэд бүрэн анонимаар нээлттэй болгох нь одоо байгаа
// каталогийн БҮХ RLS-ийн урьдал нөхцлийг өөрчлөх том архитектурын
// шийдвэр болох тул энэ даалгаврын хүрээнд хийгээгүй).
@Controller('catalog')
@UseGuards(RolesGuard)
export class SearchController {
  constructor(
    private readonly meilisearch: MeilisearchService,
    private readonly productService: ProductService,
  ) {}

  // (2026-09-05) Хариу бүтэц `{products, facets}` болж өргөтгөв (өмнө нь
  // зөвхөн products[] буцаадаг байсан) — facets.colors/sizes нь мобайл/
  // admin-web талд боломжит chip-үүдийг ДИНАМИКААР үүсгэхэд ашиглагдана
  // (docs/plan.md §7 модуль #3-ийн UX сайжруулалт).
  @Get('search')
  async search(@Query() query: SearchProductsQueryDto) {
    const { ids, facets } = await this.meilisearch.search(query.q ?? '', {
      categoryId: query.categoryId,
      color: query.color,
      size: query.size,
    });
    const products = await this.productService.findManyWithAvailability(
      ids,
      query.branchId,
    );
    return { products, facets };
  }

  // §8 Phase 2, даалгавар #10: нэг удаагийн bulk-reindex, SUPER_ADMIN-д
  // зориулав. Энэ нь DB мутаци биш (зөвхөн унших + Meilisearch руу
  // бичих) тул @Audit шаардлагагүй.
  @Post('search/reindex')
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async reindex() {
    const reindexed = await this.productService.reindexAll();
    return { reindexed };
  }
}
