import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/core/network/api_exception.dart';
import 'package:mobile/features/checkout/domain/order_detail.dart';
import 'package:mobile/features/cart/presentation/cart_providers.dart';
import 'package:mobile/features/checkout/presentation/checkout_providers.dart';
import 'package:mobile/features/orders/presentation/order_list_providers.dart';
import 'package:mobile/features/orders/presentation/order_list_screen.dart';
import 'package:mobile/features/reviews/domain/review.dart';
import 'package:mobile/features/reviews/presentation/review_providers.dart';

import '../../../support/fake_cart_repository.dart';
import '../../../support/fake_checkout_repository.dart';
import '../../../support/fake_review_repository.dart';

OrderDetail _order({
  required String id,
  required String status,
  String totalAmount = '15000.00',
  Review? myReview,
}) {
  return OrderDetail(
    id: id,
    status: status,
    totalAmount: totalAmount,
    branchId: 'branch-1',
    items: [
      OrderItemLine(
        id: 'item-$id',
        variantId: 'v1',
        quantity: 1,
        unitPriceSnapshot: totalAmount,
        productName: 'Кока-Кола',
        variantName: '0.5Л',
        productId: 'product-1',
        productImageUrl: null,
        myReview: myReview,
      ),
    ],
    deliveryMethod: 'PICKUP',
    createdAt: DateTime(2026, 8, 15).toIso8601String(),
    completedAt: status == 'COMPLETED'
        ? DateTime(2026, 8, 16).toIso8601String()
        : null,
  );
}

