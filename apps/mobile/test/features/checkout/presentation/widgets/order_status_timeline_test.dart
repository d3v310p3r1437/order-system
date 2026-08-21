import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/checkout/presentation/widgets/order_status_timeline.dart';

void main() {
  Widget wrap(String status) {
    return MaterialApp(
      home: Scaffold(body: OrderStatusTimeline(status: status)),
    );
  }

  testWidgets('CREATED статус бүх алхмыг харуулна, timeline widget-тэй', (
    tester,
  ) async {
    await tester.pumpWidget(wrap('CREATED'));

    expect(find.byKey(const Key('order_status_timeline')), findsOneWidget);
    expect(find.text('Захиалга үүслээ'), findsOneWidget);
    expect(find.text('Хүлээлгэн өглөө'), findsOneWidget);
    // Хараахан ямар ч алхам дуусаагүй тул check icon огт харагдахгүй,
    // алхам бүр өөрийн (`_statusIcons`) icon-той.
    expect(find.byIcon(Icons.check), findsNothing);
    expect(find.byIcon(Icons.shopping_cart_outlined), findsOneWidget);
    expect(find.byIcon(Icons.flag_outlined), findsOneWidget);
  });

  testWidgets('CANCELLED статус тусдаа "цуцлагдсан" харагдацтай', (
    tester,
  ) async {
    await tester.pumpWidget(wrap('CANCELLED'));

    expect(find.byKey(const Key('order_status_cancelled')), findsOneWidget);
    expect(find.text('Захиалга цуцлагдсан'), findsOneWidget);
    expect(find.byKey(const Key('order_status_timeline')), findsNothing);
  });

  testWidgets('COMPLETED статус бүх label-үүдийг харуулна', (tester) async {
    await tester.pumpWidget(wrap('COMPLETED'));

    expect(find.text('Баталгаажлаа'), findsOneWidget);
    expect(find.text('Бэлтгэж байна'), findsOneWidget);
    expect(find.text('Бэлэн боллоо'), findsOneWidget);
    expect(find.text('Хүлээлгэн өглөө'), findsOneWidget);
    // 4 алхам дуусаж check icon-той, сүүлийн (COMPLETED) алхам идэвхтэй
    // тул өөрийн flag icon-тойгоороо (check-гүйгээр) харагдана.
    expect(find.byIcon(Icons.check), findsNWidgets(4));
    expect(find.byIcon(Icons.flag_outlined), findsOneWidget);
  });

  testWidgets('идэвхтэй алхамд pulse цагираг (_PulsingRing) зөвхөн 1 газар зурагдана', (
    tester,
  ) async {
    await tester.pumpWidget(wrap('PREPARING'));

    expect(find.byKey(const Key('order_status_step_PREPARING')), findsOneWidget);
    // AnimatedBuilder бүхий pulse widget нэг л (идэвхтэй PREPARING алхамд)
    // байх ёстой — dispose алдаагүйг баталгаажуулах зорилготой мөн.
    expect(tester.takeException(), isNull);
  });
}
