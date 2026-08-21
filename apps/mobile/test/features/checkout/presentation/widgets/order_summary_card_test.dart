import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/checkout/domain/order_detail.dart';
import 'package:mobile/features/checkout/presentation/widgets/order_summary_card.dart';

void main() {
  final order = OrderDetail(
    id: 'abcdef12-3456-7890-abcd-ef1234567890',
    status: 'CONFIRMED',
    totalAmount: '15000.00',
    branchId: 'branch-1',
    items: const [
      OrderItemLine(
        id: 'item-1',
        variantId: 'v1',
        quantity: 2,
        unitPriceSnapshot: '5000.00',
      ),
      OrderItemLine(
        id: 'item-2',
        variantId: 'v2',
        quantity: 1,
        unitPriceSnapshot: '5000.00',
      ),
    ],
    deliveryMethod: 'PICKUP',
    createdAt: DateTime(2026, 8, 20).toIso8601String(),
  );

  Widget wrap() {
    return MaterialApp(
      home: Scaffold(
        body: OrderSummaryCard(order: order, branchName: 'Төв салбар'),
      ),
    );
  }

  testWidgets('захиалгын дугаар, салбарын нэр, барааны тоо, нийт дүн харагдана', (
    tester,
  ) async {
    await tester.pumpWidget(wrap());

    expect(find.byKey(const Key('order_summary_card')), findsOneWidget);
    expect(find.text(OrderSummaryCard.shortOrderId(order.id)), findsOneWidget);
    expect(find.text('Төв салбар'), findsOneWidget);
    expect(find.text('3 ширхэг бараа'), findsOneWidget);
    expect(find.text('15,000₮'), findsOneWidget);
    expect(find.byIcon(Icons.storefront_outlined), findsOneWidget);
  });

  test('shortOrderId богино, том үсэгтэй, зураас (-) агуулаагүй байна', () {
    final short = OrderSummaryCard.shortOrderId(order.id);
    expect(short, startsWith('#'));
    expect(short.contains('-'), isFalse);
    expect(short.length, 9);
  });
}
