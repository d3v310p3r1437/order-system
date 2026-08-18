import { SearchIndexer } from './search-indexer.service.js';
import type { ProductSearchDocument } from './product-search-document.js';

function buildDoc(): ProductSearchDocument {
  return {
    id: 'p-1',
    name: 'Ноолуур цамц',
    description: null,
    brand: 'Gobi',
    categoryId: 'c-1',
    categoryName: 'Цамц',
    isActive: true,
  };
}

describe('SearchIndexer', () => {
  it('indexProduct() нь ШУУД meilisearch.indexProduct дуудахгүй, зөвхөн requestContext.onCommit()-д бүртгэнэ', () => {
    const indexProduct = jest.fn().mockResolvedValue(undefined);
    const meilisearch = { indexProduct };
    const onCommit = jest.fn<void, [() => void]>();
    const requestContext = { onCommit };

    const indexer = new SearchIndexer(
      meilisearch as never,
      requestContext as never,
    );
    const doc = buildDoc();

    indexer.indexProduct(doc);

    expect(indexProduct).not.toHaveBeenCalled();
    expect(onCommit).toHaveBeenCalledTimes(1);

    // onCommit-д бүртгэсэн callback-г ГАРНААС (RlsMiddleware) дуудвал л
    // Meilisearch руу бодитоор бичигдэнэ (order-events.publisher.spec.ts-тэй
    // ижил загвар).
    const registeredCallback = onCommit.mock.calls[0][0];
    registeredCallback();
    expect(indexProduct).toHaveBeenCalledWith(doc);
  });

  it('deleteProduct() мөн адил onCommit()-оор хойшлуулна', () => {
    const deleteProduct = jest.fn().mockResolvedValue(undefined);
    const meilisearch = { deleteProduct };
    const onCommit = jest.fn<void, [() => void]>();
    const requestContext = { onCommit };

    const indexer = new SearchIndexer(
      meilisearch as never,
      requestContext as never,
    );

    indexer.deleteProduct('p-1');

    expect(deleteProduct).not.toHaveBeenCalled();
    const registeredCallback = onCommit.mock.calls[0][0];
    registeredCallback();
    expect(deleteProduct).toHaveBeenCalledWith('p-1');
  });

  it('indexProduct()-ийн onCommit callback дотор Meilisearch алдаа шидвэл (Promise reject) unhandled rejection болохгүй, зөвхөн лог бичнэ', async () => {
    const indexProduct = jest.fn().mockRejectedValue(new Error('network'));
    const meilisearch = { indexProduct };
    const onCommit = jest.fn<void, [() => void]>();
    const requestContext = { onCommit };

    const indexer = new SearchIndexer(
      meilisearch as never,
      requestContext as never,
    );
    indexer.indexProduct(buildDoc());

    const registeredCallback = onCommit.mock.calls[0][0];
    expect(() => registeredCallback()).not.toThrow();
    // Дотоод promise chain дуусахыг хүлээж, .catch()-оор баригдсаныг баталгаажуулна.
    await new Promise((resolve) => setImmediate(resolve));
    expect(indexProduct).toHaveBeenCalled();
  });

  it('reindexAll() docs хоосон биш бол meilisearch.indexProducts-ийг шууд (onCommit-гүйгээр) дуудна', async () => {
    const indexProducts = jest.fn().mockResolvedValue(undefined);
    const meilisearch = { indexProducts };
    const onCommit = jest.fn();
    const requestContext = { onCommit };

    const indexer = new SearchIndexer(
      meilisearch as never,
      requestContext as never,
    );
    const docs = [buildDoc()];

    await indexer.reindexAll(docs);

    expect(onCommit).not.toHaveBeenCalled();
    expect(indexProducts).toHaveBeenCalledWith(docs);
  });

  it('reindexAll() docs хоосон бол meilisearch-г огт дуудахгүй', async () => {
    const indexProducts = jest.fn().mockResolvedValue(undefined);
    const meilisearch = { indexProducts };
    const requestContext = { onCommit: jest.fn() };

    const indexer = new SearchIndexer(
      meilisearch as never,
      requestContext as never,
    );

    await indexer.reindexAll([]);

    expect(indexProducts).not.toHaveBeenCalled();
  });
});
