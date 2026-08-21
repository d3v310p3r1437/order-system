import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/features/checkout/domain/order_detail.dart';
import 'package:mobile/features/checkout/presentation/checkout_providers.dart';
import 'package:mobile/features/returns/domain/return_request_record.dart';
import 'package:mobile/features/returns/presentation/return_providers.dart';
import 'package:mobile/features/returns/presentation/return_request_screen.dart';

import '../../../support/fake_checkout_repository.dart';
import '../../../support/fake_return_repository.dart';

void main() {
  late FakeCheckoutRepository checkoutRepository;
  late FakeReturnRepository returnRepository;

  setUp(() {
    checkoutRepository = FakeCheckoutRepository();
    returnRepository = FakeReturnRepository();
    checkoutRepository.orderDetail = OrderDetail(
      id: 'order-1',
      status: 'COMPLETED',
      totalAmount: '10000.00',
      branchId: 'branch-1',
      items: const [
        OrderItemLine(
          id: 'item-1',
          variantId: 'v1',
          quantity: 1,
          unitPriceSnapshot: '10000.00',
          productName: 'Кока-Кола',
          variantName: '0.5Л',
        ),
      ],
      deliveryMethod: 'PICKUP',
      createdAt: DateTime(2026, 8, 1).toIso8601String(),
      completedAt: DateTime(2026, 8, 3).toIso8601String(),
    );
  });

  Widget wrap() {
    // Жинхэнэ апп шиг ReturnRequestScreen нь OrderTrackingScreen-ээс
    // PUSH хийгддэг (context.push) — эхлээд tracking дэлгэц дээр
    // (initialLocation) байрлаж, тестийн эхэнд "буцаалт хүсэх" товч
    // дараад ЛОГ шилждэг гэдэг нь `context.pop()`-д буцах stack-тай
    // болгоно (эс бөгөөс "There is nothing to pop" алдаа өгнө).
    final router = GoRouter(
      initialLocation: '/orders/order-1',
      routes: [
        GoRoute(
          path: '/orders/:id',
          builder: (context, state) => Scaffold(
            body: Column(
              children: [
                const Text('tracking'),
                TextButton(
                  key: const Key('go_to_return_button'),
                  onPressed: () =>
                      context.push('/orders/${state.pathParameters['id']}/return'),
                  child: const Text('go'),
                ),
              ],
            ),
          ),
        ),
        GoRoute(
          path: '/orders/:id/return',
          builder: (context, state) =>
              ReturnRequestScreen(orderId: state.pathParameters['id']!),
        ),
      ],
    );
    return ProviderScope(
      overrides: [
        checkoutRepositoryProvider.overrideWithValue(checkoutRepository),
        returnRepositoryProvider.overrideWithValue(returnRepository),
      ],
      child: MaterialApp.router(routerConfig: router),
    );
  }

  testWidgets(
    'item сонгож, шалтгаан бичээгүй үед Илгээх товч идэвхгүй хэвээр байна',
    (tester) async {
      await tester.pumpWidget(wrap());
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('go_to_return_button')));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('return_item_tile_item-1')));
      await tester.pumpAndSettle();

      final button = tester.widget<FilledButton>(
        find.byKey(const Key('submit_return_request_button')),
      );
      expect(button.onPressed, isNull);
    },
  );

  testWidgets('item сонгож шалтгаан бичээд Илгээх дарахад POST /returns дуудагдана', (
    tester,
  ) async {
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('go_to_return_button')));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('return_item_tile_item-1')));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const Key('return_reason_field')),
      'Барааны бүрхүүл гэмтсэн',
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('submit_return_request_button')));
    await tester.pumpAndSettle();

    expect(returnRepository.createCalls, [
      (orderItemId: 'item-1', reason: 'Барааны бүрхүүл гэмтсэн'),
    ]);
    expect(find.text('Буцаалтын хүсэлт илгээгдлээ'), findsOneWidget);
    // Амжилттай илгээсний дараа өмнөх дэлгэц (tracking) рүү буцна.
    expect(find.text('tracking'), findsOneWidget);
  });

  testWidgets('аль хэдийн идэвхтэй буцаалттай item чекбокс идэвхгүй байна', (
    tester,
  ) async {
    returnRepository.returns = [
      const ReturnRequestRecord(
        id: 'return-1',
        orderItemId: 'item-1',
        orderId: 'order-1',
        status: 'REQUESTED',
        reason: 'өмнөх шалтгаан',
        requestedAt: '2026-08-10T00:00:00.000Z',
      ),
    ];
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('go_to_return_button')));
    await tester.pumpAndSettle();

    final checkbox = tester.widget<CheckboxListTile>(
      find.descendant(
        of: find.byKey(const Key('return_item_tile_item-1')),
        matching: find.byType(CheckboxListTile),
      ),
    );
    expect(checkbox.onChanged, isNull);
    expect(find.text('Хүсэлт гаргасан'), findsOneWidget);
  });
}
