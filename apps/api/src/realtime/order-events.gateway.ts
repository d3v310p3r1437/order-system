import { Logger, type OnApplicationShutdown } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Redis } from 'ioredis';
import type { Namespace, Server, Socket } from 'socket.io';
import { TokenVerifierService } from '../auth/token-verifier.service.js';
import { resolveUserRoleNames } from '../common/user-roles.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import {
  ORDER_PAYMENT_CONFIRMED_EVENT,
  ORDER_STATUS_CHANGED_EVENT,
  RETURN_STATUS_CHANGED_EVENT,
  branchRoom,
  orderRoom,
  type OrderPaymentConfirmedPayload,
  type OrderStatusChangedPayload,
  type ReturnStatusChangedPayload,
} from './order-events.types.js';

interface SocketData {
  userId: string;
  roles: string[];
}

// docs/plan.md Phase 3b, Хэсэг A: захиалгын статусын бодит цагийн
// мэдэгдэл. RLS-ийн зарчмыг (§6.3) WebSocket давхаргад мөн room-based
// байдлаар баримталсан:
// - Staff (CUSTOMER-ээс бусад) холбогдох мөчид өөрт харагдах салбаруудын
//   `branch:${branchId}` room-д автоматаар нэгддэг — жагсаалт RLS-ээр аль
//   хэдийн шүүгдсэн (§6.1 "Салбар" мөр, `GET /branches`-тэй ижил query)
//   тул шинэ SECURITY DEFINER функц шаардлагагүй (ADR 005: RLS аль
//   хэдийн зөв уншиж байгаа тохиолдолд дахин ашиглана).
// - CUSTOMER захиалгын дэлгэц нээх мөчдөө `subscribe:order` event-ээр
//   тодорхой orderId-г хүсэлт болгоно — `order:${orderId}` room-д зөвхөн
//   тухайн Order-ыг RLS-ээр (orders_select) харах эрхтэй бол л нэгдэнэ
//   (`verifyOrderAccess`).
@WebSocketGateway({
  // main.ts-ийн enableCors()-той ЯГ адил 5273 (2026-08-19 порт шилжилт).
  cors: { origin: 'http://localhost:5273', credentials: true },
  namespace: '/ws/orders',
})
export class OrderEventsGateway
  implements OnGatewayInit, OnApplicationShutdown
{
  private readonly logger = new Logger(OrderEventsGateway.name);
  private pubSubClients: Redis[] = [];

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly tokenVerifier: TokenVerifierService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ⚠️ Чухал заль (race condition): NestJS-ийн `OnGatewayConnection.
  // handleConnection()` lifecycle hook нь socket.io-ийн ЖИНХЭНЭ холболтын
  // "connection" event-ийн listener маягаар ажилладаг тул ASYNC байсан ч
  // socket.io үүнийг ХҮЛЭЭДЭГГҮЙ — клиент рүү 'connect' handshake ack ямар ч
  // хойшлолтгүй, `handleConnection`-ий дотоод `await this.resolveAccess()`
  // (бодит Postgres query) дуусахаас ӨМНӨ илгээгдчихдэг. Иймд клиент
  // 'connect'-ийг хүлээгээд ШУУД дараагийн event ('subscribe:order')
  // явуулбал, сервэр тал `client.data` хараахан тавигдаагүй ("өнчин")
  // байхад тэр message-г хүлээн авах эрсдэлтэй — бодит e2e тестээр
  // (client.data={} гэж илэрсэн) нотлогдсон.
  //
  // Шийдэл: `handleConnection`-ий оронд socket.io-ийн НАМЕСПЕЙС ТҮВШНИЙ
  // middleware (`namespace.use()`) ашиглана — энэ нь socket.io-ийн
  // баталгаажуулсан зарчмаар ASYNC ч ХҮЛЭЭГДДЭГ (клиент 'connect'-ийг
  // ЗӨВХӨН middleware бүрэн дууссаны (эсвэл next(err)-ээр татгалзсаны)
  // ДАРАА л хүлээн авна) тул `client.data` баталгаатай бэлэн байхаас
  // өмнө ямар ч message боловсруулагдахгүй.
  afterInit(namespace: Namespace): void {
    const server = namespace.server;
    const pubClient = this.redis.duplicate();
    const subClient = this.redis.duplicate();
    this.pubSubClients = [pubClient, subClient];
    server.adapter(createAdapter(pubClient, subClient));

    namespace.use((client, next) => {
      this.authenticateAndJoinBranches(client)
        .then(() => next())
        .catch((err: unknown) => {
          this.logger.warn(
            `WebSocket холболт баталгаажсангүй: ${err instanceof Error ? err.message : String(err)}`,
          );
          next(err instanceof Error ? err : new Error(String(err)));
        });
    });
  }

  // `.duplicate()`-аар нээсэн 2 холболтыг апп/тест хаагдахад хамт хааж
  // өгөхгүй бол connection leak болно (жиш: e2e тестүүд "worker process
  // failed to exit gracefully" анхааруулга өгдөг байсан). ЗААВАЛ
  // `OnApplicationShutdown` (`OnModuleDestroy` БИШ) ашиглана: Nest-ийн
  // `close()` дараалал `callDestroyHook()` (OnModuleDestroy)-г WS
  // server-ийг хаахаас (`dispose()`, socket.io-ийн Redis adapter энэ
  // үед л өөрийн unsubscribe-ээ хийдэг) ӨМНӨ дуудна — тул OnModuleDestroy
  // ашиглавал adapter хараахан ашиглаж байгаа холболтыг бид түрүүлж
  // тасалж, "Connection is closed" алдаа гаргадаг байсан.
  // `onApplicationShutdown()` нь `dispose()`-ийн ДАРАА дуудагддаг тул
  // энд аюулгүй.
  //
  // ⚠️ `.disconnect()` (шууд, огцом тасрах) БИШ `.quit()` (эелдэг,
  // гүйцээгээгүй command-уудыг дуусгаад хаах) ашиглана — `dispose()`
  // дотор RedisAdapter.close() өөрөө нэмэлт `unsubscribe` command
  // асинхроноор (await-гүй, "fire and forget") явуулдаг тул `dispose()`
  // амжилттай "дуусахад" тэр unsubscribe хараахан in-flight байж болзошгүй
  // — үүн дээр `.disconnect()`-ээр огцом тасалбал тухайн command
  // "Connection is closed" алдаагаар reject хийгдэж, ямар ч `.catch()`
  // атгаагүй тул unhandled rejection-оор Node процессыг унагаадаг байсан
  // (e2e тестийн worker process crash-аар илэрсэн).
  async onApplicationShutdown(): Promise<void> {
    await Promise.all(
      this.pubSubClients.map((client) => client.quit().catch(() => {})),
    );
  }

  private async authenticateAndJoinBranches(client: Socket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) {
      throw new Error('token алга');
    }
    const { localUserId } = await this.tokenVerifier.verify(token);
    const { roles, branchIds } = await this.resolveAccess(localUserId);

    (client.data as SocketData) = { userId: localUserId, roles };

    // CUSTOMER-д "Салбар" эрх §6.1 матрицаар бүрмөсөн байхгүй (RLS
    // branches_select 0 мөр буцаана) тул branchIds хоосон байх боловч,
    // тодорхой байлгах үүднээс staff л автомат branch room-д нэгдэнэ.
    if (!roles.includes('CUSTOMER')) {
      for (const branchId of branchIds) {
        await client.join(branchRoom(branchId));
      }
    }
  }

  // Клиент (жиш: харилцагчийн мобайл апп, ирээдүйд) тодорхой захиалгынхаа
  // дэлгэцийг нээхэд дуудна. RLS-тэй ижил "харагдах эсэх" шалгалтыг
  // `orders_select` policy-гоор л (шинэ SECURITY DEFINER функцгүйгээр)
  // дамжуулна — тухайн userId-ийн session-ээр Order-ыг уншиж чадвал л
  // room-д нэгдэнэ. `namespace.use()` middleware (дээрх afterInit) бүрэн
  // дууссаны ДАРАА л энэ handler дуудагддаг тул `client.data` баталгаатай
  // бэлэн байна.
  @SubscribeMessage('subscribe:order')
  async handleSubscribeOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() orderId: unknown,
  ): Promise<void> {
    const data = client.data as SocketData | undefined;
    if (!data?.userId || typeof orderId !== 'string' || !orderId) {
      return;
    }
    const canView = await this.verifyOrderAccess(data.userId, orderId);
    if (canView) {
      await client.join(orderRoom(orderId));
    }
  }

  // OrderEventsPublisher-ээс (зөвхөн RLS transaction амжилттай commit
  // хийгдсэний дараа, docs/plan.md Хэсэг A #2) дуудагдана.
  emitOrderStatusChanged(payload: OrderStatusChangedPayload): void {
    this.server
      .to(orderRoom(payload.orderId))
      .to(branchRoom(payload.branchId))
      .emit(ORDER_STATUS_CHANGED_EVENT, payload);
  }

  // docs/adr/006: PaymentService-ээс зөвхөн `app_mark_order_paid()`
  // ЖИНХЭНЭ 'MARKED_PAID' буцаасан (idempotent давталт биш, ШИНЭЭР
  // paidAt тавигдсан) үед л дуудагдана.
  emitOrderPaymentConfirmed(payload: OrderPaymentConfirmedPayload): void {
    this.server
      .to(orderRoom(payload.orderId))
      .to(branchRoom(payload.branchId))
      .emit(ORDER_PAYMENT_CONFIRMED_EVENT, payload);
  }

  // ReturnRequestService-ээс (зөвхөн RLS transaction амжилттай commit
  // хийгдсэний дараа) дуудагдана — §7 модуль #9, §8 Phase 3c.
  emitReturnStatusChanged(payload: ReturnStatusChangedPayload): void {
    this.server
      .to(orderRoom(payload.orderId))
      .to(branchRoom(payload.branchId))
      .emit(RETURN_STATUS_CHANGED_EVENT, payload);
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token as unknown;
    if (typeof authToken === 'string' && authToken) {
      return authToken;
    }
    const header = client.handshake.headers.authorization;
    if (header?.toLowerCase().startsWith('bearer ')) {
      return header.slice('bearer '.length).trim();
    }
    return null;
  }

  private async resolveAccess(
    userId: string,
  ): Promise<{ roles: string[]; branchIds: string[] }> {
    return this.prisma.runRequestTransaction(userId, async (tx) => {
      const roles = await resolveUserRoleNames(tx, userId);
      // branches_select RLS-ийг л дахин ашиглана (§6.1 "Салбар" мөр) —
      // GET /branches-тэй ижил зарчим, шинэ query/функц зохиогоогүй.
      const branches = await tx.branch.findMany({ select: { id: true } });
      return { roles, branchIds: branches.map((b) => b.id) };
    });
  }

  private async verifyOrderAccess(
    userId: string,
    orderId: string,
  ): Promise<boolean> {
    const order = await this.prisma.runRequestTransaction(userId, (tx) =>
      tx.order.findUnique({ where: { id: orderId }, select: { id: true } }),
    );
    return order !== null;
  }
}
