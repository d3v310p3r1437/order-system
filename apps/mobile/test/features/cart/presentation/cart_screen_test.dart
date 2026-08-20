import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/features/cart/domain/cart_item.dart';
import 'package:mobile/features/cart/presentation/cart_providers.dart';
import 'package:mobile/features/cart/presentation/cart_screen.dart';

import '../../../support/fake_cart_repository.dart';

void main() {
  late FakeCartRepository repository;

  setUp(() {
    repository = FakeCartRepository();
  });

  Widget wrap() {
    final router = GoRouter(
      initialLocation: '/cart',
      routes: [
        GoRoute(path: '/cart', builder: (context, state) => const CartScreen()),
        GoRoute(
          path: '/branch-select',
          builder: (context, state) =>
              const Scaffold(body: Text('branch-select')),
        ),
      ],
    );
    return ProviderScope(
      overrides: [cartRepositoryProvider.overrideWithValue(repository)],
      child: MaterialApp.router(routerConfig: router),
    );
  }

  testWidgets('хоосон сагсанд empty state харагдана', (tester) async {
    repository.items = [];
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    expect(find.text('Сагс хоосон байна'), findsOneWidget);
  });

  testWidgets('item-ийн нэр/үнэ/тоо харагдана', (tester) async {
    repository.items = [
      buildTestCartItem(
        variantId: 'v1',
        productName: 'Кока-кола',
        basePrice: '2500',
        quantity: 2,
      ),
    ];
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    expect(find.text('Кока-кола'), findsOneWidget);
    expect(find.text('2,500₮'), findsOneWidget);
    expect(find.byKey(const Key('quantity_cart_item_v1')), findsOneWidget);
    expect(find.text('2'), findsOneWidget);
  });

  testWidgets('+ товч дарахад тоо хэмжээ нэмэгдэж, backend рүү шинэ утга дамжина', (
    tester,
  ) async {
    repository.items = [buildTestCartItem(variantId: 'v1', quantity: 2)];
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('increment_cart_item_v1')));
    await tester.pumpAndSettle();

    expect(repository.addOrUpdateCalls.last, (variantId: 'v1', quantity: 3));
    expect(find.text('3'), findsOneWidget);
  });

  testWidgets('- товч дарахад тоо хэмжээ хасагдаж, backend рүү шинэ утга дамжина', (
    tester,
  ) async {
    repository.items = [buildTestCartItem(variantId: 'v1', quantity: 2)];
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('decrement_cart_item_v1')));
    await tester.pumpAndSettle();

    expect(repository.addOrUpdateCalls.last, (variantId: 'v1', quantity: 1));
    expect(find.text('1'), findsOneWidget);
  });

  testWidgets('quantity=1 үед - товч дарахад юу ч дуудагдахгүй (идэвхгүй)', (
    tester,
  ) async {
    repository.items = [buildTestCartItem(variantId: 'v1', quantity: 1)];
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('decrement_cart_item_v1')));
    await tester.pumpAndSettle();

    expect(repository.addOrUpdateCalls, isEmpty);
  });

  testWidgets('устгах товч дарахад remove()-ийг дуудаж, item алга болно', (
    tester,
  ) async {
    repository.items = [buildTestCartItem(variantId: 'v1')];
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('remove_cart_item_v1')));
    await tester.pumpAndSettle();

    expect(repository.removeCalls, ['v1']);
    expect(find.text('Сагс хоосон байна'), findsOneWidget);
  });

  testWidgets('unavailable (устсан) item тусдаа мессежтэй харагдана', (
    tester,
  ) async {
    repository.items = const [
      CartItem(variantId: 'v-missing', quantity: 1, unavailable: true),
    ];
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    expect(
      find.text('Энэ бүтээгдэхүүн байхгүй болсон байна'),
      findsOneWidget,
    );
  });

  testWidgets('"Захиалах" товч дарахад /branch-select руу шилжинэ', (
    tester,
  ) async {
    repository.items = [buildTestCartItem(variantId: 'v1')];
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('go_to_branch_select_button')));
    await tester.pumpAndSettle();

    expect(find.text('branch-select'), findsOneWidget);
  });

  testWidgets('Сагс цэвэрлэх товч дарахад бүх item устгагдана', (
    tester,
  ) async {
    repository.items = [buildTestCartItem(variantId: 'v1')];
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('clear_cart_button')));
    await tester.pumpAndSettle();

    expect(repository.clearCallCount, 1);
    expect(find.text('Сагс хоосон байна'), findsOneWidget);
  });
}
