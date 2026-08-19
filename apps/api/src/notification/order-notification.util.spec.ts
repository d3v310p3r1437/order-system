import {
  buildOrderStatusMessage,
  buildReturnStatusMessage,
} from './order-notification.util.js';

describe('buildOrderStatusMessage', () => {
  it.each(['CONFIRMED', 'READY', 'COMPLETED'] as const)(
    '%s статуст мессеж буцаана',
    (status) => {
      const message = buildOrderStatusMessage(status, 'abcdef12-3456-7890');
      expect(message).not.toBeNull();
      expect(message?.subject).toContain('abcdef12');
      expect(message?.smsBody).toBe(message?.emailBody);
    },
  );

  it.each(['CREATED', 'PREPARING', 'CANCELLED'] as const)(
    '%s статуст null буцаана (trigger болохгүй)',
    (status) => {
      expect(buildOrderStatusMessage(status, 'abcdef12-3456-7890')).toBeNull();
    },
  );
});

describe('buildReturnStatusMessage', () => {
  it.each(['APPROVED', 'REJECTED'] as const)(
    '%s статуст мессеж буцаана',
    (status) => {
      const message = buildReturnStatusMessage(status, 'zzzzzz12-3456-7890');
      expect(message).not.toBeNull();
      expect(message?.subject).toContain('zzzzzz12');
    },
  );

  it.each(['REQUESTED', 'REFUNDED', 'REFUND_FAILED'] as const)(
    '%s статуст null буцаана (trigger болохгүй)',
    (status) => {
      expect(buildReturnStatusMessage(status, 'zzzzzz12-3456-7890')).toBeNull();
    },
  );
});
