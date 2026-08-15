import { Global, Module } from '@nestjs/common';
import { RequestContextService } from '../common/request-context.js';
import { RlsMiddleware } from '../common/rls.middleware.js';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [PrismaService, RequestContextService, RlsMiddleware],
  exports: [PrismaService, RequestContextService, RlsMiddleware],
})
export class PrismaModule {}
