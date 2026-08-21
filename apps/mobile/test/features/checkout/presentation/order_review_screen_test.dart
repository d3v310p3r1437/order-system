import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/core/network/api_exception.dart';
import 'package:mobile/features/branch/domain/branch.dart';
import 'package:mobile/features/branch/presentation/branch_providers.dart';
import 'package:mobile/features/cart/domain/cart_branch_validation.dart';
import 'package:mobile/features/cart/presentation/cart_providers.dart';
import 'package:mobile/features/catalog/domain/availability.dart';
import 'package:mobile/features/checkout/presentation/checkout_draft.dart';
import 'package:mobile/features/checkout/presentation/checkout_providers.dart';
import 'package:mobile/features/checkout/presentation/order_review_screen.dart';
import 'package:mobile/features/coupons/domain/coupon_validation.dart';
import 'package:mobile/features/coupons/presentation/coupon_providers.dart';

import '../../../support/fake_branch_repository.dart';
import '../../../support/fake_cart_repository.dart';
import '../../../support/fake_checkout_repository.dart';
import '../../../support/fake_coupon_repository.dart';

class _SeededDraftNotifier extends CheckoutDraftNotifier {
  _SeededDraftNotifier(this._initial);
  final CheckoutDraft? _initial;

  @override
  CheckoutDraft? build() => _initial;
}

void main() {
  late FakeCartRepository cartRepository;
  late FakeBranchRepository branchRepository;
  late FakeCheckoutRepository checkoutRepository;
  late FakeCouponRepository couponRepository;

  setUp(() {
    cartRepository = FakeCartRepository();
    branchRepository = FakeBranchRepository()
      ..branches = [const Branch(id: 'branch-1', name: 'Төв салбар')];
    checkoutRepository = FakeCheckoutRepository();
    couponRepository = FakeCouponRepository();
    cartRepository.validateBranchHandler = (branchId) {
      return const CartBranchValidation(
        items: [
          CartValidationLine(
            variantId: 'v1',
            quantity: 2,
            productName: 'Кока-кола',
            available: true,
            status: AvailabilityStatus.inStock,
            effectivePrice: '2500.00',
          ),
        ],
        totalAmount: '5000.00',
      );
    };
  });

  Widget wrap() {
    final router = GoRouter(
      initialLocation: '/checkout/review',
      routes: [
        GoRoute(
          path: '/checkout/review',
          builder: (context, state) => const OrderReviewScreen(),
        ),
        GoRoute(
          path: '/orders/:id/payment',
          builder: (context, state) =>
              const Scaffold(body: Text('payment-screen')),
        ),
      ],
    );
    return ProviderScope(
      overrides: [
        checkoutDraftProvider.overrideWith(
          () => _SeededDraftNotifier(const CheckoutDraft(branchId: 'branch-1')),
        ),
        branchRepositoryProvider.overrideWithValue(branchRepository),
        cartRepositoryProvider.overrideWithValue(cartRepository),
        checkoutRepositoryProvider.overrideWithValue(checkoutRepository),
        couponRepositoryProvider.overrideWithValue(couponRepository),
      ],
      child: MaterialApp.router(routerConfig: router),
    );
  }

  testWidgets('салбарын нэр, item, нийт дүн (branchPrice override-той) харагдана', (
    tester,
  ) async {
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    expect(find.text('Очиж авах'), findsOneWidget);
    expect(find.text('Төв салбар'), findsOneWidget);
    expect(find.text('Кока-кола × 2'), findsOneWidget);
    // Item-ийн мөр (2500×2) БОЛОН нийт дүн хоёулаа санамсаргүйгээр ижил
    // "5,000₮" утгатай (энэ fixture-д ганц item байгаа тул) — 2 газарт
    // харагдана.
    expect(find.text('5,000₮'), findsNWidgets(2));
  });

  testWidgets('"Захиалах" товч дарахад checkout() дуудагдаж, PaymentScreen руу шилжинэ', (
    tester,
  ) async {
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('submit_checkout_button')));
    await tester.pumpAndSettle();

    expect(checkoutRepository.checkoutCalls, [
      (branchId: 'branch-1', deliveryMethod: 'PICKUP', couponCode: null),
    ]);
    expect(find.text('payment-screen'), findsOneWidget);
  });

  testWidgets(
    'хүчинтэй купон код оруулж "Ашиглах" дархад хямдрал харагдаж, checkout()-д couponCode дамжина',
    (tester) async {
      couponRepository.validationResult = const CouponValidation(
        couponCode: 'SALE10',
        discountType: 'FIXED_AMOUNT',
        discountValue: '1000',
        discountAmount: '1000',
      );
      await tester.pumpWidget(wrap());
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byKey(const Key('coupon_code_field')),
        'sale10',
      );
      await tester.tap(find.byKey(const Key('apply_coupon_button')));
      await tester.pumpAndSettle();

      expect(couponRepository.validateCalls, [
        (code: 'sale10', orderAmount: '5000.00'),
      ]);
      // "5,000₮" 2 газарт (item мөр + шугамдсан дэд дүн), хямдрал/эцсийн
      // (шинэ, 4,000₮) нийт дүн тус тусад нь харагдана.
      expect(find.text('5,000₮'), findsNWidgets(2));
      expect(find.textContaining('Хямдрал'), findsOneWidget);
      expect(find.text('4,000₮'), findsOneWidget);

      await tester.tap(find.byKey(const Key('submit_checkout_button')));
      await tester.pumpAndSettle();

      expect(checkoutRepository.checkoutCalls, [
        (branchId: 'branch-1', deliveryMethod: 'PICKUP', couponCode: 'SALE10'),
      ]);
    },
  );

  testWidgets(
    'алдаатай купон код оруулбал backend-ийн монгол алдааны мессежийг талбарын дор харуулна',
    (tester) async {
      couponRepository.validationError = const ApiException(
        code: 'COUPON_NOT_FOUND',
        message: 'Купон олдсонгүй',
      );
      await tester.pumpWidget(wrap());
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byKey(const Key('coupon_code_field')),
        'NOSUCH',
      );
      await tester.tap(find.byKey(const Key('apply_coupon_button')));
      await tester.pumpAndSettle();

      expect(find.text('Купон олдсонгүй'), findsOneWidget);
      // Амжилтгүй бол хямдрал ХЭЗЭЭ Ч харагдахгүй, нийт дүн өөрчлөгдөөгүй хэвээр.
      expect(find.textContaining('Хямдрал'), findsNothing);
    },
  );

  testWidgets('checkout OUT_OF_STOCK алдаа буцаавал SnackBar-аар монгол мессеж харуулж, дэлгэц дээрээ үлдэнэ', (
    tester,
  ) async {
    checkoutRepository.checkoutError = const ApiException(
      code: 'OUT_OF_STOCK',
      message: 'Захиалсан бараа нөөцөд хүрэлцэхгүй байна',
    );
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('submit_checkout_button')));
    await tester.pumpAndSettle();

    expect(
      find.text('Сонгосон бараа нөөцөд хүрэлцэхгүй байна'),
      findsOneWidget,
    );
    expect(find.text('payment-screen'), findsNothing);
  });
}
