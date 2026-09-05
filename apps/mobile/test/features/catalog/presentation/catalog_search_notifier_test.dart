import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/catalog/domain/availability.dart';
import 'package:mobile/features/catalog/presentation/catalog_providers.dart';

import '../../../support/fake_catalog_repository.dart';

void main() {
  late FakeCatalogRepository repository;
  late ProviderContainer container;

  setUp(() {
    repository = FakeCatalogRepository()..searchHandler = (q, c) => [];
    container = ProviderContainer(
      overrides: [catalogRepositoryProvider.overrideWithValue(repository)],
    );
    addTearDown(container.dispose);
  });

  test('анхны build() хоосон filter-ээр нэг удаа хайна', () async {
    await container.read(catalogSearchProvider.future);

    expect(repository.searchCallCount, 1);
    expect(
      repository.searchCalls.single,
      (q: '', categoryId: null, color: null, size: null),
    );
  });

  test('дараалсан setQuery() debounce хугацаанд зөвхөн СҮҮЛИЙН query-гээр нэг л удаа хайна', () async {
    await container.read(catalogSearchProvider.future);
    final notifier = container.read(catalogSearchProvider.notifier);

    notifier.setQuery('а');
    notifier.setQuery('ап');
    notifier.setQuery('апп');
    // Debounce (300мс) хараахан дуусаагүй тул шинэ хайлт эхлээгүй байх ёстой.
    expect(repository.searchCallCount, 1);

    await Future<void>.delayed(const Duration(milliseconds: 400));

    expect(repository.searchCallCount, 2);
    expect(
      repository.searchCalls.last,
      (q: 'апп', categoryId: null, color: null, size: null),
    );
  });

  test('setCategory() debounce-гүйгээр ШУУД дахин хайна', () async {
    await container.read(catalogSearchProvider.future);
    final notifier = container.read(catalogSearchProvider.notifier);

    notifier.setCategory('category-1');
    await Future<void>.delayed(const Duration(milliseconds: 50));

    expect(repository.searchCallCount, 2);
    expect(
      repository.searchCalls.last,
      (q: '', categoryId: 'category-1', color: null, size: null),
    );
    expect(container.read(catalogSearchProvider).hasError, isFalse);
  });

  test('query бичиж байхад ангилал сонговол debounce-д хүлээгдэж байсан query цуцлагдана', () async {
    await container.read(catalogSearchProvider.future);
    final notifier = container.read(catalogSearchProvider.notifier);

    notifier.setQuery('гутал');
    notifier.setCategory('category-2');
    await Future<void>.delayed(const Duration(milliseconds: 400));

    // Зөвхөн ангиллын дуудлага л биелнэ (query-ийн debounce цуцлагдсан) —
    // хайлт нийт 2 удаа (анхны build + категорийн шууд дуудлага).
    expect(repository.searchCallCount, 2);
    expect(
      repository.searchCalls.last,
      (q: 'гутал', categoryId: 'category-2', color: null, size: null),
    );
  });

  test('хайлт алдаа буцаавал AsyncError төлөвт орно', () async {
    await container.read(catalogSearchProvider.future);
    repository.searchError = Exception('network down');
    final notifier = container.read(catalogSearchProvider.notifier);

    notifier.setCategory('category-1');
    await Future<void>.delayed(const Duration(milliseconds: 50));

    expect(container.read(catalogSearchProvider).hasError, isTrue);
  });

  test('setColor()/setSize() debounce-гүйгээр ШУУД дахин хайж, query параметрт дамжуулна', () async {
    await container.read(catalogSearchProvider.future);
    final notifier = container.read(catalogSearchProvider.notifier);

    notifier.setColor('улаан');
    await Future<void>.delayed(const Duration(milliseconds: 50));
    expect(repository.searchCallCount, 2);
    expect(
      repository.searchCalls.last,
      (q: '', categoryId: null, color: 'улаан', size: null),
    );

    notifier.setSize('M');
    await Future<void>.delayed(const Duration(milliseconds: 50));
    expect(repository.searchCallCount, 3);
    expect(
      repository.searchCalls.last,
      (q: '', categoryId: null, color: 'улаан', size: 'M'),
    );
  });

  test('setStatus() СҮЛЖЭЭГЭЭР дахин ДУУДАХГҮЙ, сүүлд ирсэн raw үр дүнгээс клиент талд шүүнэ', () async {
    repository.searchHandler = (q, c) => [
      buildTestProduct(id: 'in-stock', status: AvailabilityStatus.inStock),
      buildTestProduct(id: 'pre-order', status: AvailabilityStatus.preOrder),
    ];
    await container.read(catalogSearchProvider.future);
    final notifier = container.read(catalogSearchProvider.notifier);
    expect(repository.searchCallCount, 1);

    notifier.setStatus(AvailabilityStatus.inStock);

    // Сүлжээгээр дахин ДУУДАГДААГҮЙ — зөвхөн клиент талд шүүгдсэн.
    expect(repository.searchCallCount, 1);
    final state = container.read(catalogSearchProvider).requireValue;
    expect(state.products.map((p) => p.id), ['in-stock']);
  });
}
