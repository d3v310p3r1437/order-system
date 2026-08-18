import { Module } from '@nestjs/common';
import { MeilisearchService } from './meilisearch.service.js';
import { SearchIndexer } from './search-indexer.service.js';

// docs/plan.md §8 Phase 2 Хэсэг B. CatalogModule импортолж, ProductService
// (индексжилт) БОЛОН SearchController (хайлт) хоёуланд нь ашиглана —
// RealtimeModule/StorageModule-той ижил зарчмаар @Global биш.
@Module({
  providers: [MeilisearchService, SearchIndexer],
  exports: [MeilisearchService, SearchIndexer],
})
export class SearchModule {}
