import { Global, Module } from '@nestjs/common';
import { RequestContextService } from '../common/request-context.js';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [PrismaService, RequestContextService],
  exports: [PrismaService, RequestContextService],
})
export class PrismaModule {}
