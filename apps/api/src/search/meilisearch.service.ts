import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { MeiliSearch, type Index } from 'meilisearch';
import type { ProductSearchDocument } from './product-search-document.js';

const INDEX_NAME = 'products';

// docs/plan.md §8 Phase 2 Хэсэг B, даалгавар #8: Product индекс. onModuleInit
// дотор index+тохиргоог idempotent байдлаар бэлдэнэ (PrismaService/
// MinioService-ийн onModuleInit-тэй ижил зарчим).
@Injectable()
export class MeilisearchService implements OnModuleInit {
  private readonly logger = new Logger(MeilisearchService.name);
  private readonly client: MeiliSearch;

  constructor() {
    this.client = new MeiliSearch({
      host: process.env.MEILI_URL ?? 'http://localhost:7700',
      apiKey: process.env.MEILI_MASTER_KEY,
    });
  }

  private get index(): Index<ProductSearchDocument> {
    return this.client.index<ProductSearchDocument>(INDEX_NAME);
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client
        .createIndex(INDEX_NAME, { primaryKey: 'id' })
        .waitTask();
    } catch (err) {
      // Индекс аль хэдийн байгаа бол Meilisearch алдаа буцаана — idempotent
      // эхлүүлэлт тул үл тоомсорлоно.
      this.logger.debug(
        `Индекс "${INDEX_NAME}" аль хэдийн байгаа: ${String(err)}`,
      );
    }
    try {
      await this.index
        .updateSearchableAttributes([
          'name',
          'description',
          'brand',
          'categoryName',
        ])
        .waitTask();
      await this.index
        .updateFilterableAttributes(['categoryId', 'isActive'])
        .waitTask();
    } catch (err) {
      this.logger.warn(
        `Meilisearch тохиргоо (searchable/filterable attributes) хийхэд алдаа гарлаа: ${String(err)}`,
      );
    }
  }

  async indexProduct(doc: ProductSearchDocument): Promise<void> {
    await this.index.addDocuments([doc]).waitTask();
  }

  async indexProducts(docs: ProductSearchDocument[]): Promise<void> {
    await this.index.addDocuments(docs).waitTask();
  }

  async deleteProduct(productId: string): Promise<void> {
    await this.index.deleteDocument(productId).waitTask();
  }

  // q хоосон бол Meilisearch бүх (filter-т тохирсон) мөрийг эрэмбэлэлтгүй
  // буцаадаг — хайлтын талбар хоосон үед ч ангилалаар нэвтрэх боломжтой.
  async search(
    q: string,
    filter: { categoryId?: string } = {},
  ): Promise<string[]> {
    const filterClauses = ['isActive = true'];
    if (filter.categoryId) {
      filterClauses.push(`categoryId = "${filter.categoryId}"`);
    }
    const result = await this.index.search(q || '', {
      filter: filterClauses.join(' AND '),
      // Meilisearch-ийн анхдагч ("last") matching strategy нь query-ийн
      // сүүлийн үгсийг "хаяж" илүү олон (сул холбогдолтой) үр дүн
      // буцаадаг тул (жиш: "цамц ноолуур" гэж хайхад зөвхөн "цамц"
      // агуулсан ХАМААРАЛГҮЙ бараа ч орж ирдэг нь e2e тестээр батлагдсан)
      // "all"-аар query-ийн БҮХ үг заавал тохирохыг шаардаж, илүү
      // тодорхой/урьдчилан таамаглаж болохуйц үр дүн буцаана.
      matchingStrategy: 'all',
    });
    return result.hits.map((hit) => hit.id);
  }
}
