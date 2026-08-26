import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/network/api_exception.dart';
import 'package:mobile/features/reviews/domain/review.dart';
import 'package:mobile/features/reviews/presentation/review_providers.dart';
import 'package:mobile/features/reviews/presentation/widgets/quick_review_bottom_sheet.dart';

import '../../../../support/fake_review_repository.dart';

/// `ReviewFormScreen`-ийн (бүтэн дэлгэц) `review_form_screen_test.dart`-тай
/// ижил загвар — энд зөвхөн bottom sheet хэлбэрийн шинэ давхаргыг
/// (`showQuickReviewBottomSheet()` туслах функц, Navigator.pop(review)-оор
/// буцаах) шалгана.
void main() {
  late FakeReviewRepository reviewRepository;
  Review? savedReview;

  setUp(() {
    reviewRepository = FakeReviewRepository();
    savedReview = null;
  });

  Widget wrap({Review? existingReview}) {
    return ProviderScope(
      overrides: [
        reviewRepositoryProvider.overrideWithValue(reviewRepository),
      ],
      child: MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: FilledButton(
                key: const Key('open_sheet_button'),
                onPressed: () => showQuickReviewBottomSheet(
                  context: context,
                  productId: 'p1',
                  productName: 'Кока-Кола 0.5Л',
                  existingReview: existingReview,
                  onReviewSaved: (review) => savedReview = review,
                ),
                child: const Text('Нээх'),
              ),
            ),
          ),
        ),
      ),
    );
  }

  testWidgets(
    'шинээр үнэлгээ өгөхөд create() дуудагдаж, onReviewSaved-ээр буцна',
    (tester) async {
      await tester.pumpWidget(wrap());
      await tester.tap(find.byKey(const Key('open_sheet_button')));
      await tester.pumpAndSettle();

      expect(find.text('Кока-Кола 0.5Л'), findsOneWidget);
      await tester.tap(find.byKey(const Key('star_input_4')));
      await tester.pump();
      await tester.tap(find.byKey(const Key('quick_review_submit_button')));
      await tester.pumpAndSettle();

      expect(reviewRepository.createCalls, [
        (productId: 'p1', rating: 4, comment: ''),
      ]);
      expect(savedReview, isNotNull);
      expect(savedReview!.rating, 4);
      // Bottom sheet хаагдсан байх ёстой.
      expect(
        find.byKey(const Key('quick_review_submit_button')),
        findsNothing,
      );
    },
  );

  testWidgets(
    'existingReview өгөгдсөн бол rating урьдчилан бөглөгдөж, "Хадгалах" дарахад update() дуудагдана',
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
      await tester.tap(find.byKey(const Key('open_sheet_button')));
      await tester.pumpAndSettle();

      expect(find.text('Хадгалах'), findsOneWidget);
      await tester.tap(find.byKey(const Key('star_input_1')));
      await tester.pump();
      await tester.tap(find.byKey(const Key('quick_review_submit_button')));
      await tester.pumpAndSettle();

      expect(reviewRepository.updateCalls, [
        (reviewId: 'r-1', rating: 1, comment: 'дундаж'),
      ]);
      expect(savedReview!.rating, 1);
    },
  );

  testWidgets(
    'серверийн алдааны мессежийг sheet дотор SnackBar-аар харуулна, sheet хаагдахгүй',
    (tester) async {
      reviewRepository.createError = const ApiException(
        code: 'PRODUCT_NOT_PURCHASED',
        message: 'Худалдаж аваагүй бүтээгдэхүүнд сэтгэгдэл бичих боломжгүй',
      );
      await tester.pumpWidget(wrap());
      await tester.tap(find.byKey(const Key('open_sheet_button')));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('star_input_2')));
      await tester.pump();
      await tester.tap(find.byKey(const Key('quick_review_submit_button')));
      await tester.pump();

      expect(
        find.text('Худалдаж аваагүй бүтээгдэхүүнд сэтгэгдэл бичих боломжгүй'),
        findsOneWidget,
      );
      // Sheet хэвээр нээлттэй байна (алдаа гарахад автоматаар хаагдахгүй).
      expect(
        find.byKey(const Key('quick_review_submit_button')),
        findsOneWidget,
      );
    },
  );
}
