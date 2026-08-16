import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // ⚠️ NestJS-ийн WebSocket gateway (src/realtime/order-events.gateway.ts)
  // `@nestjs/platform-socket.io` суулгасан ч л гэсэн бодит Socket.io Server
  // болж автоматаар "идэвхжихгүй" — `useWebSocketAdapter()`-г ЗААВАЛ
  // (app.init()/listen()-ээс ӨМНӨ) дуудах ёстой, эс бөгөөс
  // `OrderEventsGateway.afterInit()`-д ирэх `server` объект жинхэнэ
  // Socket.io instance биш (`.adapter()` метод байхгүй) болно.
  app.useWebSocketAdapter(new IoAdapter(app));
  // admin-web (Vite dev server)-ээс browser-аар шууд дуудахыг зөвшөөрнө —
  // §6.2: admin-web Keycloak руу шууд хандахгүй, зөвхөн энэ backend-ээр дамжина.
  app.enableCors({ origin: 'http://localhost:5173', credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
