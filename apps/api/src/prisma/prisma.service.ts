import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient, type Prisma } from '@prisma/client';
import { RequestContextService } from '../common/request-context.js';

// §6.3 ADR (docs/adr/001-rls-transaction-pattern.md): бүх query
// `app_runtime` (RLS-д хамрагдсан, superuser БИШ) холболтоор дамжина.
// Migration/DDL зөвхөн superuser `app` холболтоор (DATABASE_URL) хийгдэнэ.
//
// docs/adr/003-prisma-6-pin.md: Prisma 6.x классик `prisma-client-js`
// generator ашигладаг тул driver adapter (@prisma/adapter-pg) шаардлагагүй —
// datasources.db.url-аар шууд холбогдоно.
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly requestContext: RequestContextService) {
    super({
      datasources: { db: { url: process.env.APP_DATABASE_URL } },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // RLS-д хамрагдсан query бичихэд ашиглах transaction client. Зөвхөн
  // RlsMiddleware-ээр нээгдсэн, хүсэлтийн AsyncLocalStorage контекст дотор
  // дуудагдана.
  get tx(): Prisma.TransactionClient {
    return this.requestContext.get().tx;
  }

  // RlsMiddleware-ээс дуудагдана: хүсэлт бүрийн эхэнд interactive
  // transaction нээж, app.user_id session variable-ыг SET LOCAL-тай
  // адилаар (set_config, is_local=true) тохируулна. `handler` дуусах
  // (өөрөөр хэлбэл response 'finish'/'close' болох) хүртэл transaction
  // нээлттэй хэвээр байна — §11 эрсдэл: connection pool sizing анхаарах.
  async runRequestTransaction<T>(
    userId: string | null,
    handler: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.user_id', ${userId ?? ''}, true)`;
      return handler(tx);
    });
  }
}
