import { Module } from '@nestjs/common';
import { MinioService } from './minio.service.js';

// docs/plan.md §8 Phase 2 Хэсэг A: MinIO зураг хадгалалт. RealtimeModule/
// PaymentModule-тэй ижил зарчмаар зөвхөн хэрэгтэй модулиуд (CatalogModule)
// импортолно — @Global биш.
@Module({
  providers: [MinioService],
  exports: [MinioService],
})
export class StorageModule {}
