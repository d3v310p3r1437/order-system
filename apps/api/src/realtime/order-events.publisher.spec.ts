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
});
