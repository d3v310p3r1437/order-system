import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/reviews/domain/review.dart';
import 'package:mobile/features/reviews/presentation/product_reviews_screen.dart';
import 'package:mobile/features/reviews/presentation/review_providers.dart';

import '../../../support/fake_review_repository.dart';

void main() {
  late FakeReviewRepository reviewRepository;

  setUp(() {
    reviewRepository = FakeReviewRepository();
  });

  Widget wrap() {
    return ProviderScope(
      overrides: [
        reviewRepositoryProvider.overrideWithValue(reviewRepository),
      ],
      child: const MaterialApp(
        home: ProductReviewsScreen(productId: 'p1'),
      ),
    );
  }

  testWidgets('сэтгэгдэл байхгүй бол хоосон төлөв харагдана', (tester) async {
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    expect(find.text('Сэтгэгдэл алга байна'), findsOneWidget);
  });

  testWidgets('бүх сэтгэгдлийг жагсаана', (tester) async {
    reviewRepository.productReviewsResult = ProductReviews(
      reviews: [
        Review(
          id: 'r-1',
          customerId: 'c-1',
          productId: 'p1',
          rating: 5,
          comment: 'A',
          createdAt: DateTime(2026, 1, 1),
        ),
        Review(
          id: 'r-2',
          customerId: 'c-2',
          productId: 'p1',
          rating: 2,
          comment: 'B',
          createdAt: DateTime(2026, 1, 2),
        ),
      ],
      averageRating: 3.5,
      totalCount: 2,
    );
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('all_reviews_list')), findsOneWidget);
    expect(find.text('A'), findsOneWidget);
    expect(find.text('B'), findsOneWidget);
  });
}
