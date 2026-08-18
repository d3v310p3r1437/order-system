import { Injectable, Logger } from '@nestjs/common';
import { RequestContextService } from '../common/request-context.js';
import { MeilisearchService } from './meilisearch.service.js';
import type { ProductSearchDocument } from './product-search-document.js';

// ProductService-ийн Meilisearch-тэй ганц холбоос — OrderEventsPublisher-тэй
// (src/realtime/order-events.publisher.ts) ЯГ ИЖИЛ загвар: индексжилтийг
// шууд биш, RequestContextService.onCommit()-оор хойшлуулна, учир нь
// ProductService ч мөн адил RlsMiddleware-ийн нэг л том interactive
// transaction (docs/adr/001) дотор ажилладаг тул tx хараахан COMMIT
// хийгдээгүй байхад Meilisearch рүү индекслэвэл, дараа нь transaction
// rollback хийгдэх юм бол хайлтад "худал" (DB-д байхгүй) бүтээгдэхүүн
// гарч ирэх эрсдэлтэй.
@Injectable()
export class SearchIndexer {
  private readonly logger = new Logger(SearchIndexer.name);

  constructor(
    private readonly meilisearch: MeilisearchService,
    private readonly requestContext: RequestContextService,
  ) {}

  indexProduct(doc: ProductSearchDocument): void {
    this.requestContext.onCommit(() => {
      this.meilisearch.indexProduct(doc).catch((err: unknown) => {
        this.logger.warn(
          `Meilisearch индексжилт амжилтгүй боллоо (product ${doc.id}): ${String(err)}`,
        );
      });
    });
  }

  deleteProduct(productId: string): void {
    this.requestContext.onCommit(() => {
      this.meilisearch.deleteProduct(productId).catch((err: unknown) => {
        this.logger.warn(
          `Meilisearch-ээс устгах амжилтгүй боллоо (product ${productId}): ${String(err)}`,
        );
      });
    });
  }

  // Bulk reindex (§8 Phase 2, даалгавар #10) — SUPER_ADMIN-ийн шууд
  // дуудсан, зөвхөн унших үйлдэл дараа ажилладаг тул RLS transaction
  // rollback-ийн эрсдэлгүй; onCommit-оор хойшлуулах шаардлагагүй, шууд
  // дуудна (харин хариу буцахаас өмнө бодитоор дуусгах — SUPER_ADMIN
  // "хэдэн бүтээгдэхүүн индексжсэн бэ" гэдгийг мэдэх ёстой).
  async reindexAll(docs: ProductSearchDocument[]): Promise<void> {
    if (docs.length > 0) {
      await this.meilisearch.indexProducts(docs);
    }
  }
}
