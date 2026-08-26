import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/network/api_exception.dart';
import 'package:mobile/features/checkout/domain/order_detail.dart';
import 'package:mobile/features/checkout/presentation/checkout_providers.dart';
import 'package:mobile/features/orders/presentation/order_list_providers.dart';
import 'package:mobile/features/reviews/domain/review.dart';

import '../../../support/fake_checkout_repository.dart';

OrderDetail _order(String id, {List<OrderItemLine> items = const []}) {
  return OrderDetail(
    id: id,
    status: 'CREATED',
    totalAmount: '10000.00',
    branchId: 'branch-1',
    items: items,
    deliveryMethod: 'PICKUP',
    createdAt: DateTime(2026, 8, 21).toIso8601String(),
  );
}

void main() {
  late FakeCheckoutRepository repository;
  late ProviderContainer container;

  setUp(() {
    repository = FakeCheckoutRepository();
    container = ProviderContainer(
      overrides: [checkoutRepositoryProvider.overrideWithValue(repository)],
    );
    addTearDown(container.dispose);
  });

  test('build() эхлээд listOrders()-ийг дуудаж захиалгын жагсаалтыг татна', () async {
    repository.orders = [_order('order-1'), _order('order-2')];

    final orders = await container.read(orderListProvider.future);

    expect(orders, hasLength(2));
    expect(repository.listOrdersCallCount, 1);
  });

  test('refresh() дахин listOrders() дуудаж шинэ жагсаалтаар шинэчилнэ', () async {
    repository.orders = [_order('order-1')];
    await container.read(orderListProvider.future);

    repository.orders = [_order('order-1'), _order('order-2')];
    await container.read(orderListProvider.notifier).refresh();

    final state = container.read(orderListProvider).value;
    expect(state, hasLength(2));
    expect(repository.listOrdersCallCount, 2);
  });

  test('алдаа гарвал AsyncError төлөвт шилжинэ', () async {
    repository.orders = [_order('order-1')];
    await container.read(orderListProvider.future);

    repository.listOrdersError = const ApiException(
      code: 'NETWORK_ERROR',
      message: 'Сүлжээний холболт амжилтгүй боллоо',
    );
    await container.read(orderListProvider.notifier).refresh();

    expect(container.read(orderListProvider).hasError, isTrue);
  });

  test(
    'applyLocalReview() дахин API дуудахгүйгээр ижил productId-той бүх захиалгын item дээр myReview залгана',
    () async {
      repository.orders = [
        _order(
          'order-1',
          items: [
            OrderItemLine(
              id: 'item-1',
              variantId: 'v1',
              quantity: 1,
              unitPriceSnapshot: '10000.00',
              productId: 'product-1',
            ),
          ],
        ),
        _order(
          'order-2',
          items: [
            OrderItemLine(
              id: 'item-2',
              variantId: 'v2',
              quantity: 1,
              unitPriceSnapshot: '5000.00',
              productId: 'product-2',
            ),
          ],
        ),
      ];
      await container.read(orderListProvider.future);

      final review = Review(
        id: 'r-1',
        customerId: 'cust-1',
        productId: 'product-1',
        rating: 5,
        createdAt: DateTime(2026, 8, 26),
      );
      container.read(orderListProvider.notifier).applyLocalReview(
        'product-1',
        review,
      );

      final state = container.read(orderListProvider).value!;
      expect(state[0].items[0].myReview, review);
      // Өөр productId-той item хөндөгдөхгүй.
      expect(state[1].items[0].myReview, isNull);
      // Дахин API дуудагдаагүй.
      expect(repository.listOrdersCallCount, 1);
    },
  );
}
