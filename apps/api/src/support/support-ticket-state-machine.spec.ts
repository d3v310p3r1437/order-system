import { isTicketTransitionAllowed } from './support-ticket-state-machine.js';

describe('isTicketTransitionAllowed', () => {
  it.each([
    ['OPEN', 'IN_PROGRESS'],
    ['OPEN', 'RESOLVED'],
    ['OPEN', 'CLOSED'],
    ['IN_PROGRESS', 'RESOLVED'],
    ['IN_PROGRESS', 'CLOSED'],
    ['RESOLVED', 'CLOSED'],
    ['RESOLVED', 'IN_PROGRESS'],
  ] as const)('%s → %s зөвшөөрөгдсөн', (from, to) => {
    expect(isTicketTransitionAllowed(from, to)).toBe(true);
  });

  it.each([
    ['OPEN', 'OPEN'],
    ['IN_PROGRESS', 'OPEN'],
    ['RESOLVED', 'OPEN'],
    ['CLOSED', 'OPEN'],
    ['CLOSED', 'IN_PROGRESS'],
    ['CLOSED', 'RESOLVED'],
    ['CLOSED', 'CLOSED'],
  ] as const)('%s → %s зөвшөөрөгдөөгүй', (from, to) => {
    expect(isTicketTransitionAllowed(from, to)).toBe(false);
  });
});
