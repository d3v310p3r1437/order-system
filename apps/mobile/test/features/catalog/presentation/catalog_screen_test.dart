import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/features/cart/presentation/cart_providers.dart';
import 'package:mobile/features/catalog/domain/availability.dart';
import 'package:mobile/features/catalog/domain/product.dart';
import 'package:mobile/features/catalog/domain/product_variant.dart';
import 'package:mobile/features/catalog/presentation/catalog_providers.dart';
import 'package:mobile/features/catalog/presentation/catalog_screen.dart';
import 'package:mobile/features/catalog/presentation/widgets/product_card.dart';

import '../../../support/fake_cart_repository.dart';
import '../../../support/fake_catalog_repository.dart';

void main() {
  late FakeCatalogRepository repository;
  late FakeCartRepository cartRepository;

  setUp(() {
    repository = FakeCatalogRepository();
    cartRepository = FakeCartRepository();
  });

  Widget wrap() {
    final router = GoRouter(
      initialLocation: '/catalog',
      routes: [
        GoRoute(path: '/catalog', builder: (context, state) => const CatalogScreen()),
        GoRoute(
          path: '/products/:id',
          builder: (context, state) =>
              Scaffold(body: Text('detail-${state.pathParameters['id']}')),
        ),
      ],
    );
    return ProviderScope(
      overrides: [
        catalogRepositoryProvider.overrideWithValue(repository),
        cartRepositoryProvider.overrideWithValue(cartRepository),
      ],
      child: MaterialApp.router(routerConfig: router),
    );
  }

  testWidgets('өгөгдөл ачаалж байх үед skeleton grid харагдана', (
    tester,
  ) async {
    repository.delay = const Duration(milliseconds: 100);
    repository.searchHandler = (q, c) {
      return [buildTestProduct(id: '1')];
    };
    await tester.pumpWidget(wrap());
    // delay хараахан дуусаагүй тул ачаалж байгаа төлөв харагдана.
    await tester.pump();

    expect(find.byKey(const Key('catalog_grid_skeleton')), findsOneWidget);
    expect(find.byKey(const Key('catalog_grid')), findsNothing);

    await tester.pumpAndSettle();
  });

  testWidgets('өгөгдөлтэй бол grid карт болон үнэ/availability харагдана', (
    tester,
  ) async {
    repository.searchHandler = (q, c) => [
      buildTestProduct(id: '1', name: 'Ноутбүүк', price: '1250000'),
    ];
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('catalog_grid')), findsOneWidget);
    expect(find.text('Ноутбүүк'), findsOneWidget);
    expect(find.text('1,250,000₮'), findsOneWidget);
    // "Бэлэн" текст availability pill-ийн segment label-тэй ХОЁУЛАА
    // харагдана тул ProductCard-ийн доторх мөрөнд л хязгаарлан шалгана.
    expect(
      find.descendant(
        of: find.byType(ProductCard),
        matching: find.text('Бэлэн'),
      ),
      findsOneWidget,
    );
  });

  testWidgets('карт дарахад дэлгэрэнгүй route руу шилжинэ', (tester) async {
    repository.searchHandler = (q, c) => [buildTestProduct(id: 'p1')];
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    await tester.tap(find.text('Тест бүтээгдэхүүн'));
    await tester.pumpAndSettle();

    expect(find.text('detail-p1'), findsOneWidget);
  });

  testWidgets('хоосон үр дүн үед зурагтай empty state харагдана', (
    tester,
  ) async {
    repository.searchHandler = (q, c) => [];
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('catalog_grid')), findsNothing);
    expect(find.text('Бүтээгдэхүүн олдсонгүй'), findsOneWidget);
    expect(find.byIcon(Icons.search_off_rounded), findsOneWidget);
  });

  testWidgets('хайлтын талбарт бичихэд debounce-ийн дараа шинэ query-гээр хайна', (
    tester,
  ) async {
    repository.searchHandler = (q, c) =>
        q == 'зөгий' ? [buildTestProduct(id: '1', name: 'Зөгийн бал')] : [];
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byKey(const Key('catalog_search_field')),
      'зөгий',
    );
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();

    expect(find.text('Зөгийн бал'), findsOneWidget);
  });

  testWidgets('availability pill "Бэлэн" дарахад сүлжээгээр дахин ДУУДАХГҮЙ, клиент талд шүүнэ', (
    tester,
  ) async {
    repository.searchHandler = (q, c) => [
      buildTestProduct(id: 'in-stock', name: 'Бэлэн бараа'),
      buildTestProduct(
        id: 'pre-order',
        name: 'Захиалгын бараа',
        status: AvailabilityStatus.preOrder,
      ),
    ];
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();
    expect(find.text('Бэлэн бараа'), findsOneWidget);
    expect(find.text('Захиалгын бараа'), findsOneWidget);
    final callsBefore = repository.searchCallCount;

    await tester.tap(
      find.descendant(
        of: find.byKey(const Key('availability_status_pill')),
        matching: find.text('Бэлэн'),
      ),
    );
    await tester.pumpAndSettle();

    expect(repository.searchCallCount, callsBefore);
    expect(find.text('Бэлэн бараа'), findsOneWidget);
    expect(find.text('Захиалгын бараа'), findsNothing);
  });

  testWidgets('олон variant-той бүтээгдэхүүний "Сагслах" FAB дарахад bottom sheet нээгдэж, variant/тоо сонгож сагсанд нэмнэ', (
    tester,
  ) async {
    final product = Product(
      id: 'p1',
      name: 'Куртка',
      slug: 'kurtka',
      isActive: true,
      images: const [],
      variants: const [
        ProductVariant(
          id: 'v-red',
          productId: 'p1',
          name: 'Улаан',
          sku: 'sku-red',
          unit: 'ширхэг',
          basePrice: '50000',
          isActive: true,
          defaultPreOrderEnabled: false,
          availability: AvailabilityResult(status: AvailabilityStatus.inStock),
          color: 'улаан',
        ),
        ProductVariant(
          id: 'v-blue',
          productId: 'p1',
          name: 'Хөх',
          sku: 'sku-blue',
          unit: 'ширхэг',
          basePrice: '55000',
          isActive: true,
          defaultPreOrderEnabled: false,
          availability: AvailabilityResult(status: AvailabilityStatus.inStock),
          color: 'хөх',
        ),
      ],
    );
    repository.searchHandler = (q, c) => [product];
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('add_to_cart_fab_p1')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('add_to_cart_color_chip_улаан')), findsOneWidget);
    expect(find.byKey(const Key('add_to_cart_color_chip_хөх')), findsOneWidget);

    await tester.tap(find.byKey(const Key('add_to_cart_color_chip_хөх')));
    await tester.pump();
    await tester.tap(find.byKey(const Key('add_to_cart_increment')));
    await tester.pump();
    await tester.tap(find.byKey(const Key('add_to_cart_bottom_sheet_submit')));
    await tester.pumpAndSettle();

    expect(cartRepository.addOrUpdateCalls.single, (variantId: 'v-blue', quantity: 2));
    expect(find.text('Сагсанд нэмэгдлээ'), findsOneWidget);
  });
}
