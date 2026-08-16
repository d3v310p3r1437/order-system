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

describe('OrderEventsGateway.handleConnection', () => {
  it('token байхгүй бол холболтыг таслана', async () => {
    const deps = buildDeps();
    const gateway = newGateway(deps);
    const socket = buildSocket();

    await gateway.handleConnection(socket as never);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('token хүчингүй бол холболтыг таслана', async () => {
    const deps = buildDeps();
    deps.mocks.verify.mockRejectedValue(new Error('invalid'));
    const gateway = newGateway(deps);
    const socket = buildSocket({ token: 'bad' });

    await gateway.handleConnection(socket as never);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it('staff (CUSTOMER биш) холбогдоход өөрт харагдах салбаруудын room-д автоматаар нэгддэг', async () => {
    const deps = buildDeps();
    deps.mocks.verify.mockResolvedValue({ localUserId: 'staff-1' });
    deps.mocks.userBranchRoleFindMany.mockResolvedValue([
      { role: 'BRANCH_MANAGER' },
    ]);
    deps.mocks.branchFindMany.mockResolvedValue([{ id: 'b-1' }, { id: 'b-2' }]);
    const gateway = newGateway(deps);
    const socket = buildSocket({ token: 'good' });

    await gateway.handleConnection(socket as never);

    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(socket.join).toHaveBeenCalledWith('branch:b-1');
    expect(socket.join).toHaveBeenCalledWith('branch:b-2');
  });

  it('CUSTOMER холбогдоход branch room-д автоматаар нэгддэггүй', async () => {
    const deps = buildDeps();
    deps.mocks.verify.mockResolvedValue({ localUserId: 'cust-1' });
    deps.mocks.userBranchRoleFindMany.mockResolvedValue([]);
    deps.mocks.userFindUnique.mockResolvedValue({
      authProvider: 'CUSTOMER_AUTH',
    });
    deps.mocks.branchFindMany.mockResolvedValue([]);
    const gateway = newGateway(deps);
    const socket = buildSocket({ token: 'good' });

    await gateway.handleConnection(socket as never);

    expect(socket.disconnect).not.toHaveBeenCalled();
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