void main() {
  late FakeCheckoutRepository repository;
  late FakeReviewRepository reviewRepository;

  setUp(() {
    repository = FakeCheckoutRepository();
    reviewRepository = FakeReviewRepository();
  });

  Widget wrap() {
    final router = GoRouter(
      initialLocation: '/orders',
      routes: [
        GoRoute(
          path: '/orders',
          builder: (context, state) => const OrderListScreen(),
        ),
        GoRoute(
          path: '/orders/:id',
          builder: (context, state) =>
              Scaffold(body: Text('order-detail-${state.pathParameters['id']}')),
        ),
        GoRoute(
          path: '/catalog',
          builder: (context, state) => const Scaffold(body: Text('catalog')),
        ),
      ],
    );
    return ProviderScope(
      overrides: [
        checkoutRepositoryProvider.overrideWithValue(repository),
        // OrderListScreen-ийн AppBar-д CartAppBarAction байдаг тул
        // (§8 навигацийн цэгцлэлт) cartRepositoryProvider-ийг ч
        // override хийхгүй бол cartProvider бодит сүлжээ рүү (Dio) хандаж
        // "Timer is still pending" тестийн алдаа өгдөг.
        cartRepositoryProvider.overrideWithValue(FakeCartRepository()),
        reviewRepositoryProvider.overrideWithValue(reviewRepository),
      ],
      child: MaterialApp.router(routerConfig: router),
    );
  }

  testWidgets('ачаалж байх үед skeleton харагдана', (tester) async {
    await tester.pumpWidget(wrap());

    expect(find.byKey(const Key('order_list_skeleton')), findsOneWidget);
  });

  testWidgets('захиалга байхгүй үед empty state + Каталог руу очих CTA харагдана', (
    tester,
  ) async {
    repository.orders = [];
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    expect(find.text('Захиалга хийгээгүй байна'), findsOneWidget);
    await tester.tap(find.byKey(const Key('order_list_go_to_catalog_button')));
    await tester.pumpAndSettle();

    expect(find.text('catalog'), findsOneWidget);
  });

  testWidgets(
    'Идэвхтэй/Түүх таб хооронд шилжихэд харгалзах захиалгууд харагдана, карт руу дарахад дэлгэрэнгүй рүү шилжинэ',
    (tester) async {
      repository.orders = [
        _order(id: 'order-active', status: 'CONFIRMED'),
        _order(id: 'order-done', status: 'COMPLETED'),
      ];
      await tester.pumpWidget(wrap());
      await tester.pumpAndSettle();

      // Анхдагч таб — "Идэвхтэй" — тул зөвхөн CONFIRMED карт харагдана.
      expect(find.text('Идэвхтэй'), findsOneWidget);
      expect(find.text('Түүх'), findsOneWidget);
      expect(
        find.byKey(const Key('order_list_card_order-active')),
        findsOneWidget,
      );
      expect(find.text('Баталгаажсан'), findsOneWidget);

      await tester.tap(find.byKey(const Key('order_list_card_order-active')));
      await tester.pumpAndSettle();
      expect(find.text('order-detail-order-active'), findsOneWidget);
    },
  );

  testWidgets(
    'Түүх таб руу шилжихэд COMPLETED захиалгын карт+барааны нэр харагдана',
    (tester) async {
      repository.orders = [
        _order(id: 'order-active', status: 'CONFIRMED'),
        _order(id: 'order-done', status: 'COMPLETED'),
      ];
      await tester.pumpWidget(wrap());
      await tester.pumpAndSettle();

      await tester.tap(find.text('Түүх'));
      await tester.pumpAndSettle();

      expect(
        find.byKey(const Key('order_list_card_order-done')),
        findsOneWidget,
      );
      expect(find.text('Дууссан'), findsOneWidget);
      expect(find.text('Кока-Кола 0.5Л ×1'), findsOneWidget);
    },
  );

  testWidgets(
    'Түүх таб дахь COMPLETED захиалгын барааны "Үнэлэх" товч дарахад bottom sheet нээгдэж, амжилттай илгээсний дараа UI дахин API дуудахгүйгээр шинэчлэгдэнэ',
    (tester) async {
      repository.orders = [_order(id: 'order-done', status: 'COMPLETED')];
      reviewRepository.createResult = Review(
        id: 'r-1',
        customerId: 'cust-1',
        productId: 'product-1',
        rating: 5,
        comment: 'Гайхалтай',
        createdAt: DateTime(2026, 8, 26),
      );
      await tester.pumpWidget(wrap());
      await tester.pumpAndSettle();

      await tester.tap(find.text('Түүх'));
      await tester.pumpAndSettle();

      expect(find.text('Үнэлэх'), findsOneWidget);
      await tester.tap(find.byKey(const Key('item_review_row_item-order-done')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('quick_review_submit_button')), findsOneWidget);
      await tester.tap(find.byKey(const Key('star_input_5')));
      await tester.pump();
      await tester.tap(find.byKey(const Key('quick_review_submit_button')));
      await tester.pumpAndSettle();

      expect(reviewRepository.createCalls, hasLength(1));
      expect(reviewRepository.createCalls.first.productId, 'product-1');
      expect(reviewRepository.createCalls.first.rating, 5);
      expect(find.text('Үнэлгээ илгээгдлээ'), findsOneWidget);
      // API-г дахин дуудахгүйгээр (listOrdersCallCount өөрчлөгдөөгүй)
      // карт дээрх "Үнэлэх" товч одоор солигдсон байх ёстой.
      expect(repository.listOrdersCallCount, 1);
      expect(find.text('Үнэлэх'), findsNothing);
    },
  );

  testWidgets('алдаа гарвал алдааны төлөв + дахин оролдох товч харагдана', (
    tester,
  ) async {
    // ⚠️ Анхны `build()`-ийг ШУУД алдаатай эхлүүлбэл (listOrdersError-ыг
    // pumpWidget-ээс ӨМНӨ тавихад) Riverpod-ийн АНХДАГЧ дахин оролдох
    // (retry-with-backoff) механизм ажилладаг тул `AsyncValue.when()`
    // "loading" салбартаа удаан хугацаагаар (skeleton) зогсч, тестийн
    // `pumpAndSettle()`-д ХЭЗЭЭ Ч бодит `AsyncError`-т хүрдэггүй
    // (бодитоор туршиж баталгаажуулсан) — тул эхлээд амжилттай ачаалуулж
    // (empty state), дараа нь `refresh()`-ийг ШУУД (UI gesture-гүйгээр,
    // `AsyncValue.guard`-аар ТЭРХҮҮ дороо `AsyncError`-т шилждэг тул retry
    // орохгүй) дуудна.
    final container = ProviderContainer(
      overrides: [
        checkoutRepositoryProvider.overrideWithValue(repository),
        cartRepositoryProvider.overrideWithValue(FakeCartRepository()),
      ],
    );
    addTearDown(container.dispose);
    final router = GoRouter(
      initialLocation: '/orders',
      routes: [
        GoRoute(
          path: '/orders',
          builder: (context, state) => const OrderListScreen(),
        ),
      ],
    );
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();

    repository.listOrdersError = const ApiException(
      code: 'NETWORK_ERROR',
      message: 'Сүлжээний холболт амжилтгүй боллоо',
    );
    await container.read(orderListProvider.notifier).refresh();
    await tester.pumpAndSettle();

    expect(find.text('Захиалгууд ачаалахад алдаа гарлаа'), findsOneWidget);
    expect(find.text('Дахин оролдох'), findsOneWidget);
  });
}
