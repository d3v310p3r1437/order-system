import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';

export interface RlsRequestContext {
  // §6.3: хүсэлтийн туршид нээлттэй байх RLS-д хамрагдсан transaction client.
  tx: Prisma.TransactionClient;
  userId: string | null;
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
}
