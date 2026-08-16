import { OrderEventsGateway } from './order-events.gateway.js';

function buildDeps() {
  const verify = jest.fn();
  const tokenVerifier = { verify };

  const branchFindMany = jest.fn().mockResolvedValue([]);
  const orderFindUnique = jest.fn().mockResolvedValue(null);
  const userBranchRoleFindMany = jest.fn().mockResolvedValue([]);
  const userFindUnique = jest.fn().mockResolvedValue(null);
  const fakeTx = {
    branch: { findMany: branchFindMany },
    order: { findUnique: orderFindUnique },
    userBranchRole: { findMany: userBranchRoleFindMany },
    user: { findUnique: userFindUnique },
  };
  const runRequestTransaction = jest.fn(
    (_userId: string, handler: (tx: unknown) => unknown) =>
      Promise.resolve(handler(fakeTx)),
  );
  const prisma = { runRequestTransaction };

  const redis = { duplicate: jest.fn() };

  return {
    tokenVerifier,
    prisma,
    redis,
    mocks: {
      verify,
      branchFindMany,
      orderFindUnique,
      userBranchRoleFindMany,
      userFindUnique,
      runRequestTransaction,
    },
  };
}

function buildSocket(handshakeAuth: Record<string, unknown> = {}) {
  return {
    handshake: { auth: handshakeAuth, headers: {} },
    data: {},
    join: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
  };
}

function newGateway(deps: ReturnType<typeof buildDeps>) {
  return new OrderEventsGateway(
    deps.tokenVerifier as never,
    deps.prisma as never,
    deps.redis as never,
  );
}

// ⚠️ Чухал заль: NestJS-ийн `OnGatewayConnection.handleConnection()` нь
// socket.io-ийн "connection" event-ийн listener маягаар ажилладаг тул
// ASYNC ч гэсэн socket.io ҮҮНИЙГ ХҮЛЭЭДЭГГҮЙ (клиент рүү 'connect' ack
// шууд явчихдаг) — `client.data` бэлэн болохоос ӨМНӨ дараагийн event
// ('subscribe:order') ирж болзошгүй race condition-той (бодит e2e
// тестээр нотлогдсон). Иймд auth+branch-room логикийг `handleConnection`
// БИШ, `afterInit()`-д бүртгэсэн `namespace.use()` middleware-ээр
// (socket.io ҮҮНИЙГ баталгаатай ХҮЛЭЭДЭГ) хийдэг болсон — доорх тестүүд
// яг ТЭР middleware-г (`namespace.use()`-д бүртгэгдсэн callback-ыг барьж
// авч) шалгана.
type AuthMiddleware = (socket: unknown, next: (err?: Error) => void) => void;

function captureAuthMiddleware(gateway: OrderEventsGateway): AuthMiddleware {
  const use = jest.fn<void, [AuthMiddleware]>();
  const namespace = { server: { adapter: jest.fn() }, use };
  gateway.afterInit(namespace as never);
  expect(use).toHaveBeenCalledTimes(1);
  return use.mock.calls[0][0];
}

