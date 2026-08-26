import 'package:mobile/features/reviews/data/review_repository.dart';
import 'package:mobile/features/reviews/domain/review.dart';

/// `Dio`/HTTP давхарга огт хөндөхгүй fake — `fake_coupon_repository.dart`-тай
/// адил загвар.
class FakeReviewRepository implements ReviewRepository {
  ProductReviews? productReviewsResult;
  Object? getError;
  Review? createResult;
  Object? createError;
  Review? updateResult;
  Object? updateError;

  final List<String> getForProductCalls = [];
  final List<({String productId, int rating, String? comment})> createCalls =
      [];
  final List<({String reviewId, int rating, String? comment})> updateCalls =
      [];

  @override
  Future<ProductReviews> getForProduct(String productId) async {
    getForProductCalls.add(productId);
    if (getError != null) {
      throw getError!;
    }
    return productReviewsResult ??
        const ProductReviews(reviews: [], averageRating: 0, totalCount: 0);
  }

  @override
  Future<Review> create({
    required String productId,
    required int rating,
    String? comment,
  }) async {
    createCalls.add((productId: productId, rating: rating, comment: comment));
    if (createError != null) {
      throw createError!;
    }
    return createResult ??
        Review(
          id: 'new-review',
          customerId: 'cust-1',
          productId: productId,
          rating: rating,
          comment: comment,
          createdAt: DateTime(2026, 1, 1),
        );
  }

  @override
  Future<Review> update({
    required String reviewId,
    required int rating,
    String? comment,
  }) async {
    updateCalls.add((reviewId: reviewId, rating: rating, comment: comment));
    if (updateError != null) {
      throw updateError!;
    }
    return updateResult ??
        Review(
          id: reviewId,
          customerId: 'cust-1',
          productId: 'p-1',
          rating: rating,
          comment: comment,
          createdAt: DateTime(2026, 1, 1),
        );
  }
}
