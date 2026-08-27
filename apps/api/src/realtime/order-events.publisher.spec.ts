import { OrderEventsPublisher } from './order-events.publisher.js';

describe('OrderEventsPublisher', () => {
  it('publishOrderStatusChanged() нь ШУУД gateway.emit дуудахгүй, зөвхөн requestContext.onCommit()-д бүртгэнэ', () => {
    const emitOrderStatusChanged = jest.fn();
    const gateway = { emitOrderStatusChanged };
    const onCommit = jest.fn<void, [() => void]>();
    const requestContext = { onCommit };

    const publisher = new OrderEventsPublisher(
      gateway as never,
      requestContext as never,
    );
    const payload = {
      orderId: 'o-1',
      branchId: 'b-1',
      customerId: 'c-1',
      oldStatus: 'CREATED' as const,
      newStatus: 'CONFIRMED' as const,
    };

    publisher.publishOrderStatusChanged(payload);

    expect(emitOrderStatusChanged).not.toHaveBeenCalled();
    expect(onCommit).toHaveBeenCalledTimes(1);

    // onCommit-д бүртгэсэн callback-г ГАРНААС (жиш: RlsMiddleware) дуудвал
    // л gateway.emit явагдана.
    const registeredCallback = onCommit.mock.calls[0][0];
    registeredCallback();
    expect(emitOrderStatusChanged).toHaveBeenCalledWith(payload);
  });

  it('publishOrderPaymentConfirmed() мөн адил onCommit()-оор хойшлуулна', () => {
    const emitOrderPaymentConfirmed = jest.fn();
    const gateway = { emitOrderPaymentConfirmed };
    const onCommit = jest.fn<void, [() => void]>();
    const requestContext = { onCommit };

    const publisher = new OrderEventsPublisher(
      gateway as never,
      requestContext as never,
    );
    const payload = { orderId: 'o-1', branchId: 'b-1', customerId: 'c-1' };

    publisher.publishOrderPaymentConfirmed(payload);

    expect(emitOrderPaymentConfirmed).not.toHaveBeenCalled();
    const registeredCallback = onCommit.mock.calls[0][0];
    registeredCallback();
    expect(emitOrderPaymentConfirmed).toHaveBeenCalledWith(payload);
  });

  it('publishReturnStatusChanged() мөн адил onCommit()-оор хойшлуулна', () => {
    const emitReturnStatusChanged = jest.fn();
    const gateway = { emitReturnStatusChanged };
    const onCommit = jest.fn<void, [() => void]>();
    const requestContext = { onCommit };

    const publisher = new OrderEventsPublisher(
      gateway as never,
      requestContext as never,
    );
    const payload = {
      returnRequestId: 'rr-1',
      orderId: 'o-1',
      branchId: 'b-1',
      customerId: 'c-1',
      status: 'REFUNDED' as const,
    };

    publisher.publishReturnStatusChanged(payload);

    expect(emitReturnStatusChanged).not.toHaveBeenCalled();
    const registeredCallback = onCommit.mock.calls[0][0];
    registeredCallback();
    expect(emitReturnStatusChanged).toHaveBeenCalledWith(payload);
  });

  it('publishSupportMessageCreated() мөн адил onCommit()-оор хойшлуулна', () => {
    const emitSupportMessageCreated = jest.fn();
    const gateway = { emitSupportMessageCreated };
    const onCommit = jest.fn<void, [() => void]>();
    const requestContext = { onCommit };

    const publisher = new OrderEventsPublisher(
      gateway as never,
      requestContext as never,
    );
    const payload = {
      ticketId: 't-1',
      messageId: 'm-1',
      senderId: 'u-1',
      body: 'Сайн байна уу',
      createdAt: new Date().toISOString(),
    };

    publisher.publishSupportMessageCreated(payload);

    expect(emitSupportMessageCreated).not.toHaveBeenCalled();
    const registeredCallback = onCommit.mock.calls[0][0];
    registeredCallback();
    expect(emitSupportMessageCreated).toHaveBeenCalledWith(payload);
  });
});
