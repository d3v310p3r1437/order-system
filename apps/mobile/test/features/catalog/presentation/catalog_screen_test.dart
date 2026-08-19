import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/features/catalog/presentation/catalog_providers.dart';
import 'package:mobile/features/catalog/presentation/catalog_screen.dart';

import '../../../support/fake_catalog_repository.dart';

void main() {
  late FakeCatalogRepository repository;

  setUp(() {
    repository = FakeCatalogRepository();
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
      overrides: [catalogRepositoryProvider.overrideWithValue(repository)],
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
    expect(find.text('Бэлэн'), findsOneWidget);
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
}
