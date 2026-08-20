import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/features/checkout/presentation/checkout_draft.dart';
import 'package:mobile/features/checkout/presentation/delivery_method_screen.dart';

class _SeededDraftNotifier extends CheckoutDraftNotifier {
  _SeededDraftNotifier(this._initial);
  final CheckoutDraft? _initial;

  @override
  CheckoutDraft? build() => _initial;
}

void main() {
  Widget wrap({CheckoutDraft? initial}) {
    final router = GoRouter(
      initialLocation: '/checkout/delivery-method',
      routes: [
        GoRoute(
          path: '/checkout/delivery-method',
          builder: (context, state) => const DeliveryMethodScreen(),
        ),
        GoRoute(
          path: '/checkout/address',
          builder: (context, state) =>
              const Scaffold(body: Text('address-screen')),
        ),
        GoRoute(
          path: '/checkout/review',
          builder: (context, state) =>
              const Scaffold(body: Text('review-screen')),
        ),
      ],
    );
    return ProviderScope(
      overrides: [
        checkoutDraftProvider.overrideWith(
          () => _SeededDraftNotifier(initial),
        ),
      ],
      child: MaterialApp.router(routerConfig: router),
    );
  }

  testWidgets(
    'PICKUP (анхны утга) сонгосон бол "Үргэлжлүүлэх" дарахад OrderReviewScreen руу шилжинэ',
    (tester) async {
      await tester.pumpWidget(
        wrap(initial: const CheckoutDraft(branchId: 'branch-1')),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('delivery_method_continue_button')));
      await tester.pumpAndSettle();

      expect(find.text('review-screen'), findsOneWidget);
    },
  );

  testWidgets(
    'DELIVERY сонгоод "Үргэлжлүүлэх" дарахад AddressScreen руу шилжинэ',
    (tester) async {
      await tester.pumpWidget(
        wrap(initial: const CheckoutDraft(branchId: 'branch-1')),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Хүргэлт'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('delivery_method_continue_button')));
      await tester.pumpAndSettle();

      expect(find.text('address-screen'), findsOneWidget);
    },
  );

  testWidgets('ноорог эхлээгүй (null) үед дэлгэц ямар ч алдаагүй буцна', (
    tester,
  ) async {
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
  });
}
