import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module.js';
import { AuthCustomerModule } from './auth-customer/auth-customer.module.js';
import { AuthStaffModule } from './auth-staff/auth-staff.module.js';
import { AuditInterceptor } from './common/audit.interceptor.js';
import { RlsMiddleware } from './common/rls.middleware.js';
import { DebugController } from './debug/debug.controller.js';
import { HealthController } from './health/health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RedisModule } from './redis/redis.module.js';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    AuthModule,
    AuthCustomerModule,
    AuthStaffModule,
  ],
  controllers: [AppController, DebugController, HealthController],
  providers: [
    AppService,
    RlsMiddleware,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RlsMiddleware).exclude('health').forRoutes('*');
  }
}
