import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

export interface RlsRequestContext {
  // §6.3: хүсэлтийн туршид нээлттэй байх RLS-д хамрагдсан transaction client.
  tx: Prisma.TransactionClient;
  userId: string | null;
  // Phase 3b: `RlsMiddleware`-ийн request-scoped transaction бодитоор
  // COMMIT хийгдсэний ДАРАА л ажиллах ёстой callback-уудын жагсаалт (жиш:
  // WebSocket event нийтлэх — DB бичилт хараахан commit хийгдээгүй байхад
  // event явуулбал, дараа нь тухайн транзакц ямар нэг шалтгаанаар
  // rollback хийгдэх юм бол хэрэглэгчид "худал" event очих эрсдэлтэй).
  // Энэ массив нь `run()`-д дамжуулсан ижил object reference тул
  // callback бүртгэсний дараа ч (тухайн request-ийн туршид) хандах боломжтой.
  afterCommitCallbacks: Array<() => void>;
}

// AsyncLocalStorage ашиглаж, request-scoped provider үүсгэхгүйгээр
// хүсэлт бүрийн RLS transaction/userId-г controller/service давхаргад дамжуулна.
@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RlsRequestContext>();

  run<T>(context: RlsRequestContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  get(): RlsRequestContext {
    const context = this.storage.getStore();
    if (!context) {
      throw new Error(
        'RLS request context алга байна — хүсэлт RlsMiddleware-ээр өнгөрөөгүй байх магадлалтай.',
      );
    }
    return context;
  }

  getOptional(): RlsRequestContext | undefined {
    return this.storage.getStore();
  }

  // Одоогийн хүсэлтийн transaction амжилттай COMMIT хийгдсэний дараа л
  // дуудагдах ёстой callback бүртгэнэ (жиш: `OrderEventsPublisher`) —
  // `RlsMiddleware` transaction амжилттай дуусахад л эдгээрийг ажиллуулна.
  onCommit(callback: () => void): void {
    this.get().afterCommitCallbacks.push(callback);
  }
}
