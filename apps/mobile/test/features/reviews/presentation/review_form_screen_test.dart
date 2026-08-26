import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/core/network/api_exception.dart';
import 'package:mobile/features/reviews/domain/review.dart';
import 'package:mobile/features/reviews/presentation/review_form_screen.dart';
import 'package:mobile/features/reviews/presentation/review_providers.dart';

import '../../../support/fake_review_repository.dart';

void main() {
  late FakeReviewRepository reviewRepository;
  late GoRouter router;

  setUp(() {
    reviewRepository = FakeReviewRepository();
  });

  Widget wrap({Review? existingReview}) {
    router = GoRouter(
      initialLocation: '/detail',
      routes: [
        GoRoute(
          path: '/detail',
          pageBuilder: (context, state) =>
              const NoTransitionPage(child: Scaffold(body: Text('detail'))),
        ),
        GoRoute(
          path: '/form',
          pageBuilder: (context, state) => NoTransitionPage(
            child: ReviewFormScreen(
              productId: 'p1',
              existingReview: existingReview,
            ),
          ),
        ),
      ],
    );
    return ProviderScope(
      overrides: [
        reviewRepositoryProvider.overrideWithValue(reviewRepository),
      ],
      child: MaterialApp.router(routerConfig: router),
    );
  }

  testWidgets('rating сонгоогүй бол Илгээх товч идэвхгүй хэвээр байна', (
    tester,
  ) async {
    await tester.pumpWidget(wrap());
    router.push('/form');
    await tester.pumpAndSettle();

    final button = tester.widget<FilledButton>(
      find.byKey(const Key('submit_review_button')),
    );
    expect(button.onPressed, isNull);
  });

  testWidgets(
    '5 од сонгож Илгээх дарахад create() зөв аргументаар дуудагдана',
    (tester) async {
      await tester.pumpWidget(wrap());
      router.push('/form');
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('star_input_5')));
      await tester.pump();
      await tester.enterText(
        find.byKey(const Key('review_comment_field')),
        'маш таалагдлаа',
      );
      await tester.tap(find.byKey(const Key('submit_review_button')));
      await tester.pumpAndSettle();

      expect(reviewRepository.createCalls, [
        (productId: 'p1', rating: 5, comment: 'маш таалагдлаа'),
      ]);
      expect(find.text('Үнэлгээ илгээгдлээ'), findsOneWidget);
    },
  );

  testWidgets(
    'existingReview өгөгдсөн бол rating/comment урьдчилан бөглөгдөж, "Хадгалах" дарахад update() дуудагдана',
    (tester) async {
      await tester.pumpWidget(
        wrap(
          existingReview: Review(
            id: 'r-1',
            customerId: 'c-1',
            productId: 'p1',
            rating: 3,
            comment: 'дундаж',
            createdAt: DateTime(2026, 1, 1),
          ),
        ),
      );
      router.push('/form');
      await tester.pumpAndSettle();

      expect(find.text('Үнэлгээ засварлах'), findsOneWidget);
      expect(find.text('дундаж'), findsOneWidget);

      await tester.tap(find.byKey(const Key('star_input_1')));
      await tester.pump();
      await tester.tap(find.byKey(const Key('submit_review_button')));
      await tester.pumpAndSettle();

      expect(reviewRepository.updateCalls, [
        (reviewId: 'r-1', rating: 1, comment: 'дундаж'),
      ]);
      expect(find.text('Үнэлгээ шинэчлэгдлээ'), findsOneWidget);
    },
  );

  testWidgets('серверийн алдааны мессежийг SnackBar-аар харуулна', (
    tester,
  ) async {
    reviewRepository.createError = const ApiException(
      code: 'PRODUCT_NOT_PURCHASED',
      message: 'Худалдаж аваагүй бүтээгдэхүүнд сэтгэгдэл бичих боломжгүй',
    );
    await tester.pumpWidget(wrap());
    router.push('/form');
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('star_input_4')));
    await tester.pump();
    await tester.tap(find.byKey(const Key('submit_review_button')));
    await tester.pump();

    expect(
      find.text('Худалдаж аваагүй бүтээгдэхүүнд сэтгэгдэл бичих боломжгүй'),
      findsOneWidget,
    );
    expect(find.byType(ReviewFormScreen), findsOneWidget);
  });
}
