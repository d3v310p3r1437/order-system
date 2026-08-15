import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module.js';
import { AuthCustomerModule } from './auth-customer/auth-customer.module.js';
import { RlsMiddleware } from './common/rls.middleware.js';
import { DebugController } from './debug/debug.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RedisModule } from './redis/redis.module.js';

@Module({
  imports: [PrismaModule, RedisModule, AuthModule, AuthCustomerModule],
  controllers: [AppController, DebugController],
  providers: [AppService, RlsMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RlsMiddleware).forRoutes('*');
  }
}
