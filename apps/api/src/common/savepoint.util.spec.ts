import { withSavepoint } from './savepoint.util.js';

function buildTxMock(): {
  tx: { $executeRawUnsafe: (query: string) => Promise<void> };
  executeRawUnsafe: jest.Mock<Promise<void>, [string]>;
} {
  const executeRawUnsafe = jest.fn<Promise<void>, [string]>(() =>
    Promise.resolve(),
  );
  return { tx: { $executeRawUnsafe: executeRawUnsafe }, executeRawUnsafe };
}

describe('withSavepoint', () => {
  it('амжилттай гүйцэтгэвэл SAVEPOINT нээж, RELEASE хийж, үр дүнг буцаана', async () => {
    const { tx, executeRawUnsafe } = buildTxMock();
    const result = await withSavepoint(tx as never, () =>
      Promise.resolve('ok'),
    );

    expect(result).toBe('ok');
    const calls = executeRawUnsafe.mock.calls.map((c) => c[0]);
    expect(calls[0]).toMatch(/^SAVEPOINT sp_\d+$/);
    expect(calls[1]).toMatch(/^RELEASE SAVEPOINT sp_\d+$/);
  });

  it('fn алдаа шидвэл ROLLBACK TO SAVEPOINT дуудаж, ижил алдааг дахин шидэнэ', async () => {
    const { tx, executeRawUnsafe } = buildTxMock();
    const boom = new Error('boom');

    await expect(
      withSavepoint(tx as never, () => Promise.reject(boom)),
    ).rejects.toBe(boom);

    const calls = executeRawUnsafe.mock.calls.map((c) => c[0]);
    expect(calls[0]).toMatch(/^SAVEPOINT sp_\d+$/);
    expect(calls[1]).toMatch(/^ROLLBACK TO SAVEPOINT sp_\d+$/);
  });

  it('дараалсан дуудлагууд давхцалгүй SAVEPOINT нэр ашиглана', async () => {
    const { tx, executeRawUnsafe } = buildTxMock();
    await withSavepoint(tx as never, () => Promise.resolve(undefined));
    await withSavepoint(tx as never, () => Promise.resolve(undefined));

    const firstName = executeRawUnsafe.mock.calls[0][0].split(' ')[1];
    const secondName = executeRawUnsafe.mock.calls[2][0].split(' ')[1];
    expect(firstName).not.toBe(secondName);
  });
});
