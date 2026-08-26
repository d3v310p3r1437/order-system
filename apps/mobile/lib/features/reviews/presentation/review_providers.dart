import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../data/review_repository.dart';
import '../domain/review.dart';

final reviewRepositoryProvider = Provider<ReviewRepository>((ref) {
  return ReviewRepository(apiClient: ref.watch(apiClientProvider));
});

/// productId бүрд тусдаа (`productDetailProvider`-тэй ижил `autoDispose`
/// зарчим) — ProductDetailScreen (товч танилцуулга) БОЛОН
/// ProductReviewsScreen ("Бүгдийг харах") хоёуланд ашиглагдана.
final productReviewsProvider = FutureProvider.autoDispose
    .family<ProductReviews, String>((ref, productId) {
      return ref.watch(reviewRepositoryProvider).getForProduct(productId);
    });
