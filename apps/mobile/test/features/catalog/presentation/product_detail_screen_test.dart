import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/features/catalog/presentation/catalog_providers.dart';
import 'package:mobile/features/catalog/presentation/product_detail_screen.dart';
import 'package:mobile/features/cart/presentation/cart_providers.dart';
import 'package:mobile/features/reviews/domain/review.dart';
import 'package:mobile/features/reviews/presentation/product_reviews_screen.dart';
import 'package:mobile/features/reviews/presentation/review_form_screen.dart';
import 'package:mobile/features/reviews/presentation/review_providers.dart';

import '../../../support/fake_cart_repository.dart';
import '../../../support/fake_catalog_repository.dart';
import '../../../support/fake_review_repository.dart';

void main() {
  late FakeCatalogRepository catalogRepository;
  late FakeCartRepository cartRepository;
  late FakeReviewRepository reviewRepository;

  setUp(() {
    catalogRepository = FakeCatalogRepository();
    catalogRepository.getProductHandler = (id) => buildTestProduct(id: id);
    cartRepository = FakeCartRepository();
    reviewRepository = FakeReviewRepository();
  });

  // `_DetailSkeleton` (ачаалж байгаа төлөв) scroll-гүй Column тул анхдагч
  // 800x600 квадрат тестийн дэлгэц дээр (SliverAppBar-ийн expandedHeight
  // нь MediaQuery-ийн width-тэй тэнцүү болгодог) overflow гарна — жинхэнэ
  // (өндөр нь өргөнөөс их) утасны дэлгэцтэй ойролцоо хэмжээ тавьж шийднэ.
  void setPhoneViewport(WidgetTester tester) {
    tester.view.physicalSize = const Size(400, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
  }

  late GoRouter router;

  // "Сагслах" → буцах товч Navigator.pop()-ийг дуудна тул анхны байрлал
  // ганцхан /products/:id байвал (стек хоосорч) алга — Каталогоос push
  // хийсэн ЖИНХЭНЭ урсгалыг дуурайлган эхлээд /catalog-руу орж, дараа нь
  // тестийн дотор /products/p1 руу push хийнэ. `NoTransitionPage` —
  // SnackBar-ийн animation-той зэрэгцэн pop-ийн шилжилтийн animation
  // эхлэхэд (тестийн fake clock-д хоёр AnimationController зэрэг
  // эхлэхэд гардаг тогтворгүй байдлаас) зайлсхийнэ.
  Widget wrap() {
    router = GoRouter(
      initialLocation: '/catalog',
      routes: [
        GoRoute(
          path: '/catalog',
          pageBuilder: (context, state) =>
              const NoTransitionPage(child: Scaffold(body: Text('catalog'))),
        ),
        GoRoute(
          path: '/products/:id',
          pageBuilder: (context, state) => NoTransitionPage(
            child: ProductDetailScreen(productId: state.pathParameters['id']!),
          ),
        ),
        GoRoute(
          path: '/products/:id/reviews',
          pageBuilder: (context, state) => NoTransitionPage(
            child: ProductReviewsScreen(
              productId: state.pathParameters['id']!,
            ),
          ),
        ),
        GoRoute(
          path: '/products/:id/review',
          pageBuilder: (context, state) => NoTransitionPage(
            child: ReviewFormScreen(
              productId: state.pathParameters['id']!,
              existingReview: state.extra as Review?,
            ),
          ),
        ),
      ],
    );
    return ProviderScope(
      overrides: [
        catalogRepositoryProvider.overrideWithValue(catalogRepository),
        cartRepositoryProvider.overrideWithValue(cartRepository),
        reviewRepositoryProvider.overrideWithValue(reviewRepository),
      ],
      child: MaterialApp.router(routerConfig: router),
    );
  }

  testWidgets(
    '"Сагслах" товч дарахад амжилттай SnackBar харагдаад, өмнөх дэлгэц рүү буцна',
    (tester) async {
      setPhoneViewport(tester);
      await tester.pumpWidget(wrap());
      router.push('/products/p1');
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('add_to_cart_button')));
      // SnackBar анимацийг харах зорилгоор pumpAndSettle-ийн ӨМНӨ нэг frame.
      await tester.pump();

      expect(find.text('Сагсанд нэмэгдлээ'), findsOneWidget);
      expect(cartRepository.addOrUpdateCalls, [(variantId: 'variant-p1', quantity: 1)]);

      await tester.pumpAndSettle();

      expect(find.byType(ProductDetailScreen), findsNothing);
    },
  );

  testWidgets(
    'сагсанд нэмэхэд алдаа гарвал алдааны SnackBar харагдаад, дэлгэц дээр үлдэнэ',
    (tester) async {
      setPhoneViewport(tester);
      cartRepository.addOrUpdateError = Exception('backend боломжгүй');
      await tester.pumpWidget(wrap());
      router.push('/products/p1');
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('add_to_cart_button')));
      await tester.pump();

      expect(find.text('Сагсанд нэмэхэд алдаа гарлаа'), findsOneWidget);

      await tester.pumpAndSettle();

      expect(find.byType(ProductDetailScreen), findsOneWidget);
    },
  );

  // §7 модуль #11: canReview/reviews UI нэгтгэл.
  group('Сэтгэгдэл/үнэлгээ', () {
    testWidgets(
      'canReview=false (худалдаж аваагүй) үед "Үнэлгээ өгөх" товч ОГТ харагдахгүй',
      (tester) async {
        setPhoneViewport(tester);
        catalogRepository.getProductHandler = (id) =>
            buildTestProduct(id: id, canReview: false);
        await tester.pumpWidget(wrap());
        router.push('/products/p1');
        await tester.pumpAndSettle();

        expect(find.byKey(const Key('review_action_button')), findsNothing);
      },
    );

    testWidgets(
      'canReview=true, myReview=null үед "Үнэлгээ өгөх" товч харагдаж, дарахад ReviewFormScreen рүү шилжинэ',
      (tester) async {
        setPhoneViewport(tester);
        catalogRepository.getProductHandler = (id) =>
            buildTestProduct(id: id, canReview: true);
        await tester.pumpWidget(wrap());
        router.push('/products/p1');
        await tester.pumpAndSettle();

        expect(find.text('Үнэлгээ өгөх'), findsOneWidget);
        await tester.tap(find.byKey(const Key('review_action_button')));
        await tester.pumpAndSettle();

        expect(find.byType(ReviewFormScreen), findsOneWidget);
        expect(find.text('Хадгалах'), findsNothing);
        expect(find.text('Илгээх'), findsOneWidget);
      },
    );

    testWidgets(
      'myReview байгаа үед товчны нэр "Үнэлгээгээ засварлах" болно',
      (tester) async {
        setPhoneViewport(tester);
        catalogRepository.getProductHandler = (id) => buildTestProduct(
          id: id,
          canReview: true,
          myReview: Review(
            id: 'r-1',
            customerId: 'cust-1',
            productId: id,
            rating: 4,
            comment: 'сайхан',
            createdAt: DateTime(2026, 1, 1),
          ),
        );
        await tester.pumpWidget(wrap());
        router.push('/products/p1');
        await tester.pumpAndSettle();

        expect(find.text('Үнэлгээгээ засварлах'), findsOneWidget);
      },
    );

    testWidgets(
      'дундаж үнэлгээ badge болон "Сэтгэгдлүүд" жагсаалт харагдана',
      (tester) async {
        setPhoneViewport(tester);
        reviewRepository.productReviewsResult = ProductReviews(
          reviews: [
            Review(
              id: 'r-1',
              customerId: 'c-1',
              productId: 'p1',
              rating: 5,
              comment: 'маш сайхан',
              createdAt: DateTime(2026, 1, 1),
            ),
          ],
          averageRating: 5,
          totalCount: 1,
        );
        await tester.pumpWidget(wrap());
        router.push('/products/p1');
        await tester.pumpAndSettle();

        expect(find.text('5.0'), findsOneWidget);
        expect(find.text('(1 сэтгэгдэл)'), findsOneWidget);
        expect(find.text('Сэтгэгдлүүд'), findsOneWidget);
        expect(find.text('маш сайхан'), findsOneWidget);
      },
    );

    testWidgets(
      '3-аас олон сэтгэгдэлтэй бол "Бүгдийг харах" товч харагдаж, дарахад бүрэн жагсаалт руу шилжинэ',
      (tester) async {
        setPhoneViewport(tester);
        reviewRepository.productReviewsResult = ProductReviews(
          reviews: List.generate(
            5,
            (i) => Review(
              id: 'r-$i',
              customerId: 'c-$i',
              productId: 'p1',
              rating: 4,
              createdAt: DateTime(2026, 1, 1),
            ),
          ),
          averageRating: 4,
          totalCount: 5,
        );
        await tester.pumpWidget(wrap());
        router.push('/products/p1');
        await tester.pumpAndSettle();

        expect(find.text('Бүгдийг харах (5)'), findsOneWidget);
        await tester.tap(find.byKey(const Key('view_all_reviews_button')));
        await tester.pumpAndSettle();

        expect(find.byType(ProductReviewsScreen), findsOneWidget);
        expect(find.byKey(const Key('all_reviews_list')), findsOneWidget);
      },
    );
  });
}
