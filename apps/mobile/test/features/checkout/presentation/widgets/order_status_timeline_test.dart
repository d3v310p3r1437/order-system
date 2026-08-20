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
  });
}