describe('OrderEventsGateway auth middleware (namespace.use)', () => {
  it('token байхгүй бол next(err)-ээр татгална', async () => {
    const deps = buildDeps();
    deps.redis.duplicate.mockReturnValue({});
    const gateway = newGateway(deps);
    const middleware = captureAuthMiddleware(gateway);
    const socket = buildSocket();
    const next = jest.fn();

    middleware(socket, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('token хүчингүй бол next(err)-ээр татгална', async () => {
    const deps = buildDeps();
    deps.redis.duplicate.mockReturnValue({});
    deps.mocks.verify.mockRejectedValue(new Error('invalid'));
    const gateway = newGateway(deps);
    const middleware = captureAuthMiddleware(gateway);
    const socket = buildSocket({ token: 'bad' });
    const next = jest.fn();

    middleware(socket, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('staff (CUSTOMER биш) холбогдоход өөрт харагдах салбаруудын room-д автоматаар нэгддэг, next() алдаагүй дуудагдана', async () => {
    const deps = buildDeps();
    deps.redis.duplicate.mockReturnValue({});
    deps.mocks.verify.mockResolvedValue({ localUserId: 'staff-1' });
    deps.mocks.userBranchRoleFindMany.mockResolvedValue([
      { role: 'BRANCH_MANAGER' },
    ]);
    deps.mocks.branchFindMany.mockResolvedValue([{ id: 'b-1' }, { id: 'b-2' }]);
    const gateway = newGateway(deps);
    const middleware = captureAuthMiddleware(gateway);
    const socket = buildSocket({ token: 'good' });
    const next = jest.fn();

    middleware(socket, next);
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledWith();
    expect(socket.join).toHaveBeenCalledWith('branch:b-1');
    expect(socket.join).toHaveBeenCalledWith('branch:b-2');
    expect(socket.data).toEqual({
      userId: 'staff-1',
      roles: ['BRANCH_MANAGER'],
    });
  });

  it('CUSTOMER холбогдоход branch room-д автоматаар нэгддэггүй', async () => {
    const deps = buildDeps();
    deps.redis.duplicate.mockReturnValue({});
    deps.mocks.verify.mockResolvedValue({ localUserId: 'cust-1' });
    deps.mocks.userBranchRoleFindMany.mockResolvedValue([]);
    deps.mocks.userFindUnique.mockResolvedValue({
      authProvider: 'CUSTOMER_AUTH',
    });
    deps.mocks.branchFindMany.mockResolvedValue([]);
    const gateway = newGateway(deps);
    const middleware = captureAuthMiddleware(gateway);
    const socket = buildSocket({ token: 'good' });
    const next = jest.fn();

    middleware(socket, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledWith();
    expect(socket.join).not.toHaveBeenCalled();
  });
});

describe('OrderEventsGateway.handleSubscribeOrder', () => {
  it('RLS-ээр Order харагдвал order room-д нэгдэнэ', async () => {
    const deps = buildDeps();
    deps.mocks.orderFindUnique.mockResolvedValue({ id: 'o-1' });
    const gateway = newGateway(deps);
    const socket = buildSocket();
    socket.data = { userId: 'cust-1', roles: ['CUSTOMER'] };

    await gateway.handleSubscribeOrder(socket as never, 'o-1');

    expect(socket.join).toHaveBeenCalledWith('order:o-1');
  });

  it('RLS-ээр Order харагдахгүй бол (өөр хэрэглэгчийн захиалга) room-д нэгддэггүй', async () => {
    const deps = buildDeps();
    deps.mocks.orderFindUnique.mockResolvedValue(null);
    const gateway = newGateway(deps);
    const socket = buildSocket();
    socket.data = { userId: 'cust-1', roles: ['CUSTOMER'] };

    await gateway.handleSubscribeOrder(socket as never, 'o-other');

    expect(socket.join).not.toHaveBeenCalled();
  });
});

describe('OrderEventsGateway.emitOrderStatusChanged', () => {
  it('order:${orderId} БОЛОН branch:${branchId} room руу event нийтэлнэ', () => {
    const deps = buildDeps();
    const gateway = newGateway(deps);
    const emit = jest.fn();
    const to2 = jest.fn().mockReturnValue({ emit });
    const to1 = jest.fn().mockReturnValue({ to: to2 });
    (gateway as unknown as { server: unknown }).server = { to: to1 };

    gateway.emitOrderStatusChanged({
      orderId: 'o-1',
      branchId: 'b-1',
      customerId: 'cust-1',
      oldStatus: 'CREATED',
      newStatus: 'CONFIRMED',
    });

    expect(to1).toHaveBeenCalledWith('order:o-1');
    expect(to2).toHaveBeenCalledWith('branch:b-1');
    expect(emit).toHaveBeenCalledWith(
      'order.status_changed',
      expect.objectContaining({ orderId: 'o-1', newStatus: 'CONFIRMED' }),
    );
  });
});

describe('OrderEventsGateway.emitOrderPaymentConfirmed', () => {
  it('order:${orderId} БОЛОН branch:${branchId} room руу event нийтэлнэ', () => {
    const deps = buildDeps();
    const gateway = newGateway(deps);
    const emit = jest.fn();
    const to2 = jest.fn().mockReturnValue({ emit });
    const to1 = jest.fn().mockReturnValue({ to: to2 });
    (gateway as unknown as { server: unknown }).server = { to: to1 };

    gateway.emitOrderPaymentConfirmed({
      orderId: 'o-1',
      branchId: 'b-1',
      customerId: 'cust-1',
    });

    expect(to1).toHaveBeenCalledWith('order:o-1');
    expect(to2).toHaveBeenCalledWith('branch:b-1');
    expect(emit).toHaveBeenCalledWith(
      'order.payment_confirmed',
      expect.objectContaining({ orderId: 'o-1', customerId: 'cust-1' }),
    );
  });
});
