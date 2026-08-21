import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/checkout/domain/order_detail.dart';

void main() {
  group('OrderItemLine.displayName', () {
    test(
      'productName variantName-ийг АЛЬ ХЭДИЙН агуулж байвал давхардуулахгүй '
      '(жиш: "Кока-Кола 0.5Л" + "0.5Л")',
      () {
        const item = OrderItemLine(
          id: 'item-1',
          variantId: 'v1',
          quantity: 1,
          unitPriceSnapshot: '2500.00',
          productName: 'Кока-Кола 0.5Л',
          variantName: '0.5Л',
        );

        expect(item.displayName, 'Кока-Кола 0.5Л');
      },
    );

    test(
      'productName variantName агуулаагүй бол хоёуланг залгана '
      '(жиш: "Ariel угаалгын нунтаг" + "3кг")',
      () {
        const item = OrderItemLine(
          id: 'item-2',
          variantId: 'v2',
          quantity: 1,
          unitPriceSnapshot: '15000.00',
          productName: 'Ariel угаалгын нунтаг',
          variantName: '3кг',
        );

        expect(item.displayName, 'Ariel угаалгын нунтаг 3кг');
      },
    );

    test('variantName null бол зөвхөн productName буцаана', () {
      const item = OrderItemLine(
        id: 'item-3',
        variantId: 'v3',
        quantity: 1,
        unitPriceSnapshot: '1000.00',
        productName: 'Улаан цай',
      );

      expect(item.displayName, 'Улаан цай');
    });

    test('productName null бол variantId-ийн товч хэлбэрийг буцаана', () {
      const item = OrderItemLine(
        id: 'item-4',
        variantId: 'abcdefgh12345',
        quantity: 1,
        unitPriceSnapshot: '1000.00',
      );

      expect(item.displayName, 'abcdefgh');
    });
  });
}
