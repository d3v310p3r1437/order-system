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
        .updateFilterableAttributes([
          'categoryId',
          'isActive',
          'colors',
          'sizes',
        ])
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
  //
  // (2026-09-05) facets: color/size ШҮҮЛТЭЭС ХАМААРАЛГҮЙ (зөвхөн q+
  // categoryId+isActive-аар) тусад нь тооцоологдоно — учир нь хэрэглэгч
  // "улаан" сонгосны дараа ч "хөх" chip-ийг сонголтоор хэвээр харах ёстой
  // (Meilisearch нь Algolia-ийн "disjunctive facet"-ийг native дэмждэггүй
  // тул хоёр тусдаа хайлт хийж шийдсэн — hits-ийг бодит (color/size-аар
  // ШҮҮСЭН) filter-ээр, facets-ийг НАРИЙСГАЖ ШҮҮГЭЭГҮЙ filter-ээр).
  async search(
    q: string,
    filter: { categoryId?: string; color?: string; size?: string } = {},
  ): Promise<{ ids: string[]; facets: { colors: string[]; sizes: string[] } }> {
    const baseFilterClauses = ['isActive = true'];
    if (filter.categoryId) {
      baseFilterClauses.push(`categoryId = "${filter.categoryId}"`);
    }
    const hitFilterClauses = [...baseFilterClauses];
    if (filter.color) {
      hitFilterClauses.push(`colors = "${filter.color}"`);
    }
    if (filter.size) {
      hitFilterClauses.push(`sizes = "${filter.size}"`);
    }
    // Meilisearch-ийн анхдагч ("last") matching strategy нь query-ийн
    // сүүлийн үгсийг "хаяж" илүү олон (сул холбогдолтой) үр дүн
    // буцаадаг тул (жиш: "цамц ноолуур" гэж хайхад зөвхөн "цамц"
    // агуулсан ХАМААРАЛГҮЙ бараа ч орж ирдэг нь e2e тестээр батлагдсан)
    // "all"-аар query-ийн БҮХ үг заавал тохирохыг шаардаж, илүү
    // тодорхой/урьдчилан таамаглаж болохуйц үр дүн буцаана.
    const [hitsResult, facetResult] = await Promise.all([
      this.index.search(q || '', {
        filter: hitFilterClauses.join(' AND '),
        matchingStrategy: 'all',
      }),
      this.index.search(q || '', {
        filter: baseFilterClauses.join(' AND '),
        matchingStrategy: 'all',
        facets: ['colors', 'sizes'],
        limit: 0,
      }),
    ]);
    const distribution = facetResult.facetDistribution ?? {};
    return {
      ids: hitsResult.hits.map((hit) => hit.id),
      facets: {
        colors: Object.keys(distribution.colors ?? {}).sort(),
        sizes: Object.keys(distribution.sizes ?? {}).sort(),
      },
    };
  }
}
