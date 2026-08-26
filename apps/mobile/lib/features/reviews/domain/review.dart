/// `apps/api/src/reviews`-ийн `Review` мөр (§7 модуль #11) — `Product.myReview`
/// (`GET /products/:id`) БОЛОН `ProductReviews.reviews` (`GET
/// /products/:id/reviews`) хоёуланд ижил хэлбэрээр буцна.
class Review {
  const Review({
    required this.id,
    required this.customerId,
    required this.productId,
    required this.rating,
    required this.createdAt,
    this.comment,
  });

  factory Review.fromJson(Map<String, dynamic> json) {
    return Review(
      id: json['id'] as String,
      customerId: json['customerId'] as String,
      productId: json['productId'] as String,
      rating: json['rating'] as int,
      comment: json['comment'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  final String id;
  final String customerId;
  final String productId;
  final int rating;
  final String? comment;
  final DateTime createdAt;
}

/// `GET /products/:id/reviews`-ийн буцаах хэлбэр — averageRating-ийг
/// backend-ийн aggregate query-ээс шууд авна (frontend талд ДАХИН
/// ТООЦООЛОХГҮЙ, ADR 005-ийн "ганц газар л шийднэ" зарчим).
class ProductReviews {
  const ProductReviews({
    required this.reviews,
    required this.averageRating,
    required this.totalCount,
  });

  factory ProductReviews.fromJson(Map<String, dynamic> json) {
    return ProductReviews(
      reviews: (json['reviews'] as List<dynamic>)
          .map((r) => Review.fromJson(r as Map<String, dynamic>))
          .toList(),
      averageRating: (json['averageRating'] as num).toDouble(),
      totalCount: json['totalCount'] as int,
    );
  }

  final List<Review> reviews;
  final double averageRating;
  final int totalCount;
}
